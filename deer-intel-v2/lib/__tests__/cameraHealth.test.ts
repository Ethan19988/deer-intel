import { describe, expect, it } from "vitest";
import {
  cameraAttentionLine,
  camerasNeedingVisit,
  getCameraHealth,
  readPercent,
} from "@/lib/cameraHealth";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";

const NOW = new Date(2026, 10, 8, 9, 0);

function camera(id: string, name: string, status: Camera["status"] = "Active"): Camera {
  return {
    id,
    propertyId: "p1",
    name,
    cameraType: "Standard",
    manufacturer: "",
    model: "",
    status,
    locationNotes: "",
    notes: "",
  };
}

function check(
  cameraId: string,
  date: string,
  batteryPercent = "100",
  sdCardPercent = "100",
): CameraCheck {
  return {
    id: `${cameraId}-${date}`,
    propertyId: "p1",
    cameraId,
    date,
    batteryPercent,
    sdCardPercent,
    weatherSnapshot: {} as CameraCheck["weatherSnapshot"],
    bucks: 0,
    does: 0,
    fawns: 0,
    turkeys: 0,
    bears: 0,
    coyotes: 0,
    otherWildlife: "",
    notes: "",
  };
}

const kinds = (cam: Camera, checks: CameraCheck[]) =>
  getCameraHealth(cam, checks, { now: NOW }).issues.map((issue) => issue.kind);

describe("readPercent", () => {
  it("reads numbers with or without a percent sign", () => {
    expect(readPercent("85")).toBe(85);
    expect(readPercent(" 20% ")).toBe(20);
    expect(readPercent("Missing")).toBeNull();
    expect(readPercent("")).toBeNull();
  });
});

describe("getCameraHealth", () => {
  const cam = camera("c1", "Creek Cam");

  it("is fine after a recent check with a full battery and card", () => {
    expect(kinds(cam, [check("c1", "2026-11-01")])).toEqual([]);
  });

  it("flags an active camera unchecked for more than 14 days", () => {
    const health = getCameraHealth(cam, [check("c1", "2026-10-20")], { now: NOW });
    expect(health.daysSinceCheck).toBe(19);
    expect(health.issues).toEqual([{ kind: "overdue", label: "19d unchecked", days: 19 }]);
    // Exactly 14 days is still fine.
    expect(kinds(cam, [check("c1", "2026-10-25")])).toEqual([]);
  });

  it("honors a custom stale window", () => {
    const health = getCameraHealth(cam, [check("c1", "2026-11-01")], { now: NOW, staleDays: 5 });
    expect(health.issues.map((issue) => issue.kind)).toEqual(["overdue"]);
  });

  it("reads the quick-check battery buckets", () => {
    expect(kinds(cam, [check("c1", "2026-11-07", "50")])).toEqual([]);
    expect(kinds(cam, [check("c1", "2026-11-07", "20")])).toEqual(["batteryLow"]);
    expect(kinds(cam, [check("c1", "2026-11-07", "25%")])).toEqual(["batteryLow"]);
    expect(kinds(cam, [check("c1", "2026-11-07", "0")])).toEqual(["batteryDead"]);
  });

  it("reads the quick-check SD buckets", () => {
    expect(kinds(cam, [check("c1", "2026-11-07", "100", "0")])).toEqual(["sdFull"]);
    expect(kinds(cam, [check("c1", "2026-11-07", "100", "Missing")])).toEqual(["sdMissing"]);
    expect(kinds(cam, [check("c1", "2026-11-07", "100", "15")])).toEqual(["sdLow"]);
  });

  it("uses only the newest check", () => {
    expect(
      kinds(cam, [check("c1", "2026-10-01", "0", "0"), check("c1", "2026-11-06")]),
    ).toEqual([]);
  });

  it("orders issues most urgent first", () => {
    expect(kinds(cam, [check("c1", "2026-10-01", "20", "Missing")])).toEqual([
      "sdMissing",
      "batteryLow",
      "overdue",
    ]);
  });

  it("ignores inactive and never-checked cameras", () => {
    expect(kinds(camera("c2", "Pulled", "Inactive"), [check("c2", "2026-09-01", "0")])).toEqual([]);
    expect(kinds(cam, [])).toEqual([]);
  });
});

describe("cameraAttentionLine", () => {
  const cameras = [camera("a", "Ridge Cam"), camera("b", "Creek Cam"), camera("c", "Field Cam")];

  it("is null when every camera is fine", () => {
    expect(cameraAttentionLine(cameras, [check("a", "2026-11-07")], { now: NOW })).toBeNull();
  });

  it("counts cameras and leads with the most urgent one", () => {
    const checks = [
      check("a", "2026-10-01"),
      check("b", "2026-11-05", "20"),
      check("c", "2026-11-07"),
    ];
    expect(camerasNeedingVisit(cameras, checks, { now: NOW }).map((h) => h.camera.name)).toEqual([
      "Creek Cam",
      "Ridge Cam",
    ]);
    expect(cameraAttentionLine(cameras, checks, { now: NOW })).toBe(
      "2 cameras need a visit · Creek Cam battery low",
    );
  });

  it("phrases a single overdue camera", () => {
    expect(cameraAttentionLine([cameras[0]], [check("a", "2026-10-20")], { now: NOW })).toBe(
      "1 camera needs a visit · Ridge Cam not checked in 19 days",
    );
  });
});
