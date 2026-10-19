import { describe, expect, it } from "vitest";
import { scoreMovement } from "@/lib/movementModel";
import { toMovementScore } from "@/lib/movementScore";

describe("toMovementScore", () => {
  it("leads with the factors that moved the score and keeps the moon note", () => {
    const result = toMovementScore(
      scoreMovement({ tempF: 50, tempDepartureF: -11, windMph: 8, moonIllumination: 98 }),
    );

    expect(result.reason).toBe(
      "Cold snap, 11° cooler than recent days; Full moon (collar studies show little effect).",
    );
  });

  it("explains a plain day", () => {
    const result = toMovementScore(scoreMovement({ tempF: 50, tempDepartureF: 0, windMph: 8 }));

    expect(result.label).toBe("Fair: a normal day");
    expect(result.reason).toMatch(/^Nothing unusual today/);
  });
});
