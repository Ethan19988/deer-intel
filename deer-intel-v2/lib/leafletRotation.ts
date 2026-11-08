// Heading-up map rotation for Leaflet, which only draws north-up on its own.
//
// How it works: the map pane (tiles, parcel lines, markers, popups) is turned
// with the CSS `rotate` property around the center of the map, while the map
// container and every control on it stay put. A few Leaflet internals are
// patched once so the rotated view still behaves:
//
// - Taps and pinches are un-rotated before Leaflet turns them into lat/lngs, so
//   tapping a parcel or dropping a pin hits the spot under your finger.
// - Tile layers (base imagery and the parcel vector tiles) and vector renderers
//   load a square big enough to cover the screen's diagonal, so the corners
//   never show blank while the map is turned.
// - Marker icons, popups and tooltips are turned back the other way so pins and
//   labels stay upright. Icons with NO_COUNTER_ROTATE_CLASS keep turning with
//   the map (the live-location facing cone, which should point up the screen).
//
// The patches are no-ops on any map that isn't rotated.

import {
  Bounds,
  GridLayer,
  Map as LeafletMap,
  Marker,
  Point,
  Popup,
  Renderer,
  Tooltip,
} from "leaflet";

export const NO_COUNTER_ROTATE_CLASS = "di-map-no-counter-rotate";
const COUNTER_VAR = "--di-map-counter-rotation";
const ROTATED_CLASS = "di-map-rotated";

// Current rotation per map, in degrees clockwise from north (the heading that
// is now at the top of the screen). Absent = north-up.
const bearings = new WeakMap<LeafletMap, number>();

function bearingOf(map: LeafletMap | null | undefined): number | null {
  if (!map) return null;
  return bearings.has(map) ? (bearings.get(map) as number) : null;
}

// Half the screen diagonal: the radius the rotated view can reach.
function coverRadius(map: LeafletMap): number {
  const size = map.getSize();
  return Math.hypot(size.x, size.y) / 2;
}

// Append a counter-rotation to an element Leaflet just positioned. Leaflet
// rewrites `transform` on every reposition, so this never stacks up; the angle
// comes from a CSS variable on the map container, so turning the map updates
// every pin without touching each one.
function counterRotate(element: HTMLElement, originX: number, originY: number) {
  element.style.transform = `${element.style.transform} rotate(var(${COUNTER_VAR}, 0deg))`;
  element.style.transformOrigin = `${originX}px ${originY}px`;
}

type GridLayerInternals = {
  _map?: LeafletMap;
  _tileZoom?: number;
  _update?: () => void;
  _getTiledPixelBounds: (center: unknown) => Bounds;
};
type RendererInternals = {
  _map?: LeafletMap;
  options: { padding?: number };
  _update: () => void;
};
type MarkerInternals = {
  _icon?: HTMLElement | null;
  _setPos: (pos: Point) => void;
};
type PopupInternals = {
  _map?: LeafletMap;
  _container?: HTMLElement;
  _containerLeft?: number;
  _containerBottom?: number;
  _updatePosition: () => void;
  _animateZoom: (event: unknown) => void;
};
type TooltipInternals = {
  _container?: HTMLElement;
  _setPosition: (pos: Point) => void;
};

let installed = false;

