export const dynamic = "force-dynamic";

async function fetchJson(url: string, timeoutMs = 6000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Esri's lightweight typeahead. Biased to the current map location (passed as
// lat/lng) so nearby addresses rank first — central PA suggests PA towns, not a
// same-named street in Maine. Like the main geocoder, the Esri endpoint has no
// CORS headers, so it runs server-side. Best-effort: any failure returns [] so
// the search box keeps working without suggestions.
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const text = params.get("q")?.trim() ?? "";

  if (text.length < 3) return Response.json({ suggestions: [] });

  const url = new URL(
    "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest",
  );
  url.searchParams.set("f", "json");
  url.searchParams.set("text", text);
  url.searchParams.set("maxSuggestions", "6");
  url.searchParams.set("countryCode", "USA");

  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    url.searchParams.set("location", `${lng},${lat}`);
  }

  try {
    const data = await fetchJson(url.toString());
    const suggestions = (
      (data as { suggestions?: Array<{ text?: string }> }).suggestions ?? []
    )
      .map((item) => item.text)
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      )
      .slice(0, 6);

    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
