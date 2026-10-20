import * as L from "leaflet";
import { Marker, useMap } from "react-leaflet";
import { zoomToSeparate, type PointCluster } from "@/lib/mapClusters";
import { pinBodyColor, type GlyphKey } from "@/lib/mapPinIcon";
import type { MapAsset } from "@/lib/propertyMap";

// A numbered bubble standing in for pins stacked together at this zoom. Its
// ring takes the color of the most common pin type inside. Tap it to zoom in
// until the pins separate.
export default function AssetClusterMarker({ cluster }: { cluster: PointCluster<MapAsset> }) {
  const map = useMap();

  function zoomIn() {
    map.flyTo([cluster.lat, cluster.lng], zoomToSeparate(cluster.members, map.getZoom()));
  }

  return (
    <Marker
      position={[cluster.lat, cluster.lng]}
      icon={clusterIcon(cluster)}
      bubblingMouseEvents={false}
      eventHandlers={{ click: zoomIn }}
      keyboard
      title={`${cluster.members.length} pins — tap to zoom in`}
    />
  );
}

// Most common pin type inside, so the bubble wears that group's colour.
function dominantLayer(members: MapAsset[]): GlyphKey {
  const counts = new Map<string, number>();
  for (const member of members) counts.set(member.layerId, (counts.get(member.layerId) ?? 0) + 1);
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (top?.[0] ?? "other") as GlyphKey;
}

function clusterIcon(cluster: PointCluster<MapAsset>) {
  const count = cluster.members.length;
  const size = count >= 10 ? 44 : 38;
  const body = pinBodyColor(dominantLayer(cluster.members));
  // Same family as the pins: muted body, off-white ring and number.
  const html = `<div style="width:${size}px;height:${size}px;border-radius:999px;display:grid;place-items:center;background:${body};border:2px solid #F3EEE4;box-shadow:0 0 0 1px #2B1D12,0 1px 3px rgba(0,0,0,0.45);color:#F3EEE4;font:800 ${count >= 10 ? 15 : 14}px/1 system-ui,sans-serif;">${count}</div>`;
  return L.divIcon({
    className: "deer-intel-map-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
