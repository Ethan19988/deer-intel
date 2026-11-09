import { describe, expect, it } from "vitest";
import {
  BATTERY_CHOICES,
  checkFormValuesFromCheck,
  choiceForValue,
  createCameraCheckFromValues,
  localDateInput,
  newCameraCheckFormValues,
  SD_CARD_CHOICES,
} from "@/lib/cameraCheckFormValues";
import {
  addCameraCheckToState,
  deleteCameraCheckFromState,
  latestCheckForCamera,
  updateCameraCheckInState,
} from "@/lib/cameraChecks";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { PhotoRecord } from "@/types/photo";

const check: CameraCheck = {
  id: "c1",
  propertyId: "p1",
  cameraId: "cam1",
  date: "2026-11-02",
  batteryPercent: "50",
  sdCardPercent: "100",
  signalStrength: "70",
  weatherSnapshot: {
    temperature: "38",
    windDirection: "NW",
    windSpeed: "6 mph",
    conditions: "Clear",
    moonPhase: "Waning",
    source: "live",
  },
  bucks: 2,
  does: 5,
  fawns: 0,
  turkeys: 1,
  bears: 0,
  coyotes: 0,
  otherWildlife: "Fox",
  notes: "Scrape opened up",
};

function state(
  cameraChecks: CameraCheck[],
  photoRecords: PhotoRecord[] = [],
): DeerIntelState {
  return {
    version: 2,
    properties: [],
    selectedPropertyId: "",
    cameras: [],
    cameraChecks,
    stands: [],
    pins: [],
    hunts: [],
    photoRecords,
    deerProfiles: [],
    walkTracks: [],
    documents: [],
  };
}

function photo(id: string, cameraCheckId: string): PhotoRecord {
  return {
    id,
    propertyId: "p1",
    cameraSiteId: "cam1",
    cameraCheckId,
    fileName: `${id}.jpg`,
    photoDate: "2026-11-01",
    species: "Deer",
    notes: "",
    createdAt: "2026-11-02T12:00:00.000Z",
  } as PhotoRecord;
}

describe("new camera check form", () => {
  it("defaults the date to today in local time", () => {
    expect(newCameraCheckFormValues(new Date(2026, 10, 8, 23, 50)).date).toBe(
      "2026-11-08",
    );
    expect(localDateInput(new Date(2026, 0, 2, 0, 5))).toBe("2026-01-02");
  });

  it("starts every other field blank", () => {
    const values = newCameraCheckFormValues(new Date(2026, 10, 8));

    expect(values.bucks).toBe("");
    expect(values.batteryPercent).toBe("");
    expect(values.weatherSource).toBe("manual");
  });
});

describe("checkFormValuesFromCheck", () => {
  it("round-trips a saved check through the form unchanged", () => {
    const values = checkFormValuesFromCheck(check);

    expect(values.date).toBe("2026-11-02");
    expect(values.weather).toBe("Clear");
    expect(values.weatherSource).toBe("live");
    expect(values.fawns).toBe("");
    expect(values.bucks).toBe("2");

    const rebuilt = createCameraCheckFromValues({
      id: check.id,
      propertyId: check.propertyId,
      cameraId: check.cameraId,
      values,
    });

    expect(rebuilt).toEqual(check);
  });

  it("handles a check with no signal reading", () => {
    const values = checkFormValuesFromCheck({
      ...check,
      signalStrength: undefined,
    });

    expect(values.signalStrength).toBe("");
  });
});

describe("quick-pick choices", () => {
  it("matches stored values with or without a percent sign", () => {
    expect(choiceForValue(BATTERY_CHOICES, "50")?.label).toBe("Half");
    expect(choiceForValue(BATTERY_CHOICES, "100%")?.label).toBe("Full");
    expect(choiceForValue(SD_CARD_CHOICES, "missing")?.label).toBe("Missing");
  });

  it("matches nothing for blank or hand-typed values", () => {
    expect(choiceForValue(BATTERY_CHOICES, "")).toBeUndefined();
    expect(choiceForValue(BATTERY_CHOICES, "85")).toBeUndefined();
    expect(choiceForValue(SD_CARD_CHOICES, undefined)).toBeUndefined();
  });

  it("stores low picks at or under the 25% low-alert threshold", () => {
    for (const choice of [...BATTERY_CHOICES, ...SD_CARD_CHOICES]) {
      const number = Number(choice.value);
      if (choice.warn && Number.isFinite(number)) {
        expect(number).toBeLessThanOrEqual(25);
      }
    }
  });
});

describe("camera check state transforms", () => {
  it("adds a check once, even on a double save", () => {
    const once = addCameraCheckToState(state([]), check);
    const twice = addCameraCheckToState(once, check);

    expect(twice.cameraChecks).toHaveLength(1);
    expect(twice).toBe(once);
  });

  it("replaces an edited check and ignores a missing one", () => {
    const edited = { ...check, bucks: 3 };
    const next = updateCameraCheckInState(state([check]), edited);

    expect(next.cameraChecks[0].bucks).toBe(3);

    const unchanged = state([]);
    expect(updateCameraCheckInState(unchanged, edited)).toBe(unchanged);
  });

  it("deletes a check and detaches its photos instead of deleting them", () => {
    const next = deleteCameraCheckFromState(
      state([check], [photo("ph1", "c1"), photo("ph2", "other")]),
      "c1",
    );

    expect(next.cameraChecks).toHaveLength(0);
    expect(next.photoRecords.map((p) => p.cameraCheckId)).toEqual(["", "other"]);
  });

  it("finds the newest check for one camera", () => {
    const older = { ...check, id: "c0", date: "2026-10-20" };
    const otherCamera = { ...check, id: "c9", cameraId: "cam2", date: "2026-11-07" };

    expect(latestCheckForCamera([check, older, otherCamera], "cam1")?.id).toBe("c1");
    expect(latestCheckForCamera([otherCamera], "cam1")).toBeNull();
  });
});
