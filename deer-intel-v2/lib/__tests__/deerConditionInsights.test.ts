import { describe, expect, it } from "vitest";
import {
  collapseVisits,
  getDeerConditionInsights,
  MIN_VISITS,
  type ConditionKind,
} from "@/lib/deerConditionInsights";
import type { SunTimes } from "@/lib/standStats";
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

// 6:30 AM sunrise, 6:00 PM sunset on every date, so parts of the day are fixed.
const SUN: SunTimes = { sunrise: 390, sunset: 1080 };
const sunFor = () => SUN;

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
  profileId: string | undefined = PROFILE.id,
  cameraSiteId = "c1",
  species = "Whitetail",
): PhotoRecord {
  return {
    id,
    propertyId: "p1",
    cameraSiteId,
    cameraCheckId: "chk1",
    fileName: `${id}.jpg`,
    photoDate,
    species,
    deerProfileId: profileId,
    notes: "",
    createdAt: photoDate,
    weatherSnapshot: weather ? snapshot(weather) : undefined,
  };
}

/** n visits on separate days, each with the given weather. */
function visits(prefix: string, n: number, weather: Partial<WeatherSnapshot>, startDay = 1, hour = "06:45") {
  return Array.from({ length: n }, (_, k) =>
    photo(`${prefix}${k}`, `2026-10-${String(startDay + k).padStart(2, "0")}T${hour}`, weather),
  );
}

function insightFor(kind: ConditionKind, photos: PhotoRecord[]) {
  return getDeerConditionInsights({ profile: PROFILE, photoRecords: photos, sunFor }).insights.find(
    (insight) => insight.kind === kind,
  );
}

describe("collapseVisits", () => {
  it("folds a burst on one camera into one visit, but not across cameras", () => {
    const photos = [
      photo("a", "2026-10-01T06:30"),
      photo("b", "2026-10-01T06:31"),
      photo("c", "2026-10-01T06:39"),
      photo("d", "2026-10-01T06:55"),
      photo("e", "2026-10-01T06:31", undefined, PROFILE.id, "c2"),
      photo("f", "2026-10-02"),
      photo("g", "2026-10-02"),
    ];
    const ids = collapseVisits(photos).map((p) => p.id).sort();
    expect(ids).toEqual(["a", "d", "e", "f"]);
  });
});

describe("getDeerConditionInsights", () => {
  it("has no data when nothing links to the buck", () => {
    const result = getDeerConditionInsights({
      profile: PROFILE,
      photoRecords: [photo("x", "2026-10-01T06:30", { windDirection: "SW" }, "other")],
      sunFor,
    });

    expect(result.hasData).toBe(false);
    expect(result.insights).toHaveLength(0);
  });

  it(`needs ${MIN_VISITS} distinct visits — a burst of photos is one`, () => {
    // Ten photos, but all within minutes on one camera: one visit.
    const burst = Array.from({ length: 10 }, (_, k) =>
      photo(`b${k}`, `2026-10-01T06:${String(30 + k).padStart(2, "0")}`, { windDirection: "SW" }),
    );
    expect(insightFor("wind", burst)).toBeUndefined();

    const four = visits("v", 4, { windDirection: "SW" });
    expect(insightFor("wind", four)).toBeUndefined();
  });

  it("finds the dominant wind over visits, worded softly without a baseline", () => {
    const photos = [
      ...visits("a", 4, { windDirection: "SW" }),
      ...visits("b", 1, { windDirection: "N" }, 10),
    ];

    const wind = insightFor("wind", photos);

    expect(wind?.bucket).toBe("SW winds");
    expect(wind?.value).toBe("Seen mostly on SW winds");
    expect(wind?.count).toBe(4);
    expect(wind?.sampleSize).toBe(5);
    expect(wind?.percent).toBe(80);
    expect(wind?.baselinePercent).toBeNull();
    expect(wind?.note).toMatch(/preference or just the most common/);
  });

  it("calls it a preference only when it beats all deer visits on the same cameras", () => {
    const his = visits("h", 5, { windDirection: "SW" });
    // 20 other deer visits on c1, mostly N winds.
    const others = Array.from({ length: 20 }, (_, k) =>
      photo(
        `o${k}`,
        `2026-11-${String(1 + k).padStart(2, "0")}T17:00`,
        { windDirection: k < 4 ? "SW" : "N" },
        "other",
        "c1",
        "Doe",
      ),
    );
    const wind = insightFor("wind", [...his, ...others]);
    expect(wind?.value).toBe("Favors SW winds");
    expect(wind?.baselinePercent).toBe(36); // 9 of 25 visits
  });

  it("says when the top condition is just the common one", () => {
    const his = visits("h", 5, { windDirection: "W" });
    const others = Array.from({ length: 20 }, (_, k) =>
      photo(`o${k}`, `2026-11-${String(1 + k).padStart(2, "0")}T17:00`, { windDirection: "W" }, "other", "c1", "Doe"),
    );
    const wind = insightFor("wind", [...his, ...others]);
    expect(wind?.value).toBe("Seen mostly on W winds");
    expect(wind?.note).toMatch(/also the most common/);
  });

  it("buckets temperature into ten-degree bands", () => {
    const photos = [
      ...visits("a", 3, { temperature: "42°F" }),
      ...visits("b", 1, { temperature: "45°F" }, 10),
      ...visits("c", 1, { temperature: "58°F" }, 20),
    ];

    const temp = insightFor("temperature", photos);

    expect(temp?.bucket).toBe("40–49°");
    expect(temp?.count).toBe(4);
    expect(temp?.percent).toBe(80);
  });

  it("places times relative to that day's sunrise and sunset, ignoring date-only photos", () => {
    const photos = [
      ...visits("dawn", 3, {}, 1, "07:30"), // sunrise + 60 min
      ...visits("mid", 1, {}, 10, "12:00"),
      ...visits("dusk", 1, {}, 20, "17:15"), // sunset − 45 min
      photo("d", "2026-10-28"),
    ];

    const time = insightFor("time", photos);

    expect(time?.value).toBe("Around dawn");
    expect(time?.count).toBe(3);
    expect(time?.sampleSize).toBe(5);
  });

  it("reads humidity out of the conditions text into bands", () => {
    const photos = [
      ...visits("a", 4, { conditions: "Fog / 90% humidity" }),
      ...visits("b", 1, { conditions: "Sunny / 30% humidity" }, 10),
    ];

    const humidity = insightFor("humidity", photos);

    expect(humidity?.bucket).toBe("High humidity (70%+)");
    expect(humidity?.count).toBe(4);
  });

  it("folds moon-phase wording variants into one canonical bucket", () => {
    const photos = [
      ...visits("a", 2, { moonPhase: "Full" }),
      ...visits("b", 2, { moonPhase: "Full Moon" }, 10),
      ...visits("c", 1, { moonPhase: "Waning gibbous" }, 20),
    ];

    const moon = insightFor("moon", photos);

    expect(moon?.bucket).toBe("Full moon");
    expect(moon?.count).toBe(4);
    expect(moon?.sampleSize).toBe(5);
  });

  it("orders insights by the strongest percentage first", () => {
    const photos = [
      ...visits("a", 3, { windDirection: "SW", temperature: "42°F" }),
      ...visits("b", 1, { windDirection: "SW", temperature: "55°F" }, 10),
      ...visits("c", 1, { windDirection: "SW", temperature: "61°F" }, 20),
    ];

    const { insights } = getDeerConditionInsights({ profile: PROFILE, photoRecords: photos, sunFor });

    expect(insights[0].kind).toBe("wind");
    expect(insights[0].percent).toBe(100);
  });
});
