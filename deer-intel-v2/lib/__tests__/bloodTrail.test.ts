import { describe, expect, it } from "vitest";
import {
  acceptPathFix,
  bloodTrailLine,
  lineLengthMeters,
  searchedSinceLastMark,
  type BloodMark,
} from "@/lib/bloodTrail";

// ~1.11 m per 0.00001° of latitude.
const p = (north: number, east = 0) => ({ lat: 41 + north * 0.00001, lng: -77 + east * 0.00001 });

describe("bloodTrailLine", () => {
  it("follows the walked path between marks instead of a straight line", () => {
    const path = [p(0), p(0, 20), p(20, 20), p(40, 20), p(40)];
    const marks: BloodMark[] = [
      { ...p(0), pathIndex: 0 },
      { ...p(40), pathIndex: 5 },
    ];

    const line = bloodTrailLine(marks, path);

    expect(line).toEqual([p(0), p(0), p(0, 20), p(20, 20), p(40, 20), p(40), p(40)]);
    // Around the dogleg is longer than the straight 40-unit hop.
    expect(lineLengthMeters(line)).toBeGreaterThan(lineLengthMeters([p(0), p(40)]) * 1.5);
  });

  it("falls back to a straight segment with no GPS between marks", () => {
    const marks: BloodMark[] = [
      { ...p(0), pathIndex: 0 },
      { ...p(30), pathIndex: 0 },
    ];
    expect(bloodTrailLine(marks, [])).toEqual([p(0), p(30)]);
  });

  it("tolerates indexes past the end of the path", () => {
    const marks: BloodMark[] = [
      { ...p(0), pathIndex: 2 },
      { ...p(30), pathIndex: 9 },
    ];
    expect(bloodTrailLine(marks, [p(0), p(10), p(20)])).toEqual([p(0), p(20), p(30)]);
  });
});

describe("searchedSinceLastMark", () => {
  it("is the walk after the last find", () => {
    const marks: BloodMark[] = [{ ...p(0), pathIndex: 1 }];
    expect(searchedSinceLastMark(marks, [p(0), p(5), p(10)])).toEqual([p(0), p(5), p(10)]);
    expect(searchedSinceLastMark([], [p(5)])).toEqual([]);
  });
});

describe("acceptPathFix", () => {
  it("drops inaccurate fixes and standing-still jitter", () => {
    expect(acceptPathFix([], p(0), 60)).toBe(false);
    expect(acceptPathFix([], p(0), 8)).toBe(true);
    expect(acceptPathFix([p(0)], p(1), 8)).toBe(false); // ~1 m
    expect(acceptPathFix([p(0)], p(5), 8)).toBe(true); // ~5.5 m
    expect(acceptPathFix([p(0)], p(5), null)).toBe(true);
  });
});
