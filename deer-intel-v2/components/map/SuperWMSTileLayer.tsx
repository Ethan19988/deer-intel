"use client";

// A WMS tile layer that requests each tile at `superSample`x the on-screen
// resolution and lets the browser downscale it. Supersampling anti-aliases the
// USGS server's hard ~1-px contour strokes, so they render as thin, smooth
// lines instead of the jagged/pixelly ones you get when tiles are drawn at 1:1
// device pixels (which is all `detectRetina` gives you on a 2x phone). The tile
// footprint on screen is unchanged — only the fetched image is denser.

import {
  createElementObject,
  createTileLayerComponent,
  updateGridLayer,
  withPane,
} from "@react-leaflet/core";
import { TileLayer } from "leaflet";
import type { Coords, WMSOptions, WMSParams } from "leaflet";
import type { WMSTileLayerProps } from "react-leaflet";

// @types/leaflet exposes `TileLayer.WMS` only through a namespace that doesn't
// merge off this import, so describe the WMS instance/constructor explicitly and
// reach the runtime constructor (which does exist) through a typed cast.
interface WMSLayer extends TileLayer {
  wmsParams: WMSParams;
  getTileSize(): { x: number; y: number };
  getTileUrl(coords: Coords): string;
  redraw(): this;
}
type WMSConstructor = new (url: string, options: WMSOptions) => WMSLayer;
const WMSTileLayerCtor = (TileLayer as unknown as { WMS: WMSConstructor }).WMS;

class SuperSampledWMS extends WMSTileLayerCtor {
  _superSample = 1;

  getTileUrl(coords: Coords): string {
    const ss = Math.max(1, this._superSample || 1);
    const size = this.getTileSize();
    // Ask the server for a denser image than the tile's CSS box; the browser
    // shrinks it back down, smoothing the thin contour lines in the process.
    this.wmsParams.width = Math.round(size.x * ss);
    this.wmsParams.height = Math.round(size.y * ss);
    return super.getTileUrl(coords);
  }
}

export type SuperWMSTileLayerProps = WMSTileLayerProps & {
  /** Times the display resolution to fetch each tile at (default 1 = off). */
  superSample?: number;
};

const SuperWMSTileLayer = createTileLayerComponent<
  SuperSampledWMS,
  SuperWMSTileLayerProps
>(
  function createSuperWMSTileLayer(
    // eventHandlers is consumed by react-leaflet core, not the Leaflet layer;
    // superSample is pulled out so it never leaks into the WMS request URL.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { eventHandlers: _eh, superSample, url, ...options },
    context,
  ) {
    const layer = new SuperSampledWMS(
      url as string,
      withPane(options, context) as WMSOptions,
    );
    layer._superSample = Number(superSample) || 1;
    return createElementObject(layer, context);
  },
  function updateSuperWMSTileLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps);
    const next = Number(props.superSample) || 1;
    if (next !== (Number(prevProps.superSample) || 1)) {
      layer._superSample = next;
      layer.redraw();
    }
  },
);

export default SuperWMSTileLayer;
