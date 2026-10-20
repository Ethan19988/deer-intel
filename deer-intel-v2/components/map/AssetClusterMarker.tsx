import * as L from "leaflet";
import { Marker, useMap } from "react-leaflet";
import { zoomToSeparate, type PointCluster } from "@/lib/mapClusters";
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

function dominantColors(members: MapAsset[]) {
  const counts = new Map<string, { n: number; color: string; background: string }>();
  for (const member of members) {
    const entry = counts.get(member.layerId) ?? { n: 0, color: member.color, background: member.background };
    entry.n += 1;
    counts.set(member.layerId, entry);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0];
}

function clusterIcon(cluster: PointCluster<MapAsset>) {
  const count = cluster.members.length;
  const size = count >= 10 ? 44 : 38;
  const { color, background } = dominantColors(cluster.members);
  const html = `<div style="width:${size}px;height:${size}px;border-radius:999px;display:grid;place-items:center;background:${background};border:3px solid ${color};box-shadow:0 0 0 3px rgba(0,0,0,0.25),0 4px 10px rgba(0,0,0,0.45);color:#fff;font:800 ${count >= 10 ? 15 : 14}px/1 system-ui,sans-serif;">${count}</div>`;
  return L.divIcon({
    className: "deer-intel-map-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
