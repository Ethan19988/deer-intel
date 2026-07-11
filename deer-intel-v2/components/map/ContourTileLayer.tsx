"use client";

// The USGS contour service is a dynamic (non-cached) ArcGIS MapServer, so there
// is no {z}/{x}/{y} tile endpoint. This layer requests one transparent PNG per
// map tile from the service's `export` endpoint, passing that tile's Web
// Mercator bounding box — giving us labeled contour lines over any base map.

import {
  createElementObject,
  createTileLayerComponent,
  updateGridLayer,
  withPane,
} from "@react-leaflet/core";
import * as L from "leaflet";
import type { LatLngBounds } from "leaflet";
import type { TileLayerProps } from "react-leaflet";

// A comma-separated list of MapServer sublayer ids to show (density control),
// e.g. index contours only vs. index + intermediate + supplemental.
type ContourTileLayerProps = TileLayerProps & { showLayers?: string };

// Project a lat/lng to Web Mercator (EPSG:3857) metres — the exact spherical
// mercator ArcGIS expects, without depending on Leaflet's CRS typings.
const WEB_MERCATOR_RADIUS = 6378137;

function toWebMercator(lat: number, lng: number): { x: number; y: number } {
  const x = WEB_MERCATOR_RADIUS * ((lng * Math.PI) / 180);
  const y =
    WEB_MERCATOR_RADIUS *
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return { x, y };
}

class ContourLeafletTileLayer extends L.TileLayer {
  getTileUrl(coords: L.Coords): string {
    // Reach the tile's geographic bounds and current tile size through the
    // GridLayer internals (not in the public typings), then project the corners
    // to Web Mercator for the export request.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any;
    const bounds = self._tileCoordsToBounds(coords) as LatLngBounds;
    const northWest = toWebMercator(bounds.getNorth(), bounds.getWest());
    const southEast = toWebMercator(bounds.getSouth(), bounds.getEast());
    const bbox = `${northWest.x},${southEast.y},${southEast.x},${northWest.y}`;
    const size = self.getTileSize();
    const showLayers: string | undefined = self.options.showLayers;
    const layersParam = showLayers ? `&layers=show:${showLayers}` : "";

    return (
      `${self._url}?bbox=${bbox}&bboxSR=3857&imageSR=3857` +
      `&size=${size.x},${size.y}&format=png32&transparent=true&dpi=96&f=image` +
      layersParam
    );
  }
}

const ContourTileLayer = createTileLayerComponent<
  ContourLeafletTileLayer,
  ContourTileLayerProps
>(
  function createContourTileLayer({ url, showLayers, ...options }, context) {
    const layer = new ContourLeafletTileLayer(
      url as string,
      withPane(options, context),
    );
    (layer.options as unknown as { showLayers?: string }).showLayers =
      showLayers as string | undefined;
    return createElementObject(layer, context);
  },
  function updateContourTileLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps);
    if (props.url != null && props.url !== prevProps.url) {
      layer.setUrl(props.url as string);
    }
  },
);

export default ContourTileLayer;
