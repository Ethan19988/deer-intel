import { describe, expect, it } from "vitest";
import { summarizeMapNotices } from "@/lib/mapNotices";

describe("summarizeMapNotices", () => {
  it("folds three zoom hints into one line", () => {
    expect(
      summarizeMapNotices([
        "Zoom in to view property lines.",
        "Zoom in to see property lines and owner names.",
        "Zoom in to see walking trails and tracks.",
      ]),
    ).toEqual(["Zoom in to see property lines and trails."]);
  });

  it("keeps the owner-name tip once lines are showing", () => {
    const tip = "Zoom in further for owner names — tap any parcel to see who owns it.";
    expect(summarizeMapNotices([null, tip, null])).toEqual([tip]);
  });

  it("passes other status through and drops blanks", () => {
    expect(summarizeMapNotices(["Property lines unavailable here", "", undefined])).toEqual([
      "Property lines unavailable here",
    ]);
    expect(
      summarizeMapNotices(["Loading property lines...", "Zoom in to see walking trails and tracks."]),
    ).toEqual(["Zoom in to see trails.", "Loading property lines..."]);
  });
});
