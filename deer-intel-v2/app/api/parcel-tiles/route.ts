// The statewide parcel tiles (pa-parcels.pmtiles, ~342 MB) are hosted as a
// GitHub Release asset instead of in the deployment, but that CDN sends no CORS
// header, so the browser can't range-fetch it directly (same limitation as the
// Wayback config route). This same-origin route forwards the map's HTTP range
// requests to the release asset and streams the bytes back, so protomaps can
// read the archive without a cross-origin fetch.

const TILES_URL =
  "https://github.com/Ethan19988/deer-intel/releases/download/parcel-tiles/pa-parcels.pmtiles";

// Next requires these segment configs to be literals, not references.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASS_THROUGH_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

export async function GET(request: Request) {
  const range = request.headers.get("range");

  const upstream = await fetch(TILES_URL, {
    headers: range ? { Range: range } : {},
  });

  const headers = new Headers();
  for (const name of PASS_THROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Let the CDN cache ranges; the asset is immutable until the tiles rebuild.
  headers.set("cache-control", "public, max-age=86400");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
