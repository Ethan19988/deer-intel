import { describe, expect, it } from "vitest";
import { coldFrontStatus, type PressureReading } from "@/lib/liveWeather";

function pressure(
  trend: PressureReading["trend"],
  series?: number[],
): PressureReading {
  return { value: "30.00 inHg", trend, hint: "", series };
}

describe("coldFrontStatus", () => {
  it("flags a falling barometer with a sustained drop as a front", () => {
    const status = coldFrontStatus(pressure("falling", [30.1, 30.05, 30.0]));
    expect(status.isFront).toBe(true);
    expect(status.dropInHg).toBeCloseTo(0.1, 5);
  });

  it("ignores a falling trend whose drop is just noise", () => {
    const status = coldFrontStatus(pressure("falling", [30.02, 30.01, 30.0]));
    expect(status.isFront).toBe(false);
  });

  it("is never a front when the barometer is steady or rising", () => {
    expect(coldFrontStatus(pressure("steady", [30.2, 30.0])).isFront).toBe(false);
    expect(coldFrontStatus(pressure("rising", [29.8, 30.0])).isFront).toBe(false);
  });

  it("falls back to the trend when there's no series", () => {
    const status = coldFrontStatus(pressure("falling"));
    expect(status.isFront).toBe(true);
    expect(status.dropInHg).toBeNull();
  });

  it("handles missing pressure", () => {
    expect(coldFrontStatus(undefined)).toEqual({ isFront: false, dropInHg: null });
  });
});
