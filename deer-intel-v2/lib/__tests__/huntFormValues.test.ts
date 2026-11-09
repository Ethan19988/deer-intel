import { describe, expect, it } from "vitest";
import {
  createHuntFromValues,
  EMPTY_HUNT_FORM_VALUES,
  newHuntFormValues,
  sitPeriodTimes,
} from "@/lib/huntFormValues";
import type { Stand } from "@/types/stand";

describe("newHuntFormValues", () => {
  it("defaults to today and the current local time", () => {
    const values = newHuntFormValues(new Date(2026, 10, 7, 15, 4));

    expect(values.date).toBe("2026-11-07");
    expect(values.startTime).toBe("15:04");
    expect(values.bucks).toBe("");
    expect(values.harvest).toBe("No");
  });

  it("keeps the property and stand you were just on", () => {
    const values = newHuntFormValues(new Date(2026, 0, 2, 6, 30), {
      propertyId: "p1",
      standId: "s1",
    });

    expect(values.propertyId).toBe("p1");
    expect(values.standId).toBe("s1");
    expect(values.date).toBe("2026-01-02");
  });
});

describe("after-the-fact sits", () => {
  it("leaves In empty when not starting now", () => {
    const values = newHuntFormValues(new Date(2026, 10, 8, 19, 30), {}, { startNow: false });

    expect(values.date).toBe("2026-11-08");
    expect(values.startTime).toBe("");
    expect(values.endTime).toBe("");
  });

  it("fills This evening with Out = now when logged soon after", () => {
    expect(sitPeriodTimes("evening", new Date(2026, 10, 8, 17, 50))).toEqual({
      date: "2026-11-08",
      startTime: "15:00",
      endTime: "17:50",
    });
  });

  it("uses the typical window when logged much later", () => {
    expect(sitPeriodTimes("morning", new Date(2026, 10, 8, 20, 0))).toEqual({
      date: "2026-11-08",
      startTime: "06:00",
      endTime: "10:00",
    });
  });
});

describe("createHuntFromValues with a deleted stand", () => {
  const stand: Stand = {
    id: "s1",
    propertyId: "p1",
    name: "Oak Ridge",
    standType: "Ladder",
    bestWinds: "",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
  };
  const values = {
    ...EMPTY_HUNT_FORM_VALUES,
    propertyId: "p1",
    standId: "gone",
    date: "2026-11-01",
  };

  it("still fails without a fallback", () => {
    expect(createHuntFromValues({ id: "h1", values, stands: [stand] })).toBeNull();
  });

  it("keeps the saved stand id and name with a fallback", () => {
    const hunt = createHuntFromValues({
      id: "h1",
      values,
      stands: [stand],
      fallbackStandName: "Old Ladder",
    });

    expect(hunt?.standId).toBe("gone");
    expect(hunt?.standName).toBe("Old Ladder");
  });

  it("does not fall back for a stand on another property", () => {
    expect(
      createHuntFromValues({
        id: "h1",
        values: { ...values, propertyId: "p2", standId: "s1" },
        stands: [stand],
        fallbackStandName: "Oak Ridge",
      }),
    ).toBeNull();
  });
});
