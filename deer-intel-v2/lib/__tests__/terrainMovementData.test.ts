import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveTerrainSet, terrainSetExtent } from "@/lib/terrainMovementData";
import { playbookKeyOf, terrainPlaybook } from "@/lib/terrainPlaybook";
import type { TerrainMovementSet } from "@/lib/terrainMovement";

const SET: TerrainMovementSet = {
  areaName: "Test Ridge",
  center: [41.4, -78.3],
  source: "test",
  features: [
    { id: "t-pinch-1", kind: "pinch", title: "Saddle", detail: "", point: [41.41, -78.31] },
    {
      id: "t-bench-1",
      kind: "travel",
      title: "Bench",
      detail: "",
      line: [
        [41.39, -78.29],
        [41.395, -78.295],
      ],
    },
  ],
};

describe("resolveTerrainSet", () => {
  it("only matches a point inside the set's extent", () => {
    expect(terrainSetExtent(SET)).toEqual({
      minLat: 41.39,
      minLng: -78.31,
      maxLat: 41.41,
      maxLng: -78.29,
    });
    expect(resolveTerrainSet({ lat: 41.4, lng: -78.3 }, [SET])).toBe(SET);
    // ~3 km away: the old 6 km radius matched this; the extent doesn't.
    expect(resolveTerrainSet({ lat: 41.427, lng: -78.3 }, [SET])).toBeNull();
    expect(resolveTerrainSet(null, [SET])).toBeNull();
  });
});

describe("terrainPlaybook", () => {
  it("gives draws and water crossings their own playbooks", () => {
    expect(playbookKeyOf({ id: "moore-hill-draw-3", kind: "travel" })).toBe("draw");
    expect(playbookKeyOf({ id: "t-draw-4-5", kind: "travel" })).toBe("draw");
    expect(playbookKeyOf({ id: "t-bench-4-5", kind: "travel" })).toBe("bench");
    expect(playbookKeyOf({ id: "moore-hill-route-1-2", kind: "travel" })).toBe("route");
    expect(playbookKeyOf({ id: "moore-hill-xing-0", kind: "pinch" })).toBe("crossing");
    expect(playbookKeyOf({ id: "moore-hill-pinch-0", kind: "pinch" })).toBe("pinch");
  });

  it("never tells the hunter to sit a bench's downwind end or a draw's low end at dawn", () => {
    const bench = terrainPlaybook({ id: "t-bench-1", kind: "travel" });
    const stand = bench.moves.find((move) => move.label === "Stand")?.text ?? "";
    expect(stand).toMatch(/downwind side of the bench trail on a crosswind/);
    expect(stand).not.toMatch(/downwind end/i);

    const draw = terrainPlaybook({ id: "t-draw-1", kind: "travel" });
    const drawStand = draw.moves.find((move) => move.label === "Stand")?.text ?? "";
    expect(drawStand).toMatch(/first light sit the upper part/);
  });
});

describe("generated terrain sets", () => {
  const dir = fileURLToPath(new URL("../generated/", import.meta.url));
  const files = readdirSync(dir).filter((name: string) => /^terrain_movement\..+\.json$/.test(name));

  it("carry no backwards bedding / bench / draw advice", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const text = readFileSync(dir + name, "utf8");
      expect(text).not.toMatch(/Beds hold a/);
      expect(text).not.toMatch(/Approach from the (ridge|high side)/);
      expect(text).not.toMatch(/sit the downwind end/);
      expect(text).not.toMatch(/Hunt the lower end at dawn/);
      expect(text).not.toMatch(/hunt the low end at first light/);
    }
  });
});
