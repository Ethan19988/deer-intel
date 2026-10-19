// Deer movement score for Today: a 1-5 rating with a plain-English reason.
// The scoring itself lives in lib/movementModel.ts (shared with the map) so
// every movement rating in the app uses the same calibrated weights.

import type { MovementModelResult } from "@/lib/movementModel";

export type MovementTone = "good" | "fair" | "slow";

export type MovementScore = {
  /** Whole-number rating from 1 (tough) to 5 (prime). */
  score: number;
  label: string;
  reason: string;
  tone: MovementTone;
};

/** Turn a model result into the gauge's score + a one-sentence reason. */
export function toMovementScore(result: MovementModelResult): MovementScore {
  const top = result.factors.filter((factor) => factor.effect !== "neutral").slice(0, 3);
  // Reference notes (moon, very windy) that don't move the score but help.
  const notes = result.factors
    .filter((factor) => factor.effect === "neutral" && !/nothing unusual/i.test(factor.text))
    .map((factor) => factor.text);
  const lead = top.length
    ? top.map((factor) => factor.text).join("; ")
    : "Nothing unusual today; expect deer on their normal dawn and dusk schedule";
  const reason = `${[lead, ...notes].join("; ")}.`;

  return { score: result.score, label: result.label, tone: result.tone, reason };
}
