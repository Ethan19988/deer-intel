import { useEffect } from "react";
import { useMap } from "react-leaflet";
import {
  leafletLayer,
  LineSymbolizer,
  PolygonSymbolizer,
  CenteredTextSymbolizer,
} from "protomaps-leaflet";

// Statewide land-owner parcels, served as a single PMTiles vector-tile archive
// and rendered client-side. Unlike the baked-JSON overlay (which loads every
// parcel into memory), the map only fetches the tiles in view, so this scales
// to the whole state. The tiles carry the shared parcel schema in their
// `parcels` layer: { owner, acres, pin, addr, pub }.
const PMTILES_URL = "/data/pa-parcels.pmtiles";

// Owner labels only make sense zoomed in; below this they collide into mush.
// (protomaps' labeler also drops overlapping labels automatically.)
const LABEL_MIN_ZOOM = 15;

const LABEL_FONT = "600 12px system-ui, -apple-system, Segoe UI, sans-serif";

// Thin the label candidates at lower zoom so only bigger parcels get names
// until you zoom onto a property — mirrors the JSON overlay's acreage gate.
function labelPasses(zoom: number, feature: { props: Record<string, unknown> }) {
  const acres = Number(feature.props.acres) || 0;
  if (zoom >= 17) return true;
  if (zoom >= 16) return acres >= 1;
  return acres >= 4;
}

type ParcelTilesLayerProps = {
  enabled: boolean;
};

export default function ParcelTilesLayer({ enabled }: ParcelTilesLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    const layer = leafletLayer({
      url: PMTILES_URL,
      // Tiles top out at z15; keep drawing them (overzoomed) past that.
      maxDataZoom: 15,
      paintRules: [
        // Public / government land gets a translucent blaze fill.
        {
          dataLayer: "parcels",
          symbolizer: new PolygonSymbolizer({
            fill: "#f97316",
            opacity: 0.18,
          }),
          filter: (_z, f) => f.props.pub === 1,
        },
        // Every parcel gets a light boundary line, legible over satellite.
        {
          dataLayer: "parcels",
          symbolizer: new LineSymbolizer({
            color: "#f8fafc",
            width: 0.8,
            opacity: 0.7,
          }),
        },
      ],
      labelRules: [
        {
          dataLayer: "parcels",
          minzoom: LABEL_MIN_ZOOM,
          filter: (z, f) => labelPasses(z, f),
          symbolizer: new CenteredTextSymbolizer({
            labelProps: ["owner"],
            fill: "#0b1120",
            stroke: "#f8fafc",
            width: 2.5,
            font: LABEL_FONT,
          }),
        },
      ],
    });

    layer.addTo(map);

    return () => {
      layer.remove();
    };
  }, [enabled, map]);

  return null;
}
