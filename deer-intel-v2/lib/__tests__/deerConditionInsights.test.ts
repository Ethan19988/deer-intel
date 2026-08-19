import { describe, expect, it } from "vitest";
import {
  getDeerConditionInsights,
  type ConditionKind,
} from "@/lib/deerConditionInsights";
import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";
import type { WeatherSnapshot } from "@/types/weather";

const PROFILE: DeerProfile = {
  id: "buck-1",
  propertyId: "p1",
  nickname: "Split G2",
  estimatedAge: "",
  firstSeen: "",
  lastSeen: "",
  notes: "",
};

function snapshot(partial: Partial<WeatherSnapshot>): WeatherSnapshot {
  return {
    temperature: "",
    windDirection: "",
    windSpeed: "",
    conditions: "",
    moonPhase: "",
    source: "historical",
    ...partial,
  };
}

function photo(
  id: string,
  photoDate: string,
  weather?: Partial<WeatherSnapshot>,
  profileId = PROFILE.id,
): PhotoRecord {
  return {
    id,
    propertyId: "p1",
    cameraSiteId: "c1",
    cameraCheckId: "chk1",
    fileName: `${id}.jpg`,
    photoDate,
    species: "Whitetail",
    deerProfileId: profileId,
    notes: "",
    createdAt: photoDate,
    weatherSnapshot: weather ? snapshot(weather) : undefined,
  };
}

function insightFor(kind: ConditionKind, photos: PhotoRecord[]) {
  return getDeerConditionInsights({
    profile: PROFILE,
    photoRecords: photos,
  }).insights.find((insight) => insight.kind === kind);
}

describe("getDeerConditionInsights", () => {
  it("has no data when nothing links to the buck", () => {
    const result = getDeerConditionInsights({
      profile: PROFILE,
      photoRecords: [photo("x", "2026-10-01T06:30", { windDirection: "SW" }, "other")],
    });

    expect(result.hasData).toBe(false);
    expect(result.insights).toHaveLength(0);
  });

  it("finds the dominant wind and its share of sightings with wind data", () => {
    const photos = [
      photo("a", "2026-10-01T06:30", { windDirection: "SW" }),
      photo("b", "2026-10-02T07:00", { windDirection: "SW" }),
      photo("c", "2026-10-03T07:15", { windDirection: "SW" }),
      photo("d", "2026-10-04T07:20", { windDirection: "N" }),
    ];

    const wind = insightFor("wind", photos);

    expect(wind?.value).toBe("SW winds");
    expect(wind?.count).toBe(3);
    expect(wind?.sampleSize).toBe(4);
    expect(wind?.percent).toBe(75);
  });

  it("buckets temperature into ten-degree bands", () => {
    const photos = [
      photo("a", "2026-10-01T06:30", { temperature: "42°F" }),
      photo("b", "2026-10-02T06:30", { temperature: "45°F" }),
      photo("c", "2026-10-03T06:30", { temperature: "58°F" }),
    ];

    const temp = insightFor("temperature", photos);

    expect(temp?.value).toBe("40–49°");
    expect(temp?.count).toBe(2);
    expect(temp?.percent).toBe(67);
  });

  it("groups clock times into parts of the day and ignores date-only photos", () => {
    const photos = [
      photo("a", "2026-10-01T06:30"),
      photo("b", "2026-10-02T07:10"),
      photo("c", "2026-10-03T18:00"),
      photo("d", "2026-10-04"),
    ];

    const time = insightFor("time", photos);

    expect(time?.value).toBe("Mornings");
    expect(time?.count).toBe(2);
    // The date-only photo carries no clock time, so it is not in the sample.
    expect(time?.sampleSize).toBe(3);
  });

  it("reads humidity out of the conditions text into bands", () => {
    const photos = [
      photo("a", "2026-10-01T06:30", { conditions: "Clear / 82% humidity" }),
      photo("b", "2026-10-02T06:30", { conditions: "Fog / 90% humidity" }),
      photo("c", "2026-10-03T06:30", { conditions: "Sunny / 30% humidity" }),
    ];

    const humidity = insightFor("humidity", photos);

    expect(humidity?.value).toBe("High humidity (70%+)");
    expect(humidity?.count).toBe(2);
  });

  it("requires at least two sightings before an insight surfaces", () => {
    const single = insightFor("wind", [
      photo("a", "2026-10-01T06:30", { windDirection: "SW" }),
    ]);

    expect(single).toBeUndefined();
  });

  it("orders insights by the strongest percentage first", () => {
    const photos = [
      // Wind: 3/3 = 100%
      photo("a", "2026-10-01T06:30", { windDirection: "SW", temperature: "42°F" }),
      photo("b", "2026-10-02T07:00", { windDirection: "SW", temperature: "55°F" }),
      photo("c", "2026-10-03T07:15", { windDirection: "SW", temperature: "61°F" }),
    ];

    const { insights } = getDeerConditionInsights({
      profile: PROFILE,
      photoRecords: photos,
    });

    expect(insights[0].kind).toBe("wind");
    expect(insights[0].percent).toBe(100);
  });
});
