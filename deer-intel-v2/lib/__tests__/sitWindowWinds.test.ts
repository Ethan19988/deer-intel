import { describe, expect, it } from "vitest";
import { averageWind, sitWindowHours, sitWindowWinds } from "@/lib/liveWeather";

function hourly(date: string, entries: Array<[number, number, number]>) {
  return {
    time: entries.map(([hour]) => `${date}T${String(hour).padStart(2, "0")}:00`),
    wind_direction_10m: entries.map(([, direction]) => direction),
    wind_speed_10m: entries.map(([, , speed]) => speed),
  };
}

describe("averageWind", () => {
  it("averages across north instead of flipping to south", () => {
    const data = hourly("2024-11-05", [
      [7, 350, 8],
      [8, 10, 8],
    ]);

    const wind = averageWind("2024-11-05", 7, 8, data);

    expect(wind).not.toBeNull();
    const direction = wind!.direction;
    // 350° and 10° average to due north, not 180°.
    expect(Math.min(direction, 360 - direction)).toBeLessThan(1);
    expect(wind!.speed).toBe(8);
  });

  it("only uses hours inside the window on the right day", () => {
    const data = {
      time: ["2024-11-04T17:00", "2024-11-05T17:00", "2024-11-05T12:00"],
      wind_direction_10m: [180, 315, 90],
      wind_speed_10m: [10, 10, 10],
    };

    const wind = averageWind("2024-11-05", 15, 18, data);

    expect(Math.round(wind!.direction)).toBe(315);
  });

  it("returns null when no readings fall in the window", () => {
    expect(averageWind("2024-11-05", 6, 9, hourly("2024-11-05", []))).toBeNull();
  });
});

describe("sitWindowWinds", () => {
  it("reads a morning and an evening wind from sunrise and sunset", () => {
    const data = hourly("2024-11-05", [
      [6, 135, 4],
      [7, 135, 4],
      [8, 135, 4],
      [9, 135, 4],
      [12, 200, 12],
      [14, 315, 9],
      [15, 315, 9],
      [16, 315, 9],
      [17, 315, 9],
    ]);

    const winds = sitWindowWinds("2024-11-05T06:52", "2024-11-05T17:05", data);

    expect(winds.morningWind).toBe("SE 4 mph");
    expect(winds.eveningWind).toBe("NW 9 mph");
  });

  it("leaves both empty without hourly data", () => {
    expect(sitWindowWinds("2024-11-05T06:52", "2024-11-05T17:05", undefined)).toEqual(
      {},
    );
  });
});

describe("sitWindowHours (PA legal light)", () => {
  it("starts the morning at legal light, floored to the hour", () => {
    // 6:52 sunrise → 6:22 legal light → from 6, through 9.
    expect(sitWindowHours("2024-11-05T06:52", undefined).morning).toEqual({
      fromHour: 6,
      toHour: 9,
    });
    // 7:20 sunrise → 6:50 legal light → from 6, not 7.
    expect(sitWindowHours("2024-11-05T07:20", undefined).morning).toEqual({
      fromHour: 6,
      toHour: 9,
    });
  });

  it("runs the evening through legal end, rounded up to the hour", () => {
    // 17:05 sunset → 17:35 legal end → through 18.
    expect(sitWindowHours(undefined, "2024-11-05T17:05").evening).toEqual({
      fromHour: 14,
      toHour: 18,
    });
    // 16:30 sunset → 17:00 legal end exactly → through 17.
    expect(sitWindowHours(undefined, "2024-11-05T16:30").evening).toEqual({
      fromHour: 13,
      toHour: 17,
    });
  });

  it("is empty without sun times", () => {
    expect(sitWindowHours(undefined, undefined)).toEqual({ morning: null, evening: null });
  });
});

describe("sitWindowWinds legal light", () => {
  it("counts the hour after sunset (still legal) in the evening wind", () => {
    // Sunset 17:05: legal light runs to 17:35, so the 18:00 hour is in the
    // window. A strong north wind there outweighs the calm S afternoon.
    const data = hourly("2024-11-05", [
      [14, 180, 2],
      [15, 180, 2],
      [16, 180, 2],
      [17, 180, 2],
      [18, 0, 30],
    ]);

    expect(sitWindowWinds(undefined, "2024-11-05T17:05", data).eveningWind).toMatch(/^N /);
  });

  it("counts the pre-sunrise legal light hour in the morning wind", () => {
    // Sunrise 7:20 → legal 6:50, so the 6:00 hour is in the window.
    const data = hourly("2024-11-05", [
      [6, 270, 30],
      [7, 90, 2],
      [8, 90, 2],
      [9, 90, 2],
    ]);

    expect(sitWindowWinds("2024-11-05T07:20", undefined, data).morningWind).toMatch(/^W /);
  });
});
