import { describe, expect, it } from "vitest";
import { getRecentActivity } from "@/lib/propertyDashboard";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";

const snapshot = {
  temperature: "",
  windDirection: "",
  windSpeed: "",
  conditions: "",
  moonPhase: "",
  source: "manual" as const,
};

function check(id: string, overrides: Partial<CameraCheck> = {}): CameraCheck {
  return {
    id,
    propertyId: "p1",
    cameraId: "c1",
    date: "2026-11-05",
    batteryPercent: "",
    sdCardPercent: "",
    weatherSnapshot: snapshot,
    bucks: 0,
    does: 0,
    fawns: 0,
    turkeys: 0,
    bears: 0,
    coyotes: 0,
    otherWildlife: "",
    notes: "",
    ...overrides,
  };
}

function sit(id: string, overrides: Partial<HuntLogEntry> = {}): HuntLogEntry {
  return {
    id,
    propertyId: "p1",
    standId: "s1",
    standName: "Ridge Stand",
    date: "2026-11-01",
    startTime: "",
    endTime: "",
    windDirection: "NW",
    windSpeed: "",
    temperature: "",
    weather: "",
    moonPhase: "",
    weatherSnapshot: snapshot,
    bucks: 0,
    does: 0,
    fawns: 0,
    shotOpportunity: false,
    harvest: false,
    notes: "",
    ...overrides,
  };
}

describe("property recent activity", () => {
  it("includes camera checks alongside sits, newest first", () => {
    const activity = getRecentActivity({
      pins: [],
      hunts: [sit("h1")],
      cameraChecks: [check("k1", { bucks: 1, does: 2 })],
      cameras: [{ id: "c1", name: "Creek Cam" } as Camera],
    });

    expect(activity.map((item) => item.title)).toEqual([
      "Camera checked",
      "Sit logged",
    ]);
    expect(activity[0].description).toBe("Creek Cam - 1 buck, 2 does");
    expect(activity[1].description).toBe("Ridge Stand - NW");
  });

  it("still works without camera checks", () => {
    expect(getRecentActivity({ pins: [], hunts: [] })).toEqual([]);
  });
});
