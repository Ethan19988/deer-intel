import { describe, expect, it } from "vitest";
import {
  MAX_QUERY_TILES_PER_SOURCE,
  offlineQueryTrimNote,
  planOfflinePack,
  xyzTileBounds,
  type OfflineTileSource,
} from "@/lib/offlineMaps";
import {
  TRAILS_OFFLINE_SOURCE,
  elementToTrail,
  mergeTrails,
  trailsFromSavedTiles,
  type Trail,
} from "@/lib/trailQuery";
import {
  CONTOUR_LABELS_OFFLINE_SOURCE,
  CONTOUR_MAX_LABELS,
  CONTOUR_MAX_PER_ELEV,
  pickContourLabels,
  readElevation,
  segmentsFromSavedTiles,
} from "@/lib/contourQuery";

const imagery: OfflineTileSource = {
  url: "https://tiles.example.com/{z}/{x}/{y}.png",
  maxNativeZoom: 17,
};
// About a hunt area: ~1.5 km square.
const huntArea = { south: 41.4, west: -77.2, north: 41.414, east: -77.182 };
// A whole county — far past the query caps.
const county = { south: 41.0, west: -78.0, north: 41.6, east: -77.0 };

describe("offline query layers in a pack plan", () => {
  it("saves trails and contour labels for a hunt-sized area", () => {
    const plan = planOfflinePack(
      [imagery, TRAILS_OFFLINE_SOURCE, CONTOUR_LABELS_OFFLINE_SOURCE],
      huntArea,
      13,
      17,
    );
    expect(plan.sources.some((s) => s.query === "trails")).toBe(true);
    expect(plan.sources.some((s) => s.query === "contour-labels")).toBe(true);
    expect(plan.skippedQueries).toBeUndefined();
    expect(offlineQueryTrimNote(plan)).toBe("");
    expect(plan.tileCount).toBeLessThanOrEqual(6000);
  });

  it("saves query tiles even when the pack stops shallower than their zoom", () => {
    const withTrails = planOfflinePack([imagery, TRAILS_OFFLINE_SOURCE], huntArea, 10, 11);
    const without = planOfflinePack([imagery], huntArea, 10, 11);
    expect(withTrails.tileCount).toBeGreaterThan(without.tileCount);
  });

  it("leaves them out of a too-big area and says so", () => {
    const plan = planOfflinePack(
      [imagery, TRAILS_OFFLINE_SOURCE, CONTOUR_LABELS_OFFLINE_SOURCE],
      county,
      9,
      11,
    );
    expect(plan.sources.some((s) => s.kind === "query")).toBe(false);
    expect(plan.skippedQueries).toEqual(["trails", "contour-labels"]);
    expect(offlineQueryTrimNote(plan)).toMatch(/^Trails and contour elevation numbers aren't included/);
  });

  it("keeps each query source under its own cap", () => {
    expect(TRAILS_OFFLINE_SOURCE.maxTiles).toBeLessThanOrEqual(MAX_QUERY_TILES_PER_SOURCE);
    expect(CONTOUR_LABELS_OFFLINE_SOURCE.maxTiles).toBeLessThanOrEqual(MAX_QUERY_TILES_PER_SOURCE);
  });
});

describe("xyzTileBounds", () => {
  it("covers the tile and tiles the world edge to edge", () => {
    const a = xyzTileBounds(13, 2340, 3040);
    const b = xyzTileBounds(13, 2341, 3040);
    expect(a.east).toBeCloseTo(b.west, 10);
    expect(a.north).toBeGreaterThan(a.south);
    expect(xyzTileBounds(0, 0, 0).west).toBe(-180);
  });
});

describe("saved trails", () => {
  const trail = (id: string): Trail => ({
    id,
    kind: "foot",
    label: "Foot path",
    detail: "",
    positions: [
      [41.4, -77.2],
      [41.41, -77.19],
    ],
  });

  it("merges tiles without duplicating a trail crossing a seam", () => {
    const merged = trailsFromSavedTiles([
      { trails: [trail("osm-1"), trail("usgs-37-2-0")] },
      { trails: [trail("osm-1")] },
      null,
      { nope: true },
    ]);
    expect(merged.map((t) => t.id)).toEqual(["osm-1", "usgs-37-2-0"]);
    expect(mergeTrails([[trail("a")], [trail("a"), trail("b")]])).toHaveLength(2);
  });

  it("reads Overpass ways the same as the live layer", () => {
    const t = elementToTrail({
      type: "way",
      id: 7,
      tags: { highway: "track", surface: "dirt" },
      geometry: [
        { lat: 41, lon: -77 },
        { lat: 41.01, lon: -77.01 },
      ],
    });
    expect(t).toMatchObject({ id: "osm-7", kind: "track", detail: "dirt" });
    expect(elementToTrail({ type: "way", id: 8, tags: { area: "yes" }, geometry: [] })).toBeNull();
  });
});

describe("contour labels", () => {
  const view = { south: 41.4, west: -77.2, north: 41.41, east: -77.19 };

  it("reads the elevation field case-tolerantly", () => {
    expect(readElevation({ ContourElevation: 1240 })).toBe(1240);
    expect(readElevation({ other: 1 })).toBeNull();
  });

  it("spreads labels on a grid and caps each elevation", () => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 20; i++) pts.push([-77.2 + i * 0.0005, 41.4 + i * 0.0005]);
    const labels = pickContourLabels([{ elev: 1300, pts }], view);
    expect(labels.length).toBeLessThanOrEqual(CONTOUR_MAX_PER_ELEV);
    expect(new Set(labels.map((l) => l.id)).size).toBe(labels.length);

    const many = Array.from({ length: 60 }, (_, i) => ({ elev: 1000 + i * 20, pts }));
    expect(pickContourLabels(many, view).length).toBeLessThanOrEqual(CONTOUR_MAX_LABELS);
  });

  it("drops points outside the view and malformed saved tiles", () => {
    const segments = segmentsFromSavedTiles([
      { segments: [{ elev: 1200, pts: [[-78, 40]] }] },
      { segments: "bad" },
      null,
    ]);
    expect(segments).toHaveLength(1);
    expect(pickContourLabels(segments, view)).toEqual([]);
  });
});
