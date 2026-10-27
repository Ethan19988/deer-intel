"use client";

// A drop-in replacement for react-leaflet's <TileLayer> that serves downloaded
// tiles from Cache Storage first (so the map works offline), then falls back to
// the network. When nothing is downloaded it behaves exactly like the stock
// tile layer, so it adds zero overhead until offline maps are used.

import {
  createElementObject,
  createTileLayerComponent,
  updateGridLayer,
  withPane,
} from "@react-leaflet/core";
import { DomEvent, TileLayer as LeafletTileLayer } from "leaflet";
import type { Coords, DoneCallback } from "leaflet";
import type { TileLayerProps } from "react-leaflet";
import { matchOfflineTile, offlineTilesAvailable } from "@/lib/offlineMaps";

// Build one tile <img> that is served from the offline cache when `cacheKey`
// was downloaded, else from `url` over the network. Shared by every tile layer
// that offline packs save (XYZ here, WMS in SuperWMSTileLayer).
export function createCachedTile(
  layer: LeafletTileLayer,
  done: DoneCallback,
  url: string,
  cacheKey: string = url,
): HTMLImageElement {
  const tile = document.createElement("img");

  DomEvent.on(tile, "load", () => {
    revokeObjectUrl(tile);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (layer as any)._tileOnLoad(done, tile);
  });
  DomEvent.on(tile, "error", () => {
    revokeObjectUrl(tile);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (layer as any)._tileOnError(done, tile, undefined);
  });

  if (layer.options.crossOrigin || layer.options.crossOrigin === "") {
    tile.crossOrigin =
      layer.options.crossOrigin === true ? "" : layer.options.crossOrigin;
  }
  if (layer.options.referrerPolicy) {
    tile.referrerPolicy = layer.options.referrerPolicy;
  }

  tile.alt = "";
  tile.setAttribute("role", "presentation");

  // Nothing downloaded → straight to the network, same as the stock layer.
  if (!offlineTilesAvailable()) {
    tile.src = url;
    return tile;
  }

  // A downloaded tile is served from cache as a blob; a miss falls through to
  // the network so browsing outside a saved area still works when online.
  matchOfflineTile(cacheKey)
    .then((objectUrl) => {
      if (objectUrl) {
        tile.dataset.offlineObjectUrl = objectUrl;
        tile.src = objectUrl;
      } else {
        tile.src = url;
      }
    })
    .catch(() => {
      tile.src = url;
    });

  return tile;
}

class CachedLeafletTileLayer extends LeafletTileLayer {
  createTile(coords: Coords, done: DoneCallback): HTMLImageElement {
    return createCachedTile(this, done, this.getTileUrl(coords));
  }
}

// A 1x1 transparent GIF shown in place of a tile that fails to load. Without
// it the failed <img> stays broken and iOS Safari paints a "?" icon in every
// empty tile slot — which USGS's sparse hydrography cache does across whole
// regions at z13–14 (it 404s tiles it never cached).
const TRANSPARENT_TILE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function revokeObjectUrl(tile: HTMLImageElement): void {
  const objectUrl = tile.dataset.offlineObjectUrl;
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    delete tile.dataset.offlineObjectUrl;
  }
}

const CachedTileLayer = createTileLayerComponent<
  CachedLeafletTileLayer,
  TileLayerProps
>(
  function createCachedTileLayer({ url, ...options }, context) {
    const layer = new CachedLeafletTileLayer(
      url as string,
      withPane({ errorTileUrl: TRANSPARENT_TILE, ...options }, context),
    );
    return createElementObject(layer, context);
  },
  function updateCachedTileLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps);
    if (props.url != null && props.url !== prevProps.url) {
      layer.setUrl(props.url as string);
    }
  },
);

export default CachedTileLayer;
