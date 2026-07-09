declare module "leaflet" {
  export type LatLngExpression =
    | [number, number]
    | {
        lat: number;
        lng: number;
      };

  export interface LatLng {
    lat: number;
    lng: number;
  }

  export interface LatLngBounds {
    contains(latlng: LatLngExpression): boolean;
  }

  export type LatLngBoundsExpression = unknown;
  export type PointExpression =
    | [number, number]
    | {
        x: number;
        y: number;
      };

  export interface FitBoundsOptions {
    [key: string]: unknown;
  }

  export interface MapOptions {
    center?: LatLngExpression;
    zoom?: number;
    [key: string]: unknown;
  }

  export class Map {
    containerPointToLatLng(point: PointExpression): LatLng;
    getContainer(): HTMLElement;
    getCenter(): LatLng;
    getBounds(): LatLngBounds;
    getZoom(): number;
    flyTo(center: LatLngExpression, zoom?: number, options?: unknown): this;
    setView(center: LatLngExpression, zoom?: number): this;
    zoomIn(delta?: number): this;
    zoomOut(delta?: number): this;
  }

  export class Layer {}
  export class LayerGroup extends Layer {}
  export class FeatureGroup extends LayerGroup {}
  export class Path extends Layer {}
  export class Circle extends Path {}
  export class CircleMarker extends Circle {}
  export class Marker extends Layer {
    getLatLng(): LatLng;
  }
  export class DivIcon {}
  export class Popup extends Layer {}
  export class Tooltip extends Layer {}
  export class TileLayer extends Layer {}
  export class GridLayer extends Layer {}
  export class ImageOverlay extends Layer {}
  export class SVGOverlay extends Layer {}
  export class VideoOverlay extends Layer {}
  export class Rectangle extends Path {}
  export class Polygon extends Path {}
  export class Polyline extends Path {}
  export class GeoJSON extends Layer {}
  export class Evented {}

  export class Control {}

  export namespace Control {
    class Layers extends Control {}
    class Scale extends Control {}

    interface ScaleOptions extends ControlOptions {
      imperial?: boolean;
      maxWidth?: number;
      metric?: boolean;
      updateWhenIdle?: boolean;
    }
  }

  export interface LayerOptions {
    [key: string]: unknown;
  }

  export type InteractiveLayerOptions = LayerOptions;
  export type PathOptions = InteractiveLayerOptions;
  export type PolylineOptions = PathOptions;
  export type CircleOptions = PathOptions;
  export type CircleMarkerOptions = CircleOptions;
  export type MarkerOptions = InteractiveLayerOptions;
  export type PopupOptions = LayerOptions;
  export type TooltipOptions = LayerOptions;
  export interface TileLayerOptions extends LayerOptions {
    attribution?: string;
  }
  export type GridLayerOptions = LayerOptions;
  export type ImageOverlayOptions = LayerOptions;
  export type VideoOverlayOptions = LayerOptions;
  export type GeoJSONOptions = LayerOptions;
  export type WMSOptions = TileLayerOptions;
  export interface WMSParams {
    [key: string]: unknown;
  }
  export interface ControlOptions {
    position?: string;
  }

  export interface DivIconOptions {
    className?: string;
    html?: string;
    iconAnchor?: PointExpression;
    iconSize?: PointExpression;
    popupAnchor?: PointExpression;
    [key: string]: unknown;
  }

  export function divIcon(options?: DivIconOptions): DivIcon;

  export interface LeafletMouseEvent {
    latlng: {
      lat: number;
      lng: number;
    };
    // Present on marker events (e.g. dragend), where the target is the marker.
    target?: Marker;
  }

  export interface LeafletEventHandlerFnMap {
    click?: (event: LeafletMouseEvent) => void;
    [eventName: string]: ((event: LeafletMouseEvent) => void) | undefined;
  }
}
