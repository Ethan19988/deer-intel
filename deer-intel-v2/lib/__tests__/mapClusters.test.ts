import { describe, expect, it } from "vitest";
import { CLUSTER_MAX_ZOOM, clusterPoints, zoomToSeparate } from "@/lib/mapClusters";

// 0.0001° ≈ 11 m. At zoom 14 a pixel is ~7 m at this latitude.
const pt = (id: string, north: number, east: number) => ({
  id,
  lat: 41.5 + north * 0.0001,
  lng: -77.5 + east * 0.0001,
});

describe("clusterPoints", () => {
  const pile = [pt("a", 0, 0), pt("b", 1, 1), pt("c", 2, 0), pt("far", 60, 60)];

  it("merges pins stacked together when zoomed out", () => {
    const { singles, clusters } = clusterPoints(pile, 14);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(["a", "b", "c"]);
    expect(singles.map((s) => s.id)).toEqual(["far"]);
  });

  it("draws every pin on its own when zoomed in", () => {
    const { singles, clusters } = clusterPoints(pile, 17);
    expect(clusters).toHaveLength(0);
    expect(singles).toHaveLength(4);
  });

  it("never folds the selected pin into a bubble", () => {
    const { singles, clusters } = clusterPoints(pile, 14, { keepSingle: "b" });
    expect(singles.map((s) => s.id).sort()).toEqual(["b", "far"]);
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(["a", "c"]);
  });

  it("gives a stable id for the same members", () => {
    const first = clusterPoints(pile, 14).clusters[0].id;
    const second = clusterPoints([...pile].reverse(), 14).clusters[0].id;
    expect(first).toBe(second);
  });
});

describe("zoomToSeparate", () => {
  it("zooms just far enough for the group to split", () => {
    const group = [pt("a", 0, 0), pt("b", 3, 3)];
    const zoom = zoomToSeparate(group, 12);
    expect(zoom).toBeGreaterThan(12);
    expect(clusterPoints(group, zoom).clusters).toHaveLength(0);
    expect(clusterPoints(group, zoom - 1).clusters).toHaveLength(1);
  });

  it("stops at the no-grouping zoom for pins on the same spot", () => {
    expect(zoomToSeparate([pt("a", 0, 0), pt("b", 0, 0)], 12)).toBe(CLUSTER_MAX_ZOOM);
  });
});
