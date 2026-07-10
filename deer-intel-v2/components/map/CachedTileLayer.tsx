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

class CachedLeafletTileLayer extends LeafletTileLayer {
  createTile(coords: Coords, done: DoneCallback): HTMLImageElement {
    const tile = document.createElement("img");

    DomEvent.on(tile, "load", () => {
      revokeObjectUrl(tile);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any)._tileOnLoad(done, tile);
    });
    DomEvent.on(tile, "error", () => {
      revokeObjectUrl(tile);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any)._tileOnError(done, tile, undefined);
    });

    if (this.options.crossOrigin || this.options.crossOrigin === "") {
      tile.crossOrigin =
        this.options.crossOrigin === true ? "" : this.options.crossOrigin;
    }
    if (this.options.referrerPolicy) {
      tile.referrerPolicy = this.options.referrerPolicy;
    }

    tile.alt = "";
    tile.setAttribute("role", "presentation");

    const url = this.getTileUrl(coords);

    // Nothing downloaded → straight to the network, same as the stock layer.
    if (!offlineTilesAvailable()) {
      tile.src = url;
      return tile;
    }

    // A downloaded tile is served from cache as a blob; a miss falls through to
    // the network so browsing outside a saved area still works when online.
    matchOfflineTile(url)
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
}

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
      withPane(options, context),
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
