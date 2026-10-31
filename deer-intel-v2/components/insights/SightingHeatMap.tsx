"use client";

import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import { CircleMarker, ImageOverlay, MapContainer, Tooltip } from "react-leaflet";
import CachedTileLayer from "@/components/map/CachedTileLayer";
import { renderSightingHeat } from "@/components/insights/heatRaster";
import { CURRENT_URL } from "@/lib/propertyMap";
import { heatSpotLine, type HeatSpot } from "@/lib/sightingHeat";

// The small Leaflet view behind the property's sighting heat: the same current
// satellite imagery as the main map (served from offline packs when present),
// the additive heat raster, and a tap target on each stand / camera that
// explains its number. Loaded client-only by SightingHeatPanel.

type SightingHeatMapProps = {
  spots: HeatSpot[];
  /** Every located stand / camera, so the view doesn't jump as filters change. */
  extent: Array<[number, number]>;
};

const ATTRIBUTION = "Imagery &copy; Esri, Maxar, Earthstar Geographics";

export default function SightingHeatMap({ spots, extent }: SightingHeatMapProps) {
  const raster = useMemo(() => renderSightingHeat(spots), [spots]);

  const bounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (extent.length === 0) return null;
    let south = Infinity;
    let north = -Infinity;
    let west = Infinity;
    let east = -Infinity;
    for (const [lat, lng] of extent) {
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      west = Math.min(west, lng);
      east = Math.max(east, lng);
    }
    // A single asset still needs a box to fit: ~250 m around it.
    const pad = 0.0025;
    return [
      [south - pad, west - pad],
      [north + pad, east + pad],
    ];
  }, [extent]);

  if (!bounds) return null;
  const boundsKey = bounds.flat().map((value) => value.toFixed(5)).join(",");

  return (
    <MapContainer
      key={boundsKey}
      bounds={bounds}
      maxZoom={19}
      scrollWheelZoom={false}
      zoomControl
      attributionControl
      style={{ height: "100%", width: "100%", background: "#0b0d0b" }}
    >
      <CachedTileLayer
        url={CURRENT_URL}
        attribution={ATTRIBUTION}
        maxZoom={19}
        maxNativeZoom={19}
      />
      {raster ? <ImageOverlay url={raster.url} bounds={raster.bounds} opacity={1} /> : null}
      {spots.map((spot) => (
        <CircleMarker
          key={spot.id}
          center={[spot.lat, spot.lng]}
          radius={spot.kind === "stand" ? 7 : 6}
          pathOptions={{
            color: "#0b0d0b",
            weight: 1.5,
            fillColor: spot.kind === "stand" ? "#e8e6df" : "#ff6a1a",
            fillOpacity: 0.95,
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <strong>{spot.name}</strong>
            <br />
            {spot.kind === "stand" ? "Stand" : "Camera"} · {heatSpotLine(spot)}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
