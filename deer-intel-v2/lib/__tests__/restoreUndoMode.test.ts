import { describe, expect, it } from "vitest";
import { restoreUndoMode } from "@/lib/restoreUndo";

describe("restoreUndoMode", () => {
  it("undoes a merge restore as a merge", () => {
    expect(restoreUndoMode({ mode: "merge" })).toBe("merge");
  });

  it("undoes a replace restore, or an older snapshot without a mode, as a replace", () => {
    expect(restoreUndoMode({ mode: "replace" })).toBe("replace");
    expect(restoreUndoMode({})).toBe("replace");
  });
});
