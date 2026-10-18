import { describe, expect, it } from "vitest";
import { averageWind, sitWindowWinds } from "@/lib/liveWeather";

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
