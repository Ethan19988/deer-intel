import { newestSavedWaybackRelease } from "@/lib/offlineMaps";

export type WaybackRelease = {
  year: string;
  release: string;
  date: string;
};

// Last good release list, kept so the map asks for the same imagery release
// offline that an offline pack saved its tiles under. Without it the map falls
// back to a pinned release and every saved tile misses the cache.
const RELEASES_STORAGE_KEY = "deer-intel:wayback-releases";

// Offline fallback: the last list seen, with the release the newest offline
// pack was saved under moved to the front so the map requests tiles that are
// actually in the cache.
function readCachedReleases(): WaybackRelease[] {
  if (typeof window === "undefined") return [];

  let releases: WaybackRelease[] = [];
  try {
    const raw = window.localStorage.getItem(RELEASES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed)) releases = parsed as WaybackRelease[];
  } catch {
    releases = [];
  }

  const packRelease = newestSavedWaybackRelease();
  if (!packRelease) return releases;

  const saved = releases.find((entry) => entry.release === packRelease) ?? {
    year: "Saved",
    release: packRelease,
    date: "",
  };

  return [saved, ...releases.filter((entry) => entry.release !== packRelease)];
}

function writeCachedReleases(releases: WaybackRelease[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RELEASES_STORAGE_KEY, JSON.stringify(releases));
  } catch {
    // Best effort; storage may be full or blocked.
  }
}

// Fetches the available imagery years from our same-origin API route (which
// proxies Esri Wayback). Returns most-recent first; the first entry is the
// current imagery. Falls back to the last list seen when offline.
export async function fetchWaybackReleases(): Promise<WaybackRelease[]> {
  try {
    const response = await fetch("/api/wayback-imagery");
    if (!response.ok) return readCachedReleases();

    const data = (await response.json()) as { releases?: WaybackRelease[] };
    const releases = Array.isArray(data.releases) ? data.releases : [];

    if (releases.length > 0) writeCachedReleases(releases);

    return releases.length > 0 ? releases : readCachedReleases();
  } catch {
    return readCachedReleases();
  }
}

export function waybackTileUrl(release: string): string {
  return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`;
}
