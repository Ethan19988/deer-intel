import { describe, expect, it } from "vitest";
import { nextWindMark, windMarksFromText, windTextFromMarks } from "@/lib/windPicker";

describe("windPicker", () => {
  it("reads existing notes and snaps 16-point entries", () => {
    const marks = windMarksFromText("NW, w and NNW", "SE");

    expect(marks.NW).toBe("good");
    expect(marks.W).toBe("good");
    expect(marks.SE).toBe("avoid");
    expect(marks.N).toBe("none");
  });

  it("treats a direction listed both ways as avoid", () => {
    expect(windMarksFromText("S", "S").S).toBe("avoid");
  });

  it("writes marks back in compass order", () => {
    const marks = windMarksFromText("W, NW, N", "S, SE");

    expect(windTextFromMarks(marks)).toEqual({ bestWinds: "N, W, NW", avoidWinds: "SE, S" });
  });

  it("cycles unset, good, avoid, unset", () => {
    expect(nextWindMark("none")).toBe("good");
    expect(nextWindMark("good")).toBe("avoid");
    expect(nextWindMark("avoid")).toBe("none");
  });
});
