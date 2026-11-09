import { describe, expect, it } from "vitest";
import {
  hasUnreadableWindText,
  nextWindMark,
  windMarksFromText,
  windTextForSave,
  windTextFromMarks,
} from "@/lib/windPicker";

describe("windPicker", () => {
  it("reads existing notes and keeps 16-point entries as they are", () => {
    const marks = windMarksFromText("NW, w and NNW", "SE");

    expect(marks.NW).toBe("good");
    expect(marks.W).toBe("good");
    expect(marks.NNW).toBe("good");
    expect(marks.SE).toBe("avoid");
    expect(marks.N).toBe("none");
    expect(marks.WNW).toBe("none");
  });

  it("round-trips a 16-point wind without widening it", () => {
    const marks = windMarksFromText("NNW", "SSE");

    expect(windTextFromMarks(marks)).toEqual({ bestWinds: "NNW", avoidWinds: "SSE" });
  });

  it("keeps a note the compass can't read when its directions don't change", () => {
    const previous = { bestWinds: "anything but east", avoidWinds: "SE" };
    const marks = windMarksFromText(previous.bestWinds, previous.avoidWinds);

    expect(windTextForSave(previous, marks)).toEqual(previous);
  });

  it("rewrites only the list whose directions changed", () => {
    const previous = { bestWinds: "NW before 9am", avoidWinds: "S, SE" };
    const marks = windMarksFromText(previous.bestWinds, previous.avoidWinds);
    marks.W = "good";

    expect(windTextForSave(previous, marks)).toEqual({
      bestWinds: "W, NW",
      avoidWinds: "S, SE",
    });
  });

  it("flags notes with words the compass can't show", () => {
    expect(hasUnreadableWindText("NW, N or W")).toBe(false);
    expect(hasUnreadableWindText("NNW and WNW winds")).toBe(false);
    expect(hasUnreadableWindText("")).toBe(false);
    expect(hasUnreadableWindText("NW before 9am")).toBe(true);
    expect(hasUnreadableWindText("north-ish")).toBe(true);
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
