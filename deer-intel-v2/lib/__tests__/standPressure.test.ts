import { describe, expect, it } from "vitest";
import {
  getStandPressure,
  localDateKey,
  pickRestedStand,
  type StandPressure,
} from "@/lib/standPressure";
import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

function stand(id: string): Stand {
  return {
    id,
    propertyId: "p1",
    name: id,
    standType: "Ladder",
    bestWinds: "NW",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
  };
}

function sit(standId: string, date: string): HuntLogEntry {
  return { standId, date } as HuntLogEntry;
}

const TODAY = "2026-11-10";

describe("getStandPressure", () => {
  it("calls a stand burned after three sits in a week", () => {
    const hunts = [
      sit("a", "2026-11-04"),
      sit("a", "2026-11-07"),
      sit("a", "2026-11-08"),
    ];

    const pressure = getStandPressure(stand("a"), hunts, TODAY);

    expect(pressure.level).toBe("burned");
    expect(pressure.recentSits).toBe(3);
    expect(pressure.daysSinceLastSit).toBe(2);
  });

  it("flags a stand sat yesterday as pressured", () => {
    const pressure = getStandPressure(stand("a"), [sit("a", "2026-11-09")], TODAY);

    expect(pressure.level).toBe("pressured");
    expect(pressure.label).toBe("Sat yesterday");
  });

  it("ignores sits older than a week and other stands", () => {
    const hunts = [
      sit("a", "2026-11-01"),
      sit("a", "2026-10-30"),
      sit("b", "2026-11-09"),
    ];

    const pressure = getStandPressure(stand("a"), hunts, TODAY);

    expect(pressure.level).toBe("fresh");
    expect(pressure.label).toBe("Rested 9 days");
  });

  it("ignores future-dated (planned) entries", () => {
    const pressure = getStandPressure(stand("a"), [sit("a", "2026-11-12")], TODAY);

    expect(pressure.level).toBe("fresh");
    expect(pressure.daysSinceLastSit).toBeNull();
  });

  it("formats a local date key", () => {
    expect(localDateKey(new Date(2026, 10, 3, 23, 30))).toBe("2026-11-03");
  });
});

describe("pickRestedStand", () => {
  it("picks the most-rested good-wind stand and skips burned ones", () => {
    const pressure = new Map<string, StandPressure>([
      ["a", { level: "burned", recentSits: 3, daysSinceLastSit: 0, label: "" }],
      ["b", { level: "fresh", recentSits: 0, daysSinceLastSit: 3, label: "" }],
      ["c", { level: "fresh", recentSits: 0, daysSinceLastSit: 8, label: "" }],
    ]);

    expect(pickRestedStand([stand("a"), stand("b"), stand("c")], pressure)?.id).toBe("c");
  });

  it("treats never-sat as most rested without breaking the sort", () => {
    const pressure = new Map<string, StandPressure>([
      ["a", { level: "fresh", recentSits: 0, daysSinceLastSit: null, label: "" }],
      ["b", { level: "fresh", recentSits: 0, daysSinceLastSit: null, label: "" }],
      ["c", { level: "fresh", recentSits: 0, daysSinceLastSit: 5, label: "" }],
    ]);

    expect(["a", "b"]).toContain(
      pickRestedStand([stand("c"), stand("a"), stand("b")], pressure)?.id,
    );
  });

  it("returns null when every good-wind stand is burned", () => {
    const pressure = new Map<string, StandPressure>([
      ["a", { level: "burned", recentSits: 4, daysSinceLastSit: 0, label: "" }],
    ]);

    expect(pickRestedStand([stand("a")], pressure)).toBeNull();
  });
});
