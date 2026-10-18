import { describe, expect, it } from "vitest";
import { buildHourlyActivity, hourLabel } from "@/lib/hourlyActivity";
import type { PhotoRecord } from "@/types/photo";

function photo(photoDate: string, species = "Doe", extra: Partial<PhotoRecord> = {}): PhotoRecord {
  return { id: photoDate + species, propertyId: "p", cameraSiteId: "c", cameraCheckId: "", fileName: "", photoDate, species, notes: "", createdAt: "", ...extra };
}

const now = new Date(2026, 9, 18, 12, 0);

describe("buildHourlyActivity", () => {
  it("buckets deer photos by local hour and counts bucks", () => {
    const activity = buildHourlyActivity(
      [
        photo("2026-10-17T17:20", "Deer (Antlered)"),
        photo("2026-10-16T17:55"),
        photo("2026-10-15T06:40", "Doe", { buckNames: ["Big 8"] }),
      ],
      now,
    );

    expect(activity.counts[17]).toBe(2);
    expect(activity.counts[6]).toBe(1);
    expect(activity.bucks[17]).toBe(1);
    expect(activity.bucks[6]).toBe(1);
    expect(activity.total).toBe(3);
  });

  it("skips date-only photos, other animals, and photos outside the window", () => {
    const activity = buildHourlyActivity(
      [
        photo("2026-10-17"),
        photo("2026-10-17T18:00", "Black bear"),
        photo("2026-07-01T18:00"),
        photo("2026-10-19T18:00"),
      ],
      now,
    );

    expect(activity.total).toBe(0);
  });

  it("finds the busiest two-hour window once there's enough data", () => {
    const evening = ["17:05", "17:40", "18:10", "18:30", "18:50"].map((t, i) =>
      photo(`2026-10-${10 + i}T${t}`),
    );
    const activity = buildHourlyActivity([...evening, photo("2026-10-09T07:00")], now);

    expect(activity.peakStartHour).toBe(17);
  });

  it("claims no peak with too few photos", () => {
    expect(buildHourlyActivity([photo("2026-10-17T17:20")], now).peakStartHour).toBeNull();
  });
});

describe("hourLabel", () => {
  it("formats 12-hour labels", () => {
    expect(hourLabel(0)).toBe("12 AM");
    expect(hourLabel(17)).toBe("5 PM");
    expect(hourLabel(12)).toBe("12 PM");
  });
});
