import { describe, expect, it } from "vitest";
import {
  addPendingId,
  parsePendingIds,
  removePendingId,
  retryDelayMs,
} from "@/lib/photoUploadQueue";

describe("photo upload queue helpers", () => {
  it("parses the stored queue, tolerating junk", () => {
    expect(parsePendingIds(null)).toEqual([]);
    expect(parsePendingIds("not json")).toEqual([]);
    expect(parsePendingIds('{"a":1}')).toEqual([]);
    expect(parsePendingIds('["a","",3,"b","a"]')).toEqual(["a", "b"]);
  });

  it("adds and removes ids without duplicates", () => {
    const one = addPendingId([], "a");
    expect(one).toEqual(["a"]);
    expect(addPendingId(one, "a")).toBe(one);
    expect(removePendingId(["a", "b"], "a")).toEqual(["b"]);
    const same = ["b"];
    expect(removePendingId(same, "x")).toBe(same);
  });

  it("backs off exponentially with a cap", () => {
    expect(retryDelayMs(1)).toBe(15_000);
    expect(retryDelayMs(2)).toBe(30_000);
    expect(retryDelayMs(3)).toBe(60_000);
    expect(retryDelayMs(50)).toBe(15 * 60_000);
  });
});