export function installLeafletRotation() {
  if (installed) return;
  installed = true;

  // Map: un-rotate pointer positions. The pane is turned by -bearing around the
  // container center c, so a screen point s came from c + R(bearing)(s - c).
  const mapProto = LeafletMap.prototype as unknown as {
    mouseEventToContainerPoint: (event: MouseEvent | TouchEvent) => Point;
  };
  const originalMouseToContainer = mapProto.mouseEventToContainerPoint;
  mapProto.mouseEventToContainerPoint = function (
    this: LeafletMap,
    event: MouseEvent | TouchEvent,
  ) {
    const screenPoint = originalMouseToContainer.call(this, event);
    const bearing = bearingOf(this);
    if (!bearing) return screenPoint;
    const size = this.getSize();
    const cx = size.x / 2;
    const cy = size.y / 2;
    const rad = (bearing * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = screenPoint.x - cx;
    const dy = screenPoint.y - cy;
    return new Point(cx + dx * cos - dy * sin, cy + dx * sin + dy * cos);
  };

  // Tile layers: load a square around the center that covers the diagonal.
  const gridProto = GridLayer.prototype as unknown as GridLayerInternals;
  const originalTiledBounds = gridProto._getTiledPixelBounds;
  gridProto._getTiledPixelBounds = function (
    this: GridLayerInternals,
    center: unknown,
  ) {
    const bounds = originalTiledBounds.call(this, center);
    const map = this._map;
    if (!map || bearingOf(map) === null) return bounds;
    const scale = map.getZoomScale(map.getZoom(), this._tileZoom);
    const half = coverRadius(map) / scale;
    const mid = bounds.getCenter();
    return new Bounds(
      new Point(mid.x - half, mid.y - half),
      new Point(mid.x + half, mid.y + half),
    );
  };

  // Vector renderers (hunt areas, trails, parcel outlines drawn as paths): pad
  // the drawn area enough that the turned corners are covered too.
  const rendererProto = Renderer.prototype as unknown as RendererInternals;
  const originalRendererUpdate = rendererProto._update;
  rendererProto._update = function (this: RendererInternals) {
    const map = this._map;
    if (!map || bearingOf(map) === null) {
      originalRendererUpdate.call(this);
      return;
    }
    const size = map.getSize();
    const radius = coverRadius(map);
    const needed =
      Math.max(
        (radius - size.x / 2) / Math.max(size.x, 1),
        (radius - size.y / 2) / Math.max(size.y, 1),
      ) + 0.05;
    const hadOwn = Object.prototype.hasOwnProperty.call(
      this.options,
      "padding",
    );
    const previous = this.options.padding;
    this.options.padding = Math.max(previous ?? 0.1, needed);
    try {
      originalRendererUpdate.call(this);
    } finally {
      if (hadOwn) this.options.padding = previous;
      else delete this.options.padding;
    }
  };

  // Markers: keep icons upright, pivoting on the icon's anchor (the point that
  // sits on the map) so a pin's tip stays on its spot.
  const markerProto = Marker.prototype as unknown as MarkerInternals;
  const originalSetPos = markerProto._setPos;
  markerProto._setPos = function (this: MarkerInternals, pos: Point) {
    originalSetPos.call(this, pos);
    const icon = this._icon;
    if (!icon || icon.classList.contains(NO_COUNTER_ROTATE_CLASS)) return;
    counterRotate(
      icon,
      -(parseFloat(icon.style.marginLeft) || 0),
      -(parseFloat(icon.style.marginTop) || 0),
    );
  };

  // Popups: pivot on the popup's tip.
  const popupProto = Popup.prototype as unknown as PopupInternals;
  const uprightPopup = (popup: PopupInternals) => {
    const container = popup._container;
    if (!container || !popup._map) return;
    counterRotate(
      container,
      -(popup._containerLeft ?? 0),
      (popup._containerBottom ?? 0) + container.offsetHeight,
    );
  };
  const originalPopupUpdate = popupProto._updatePosition;
  popupProto._updatePosition = function (this: PopupInternals) {
    originalPopupUpdate.call(this);
    uprightPopup(this);
  };
  const originalPopupZoom = popupProto._animateZoom;
  popupProto._animateZoom = function (this: PopupInternals, event: unknown) {
    originalPopupZoom.call(this, event);
    uprightPopup(this);
  };

  // Tooltips: pivot on their own center (close enough for short labels).
  const tooltipProto = Tooltip.prototype as unknown as TooltipInternals;
  const originalTooltipPos = tooltipProto._setPosition;
  tooltipProto._setPosition = function (this: TooltipInternals, pos: Point) {
    originalTooltipPos.call(this, pos);
    const container = this._container;
    if (!container) return;
    counterRotate(
      container,
      container.offsetWidth / 2,
      container.offsetHeight / 2,
    );
  };
}

// Reload tiles and vector paths after rotation turns on or off, so the bigger
// (or normal) coverage area takes effect right away.
function refreshCoverage(map: LeafletMap) {
  map.eachLayer((layer) => {
    if (layer instanceof GridLayer || layer instanceof Renderer) {
      const update = (layer as unknown as { _update?: () => void })._update;
      if (typeof update === "function") update.call(layer);
    }
  });
}

// Keep the pivot on the container center (call again when the map resizes).
export function syncRotationOrigin(map: LeafletMap) {
  if (bearingOf(map) === null) return;
  const pane = map.getPane("mapPane");
  if (!pane) return;
  const size = map.getSize();
  pane.style.transformOrigin = `${size.x / 2}px ${size.y / 2}px`;
}

// Turn the map so `bearing` (degrees clockwise from north) is at the top of
// the screen, or pass null to go back to north-up. The angle can run past 360
// (it's kept continuous so the map never spins the long way round).
export function setMapBearing(map: LeafletMap, bearing: number | null) {
  installLeafletRotation();
  const wasRotated = bearingOf(map) !== null;
  const pane = map.getPane("mapPane");
  const container = map.getContainer();
  if (!pane) return;

  if (bearing === null) {
    bearings.delete(map);
    pane.style.rotate = "";
    pane.style.transformOrigin = "";
    container.style.removeProperty(COUNTER_VAR);
    container.classList.remove(ROTATED_CLASS);
  } else {
    bearings.set(map, bearing);
    syncRotationOrigin(map);
    pane.style.rotate = `${-bearing}deg`;
    container.style.setProperty(COUNTER_VAR, `${bearing}deg`);
    container.classList.add(ROTATED_CLASS);
  }

  if (wasRotated !== (bearing !== null)) refreshCoverage(map);
}
