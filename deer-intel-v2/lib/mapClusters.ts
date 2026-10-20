// Group map pins that would sit on top of each other at the current zoom into
// one numbered bubble. Greedy distance clustering in screen pixels (Web
// Mercator), so two pins a few yards apart merge when zoomed out and split back
// into their own pins as you zoom in. Small lists — a property's pins — so the
// simple O(n²) pass is plenty fast.

export type ClusterPoint = { id: string; lat: number; lng: number };

export type PointCluster<T extends ClusterPoint> = {
  id: string;
  lat: number;
  lng: number;
  members: T[];
};

// At this zoom and closer, every pin draws on its own.
export const CLUSTER_MAX_ZOOM = 17;
// Pins closer than this on screen merge (a pin is ~30 px wide).
export const CLUSTER_RADIUS_PX = 44;

function worldPx(point: { lat: number; lng: number }, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((point.lat * Math.PI) / 180);
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export function clusterPoints<T extends ClusterPoint>(
  points: T[],
  zoom: number,
  options: { keepSingle?: string | null; radiusPx?: number; maxZoom?: number } = {},
): { singles: T[]; clusters: PointCluster<T>[] } {
  const maxZoom = options.maxZoom ?? CLUSTER_MAX_ZOOM;
  if (zoom >= maxZoom || points.length < 2) return { singles: points, clusters: [] };

  const radius = options.radiusPx ?? CLUSTER_RADIUS_PX;
  const groups: Array<{ x: number; y: number; members: T[] }> = [];
  const singles: T[] = [];

  for (const point of points) {
    // The selected pin always stands alone so its card stays anchored to it.
    if (point.id === options.keepSingle) {
      singles.push(point);
      continue;
    }
    const px = worldPx(point, zoom);
    const group = groups.find(
      (candidate) => Math.hypot(candidate.x - px.x, candidate.y - px.y) <= radius,
    );
    if (group) {
      group.members.push(point);
      // Keep the group's center at the members' average so it sits among them.
      const n = group.members.length;
      group.x += (px.x - group.x) / n;
      group.y += (px.y - group.y) / n;
    } else {
      groups.push({ x: px.x, y: px.y, members: [point] });
    }
  }

  const clusters: PointCluster<T>[] = [];
  for (const group of groups) {
    if (group.members.length === 1) {
      singles.push(group.members[0]);
      continue;
    }
    const lat = group.members.reduce((sum, member) => sum + member.lat, 0) / group.members.length;
    const lng = group.members.reduce((sum, member) => sum + member.lng, 0) / group.members.length;
    clusters.push({
      id: `cluster-${group.members.map((member) => member.id).sort().join("|")}`,
      lat,
      lng,
      members: group.members,
    });
  }
  return { singles, clusters };
}
