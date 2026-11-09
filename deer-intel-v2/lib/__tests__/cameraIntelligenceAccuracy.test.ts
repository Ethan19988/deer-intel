import { describe, expect, it } from "vitest";
import { getCameraIntelligenceSummary } from "@/lib/cameraIntelligence";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { PhotoRecord } from "@/types/photo";

const now = new Date(2026, 10, 8, 12, 0);

function camera(id: string, status: Camera["status"] = "Active"): Camera {
  return { id, propertyId: "p1", name: `Cam ${id}`, status } as unknown as Camera;
}

function check(cameraId: string, date: string, extra: Partial<CameraCheck> = {}): CameraCheck {
  return {
    id: `chk-${cameraId}-${date}`,
    propertyId: "p1",
    cameraId,
    date,
    batteryPercent: "",
    sdCardPercent: "",
    bucks: 0,
    does: 0,
    fawns: 0,
    turkeys: 0,
    bears: 0,
    coyotes: 0,
    otherWildlife: "",
    notes: "",
    ...extra,
  } as CameraCheck;
}

function photo(id: string, species: string, extra: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id,
    propertyId: "p1",
    cameraSiteId: "c1",
    cameraCheckId: "",
    fileName: `${id}.jpg`,
    photoDate: "2026-11-01T17:00",
    species,
    notes: "",
    createdAt: "",
    ...extra,
  };
}

function summary(cameras: Camera[], cameraChecks: CameraCheck[], photoRecords: PhotoRecord[] = []) {
  return getCameraIntelligenceSummary({ cameras, cameraChecks, photoRecords, now });
}

describe("camera visit rules match cameraHealth", () => {
  it("flags an active camera unchecked for more than 14 days", () => {
    const result = summary([camera("c1")], [check("c1", "2026-10-20")]);
    expect(result.camerasWithNoRecentChecks).toEqual([
      expect.objectContaining({ cameraId: "c1", reason: "Check due" }),
    ]);
  });

  it("does not flag a camera checked within 14 days", () => {
    expect(summary([camera("c1")], [check("c1", "2026-10-30")]).camerasWithNoRecentChecks).toEqual([]);
  });

  it("never flags an inactive camera, even with a dead battery", () => {
    const result = summary(
      [camera("c1", "Inactive")],
      [check("c1", "2026-01-01", { batteryPercent: "0" })],
    );
    expect(result.camerasWithNoRecentChecks).toEqual([]);
    expect(result.attentionItems).toEqual([]);
  });

  it("notes a never-checked camera neutrally", () => {
    const [item] = summary([camera("c1")], []).camerasWithNoRecentChecks;
    expect(item).toMatchObject({ reason: "No checks yet", tone: "note" });
  });

  it("reports a low battery on an active camera", () => {
    const result = summary([camera("c1")], [check("c1", "2026-11-05", { batteryPercent: "20" })]);
    expect(result.attentionItems).toEqual([
      expect.objectContaining({ reason: "Battery low", detail: "20% battery reported." }),
    ]);
  });
});

describe("photo counts and mature bucks", () => {
  it("counts each deer in a multi-deer photo", () => {
    const result = summary([], [], [
      photo("a", "Doe", { deerCount: 3 }),
      photo("b", "Buck"),
      photo("c", "No animal"),
    ]);
    expect(result.activityCounts).toEqual({ bucks: 1, does: 3, fawns: 0 });
  });

  it("uses the age class for mature bucks, the notes only as a fallback", () => {
    const young = summary([camera("c1")], [], [
      photo("a", "Buck", { ageClass: "2.5", notes: "mature buck" }),
    ]);
    expect(young.matureBuckActivity.badge).toBeUndefined();

    const mature = summary([camera("c1")], [], [photo("b", "Buck", { ageClass: "3.5" })]);
    expect(mature.matureBuckActivity.badge).toBe("Mature Buck");

    const legacy = summary([camera("c1")], [], [photo("c", "Buck", { notes: "shooter" })]);
    expect(legacy.matureBuckActivity.badge).toBe("Mature Buck");
  });

  it("ignores false triggers and untrusted times in the best photo time", () => {
    const result = summary([camera("c1")], [], [
      photo("a", "No animal", { photoDate: "2026-11-01T12:00" }),
      photo("b", "Doe", { photoDate: "2026-11-01T12:30", captureTimeSource: "file" }),
      photo("c", "Doe", { photoDate: "2026-11-02T06:30" }),
    ]);
    expect(result.bestPhotoTime.title).toBe("Morning");
  });
});
