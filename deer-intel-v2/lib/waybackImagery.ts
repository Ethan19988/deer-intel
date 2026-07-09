export type WaybackRelease = {
  year: string;
  release: string;
  date: string;
};

// Fetches the available imagery years from our same-origin API route (which
// proxies Esri Wayback). Returns most-recent first; the first entry is the
// current imagery.
export async function fetchWaybackReleases(): Promise<WaybackRelease[]> {
  try {
    const response = await fetch("/api/wayback-imagery");
    if (!response.ok) return [];

    const data = (await response.json()) as { releases?: WaybackRelease[] };
    return Array.isArray(data.releases) ? data.releases : [];
  } catch {
    return [];
  }
}

export function waybackTileUrl(release: string): string {
  return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`;
}
