import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COUNTY_RECORD_NO_SIGNAL_MESSAGE,
  joinOwnerFields,
  lookupPaParcelOwnerAtPoint,
} from "@/lib/parcelLookup";
import { propertyLinesErrorState } from "@/lib/parcelProvider";

describe("joinOwnerFields", () => {
  it("joins co-owner fields like the tile build", () => {
    expect(
      joinOwnerFields({ OWNER1: "SMITH JOHN R", OWNER2: " MARY  L " }, ["OWNER1", "OWNER2"]),
    ).toBe("SMITH JOHN R MARY L");
  });
  it("skips blanks and returns undefined when nothing is set", () => {
    expect(joinOwnerFields({ OWNER1: "SMITH JOHN", OWNER2: "  " }, ["OWNER1", "OWNER2"])).toBe(
      "SMITH JOHN",
    );
    expect(joinOwnerFields({}, ["OWNER1"])).toBeUndefined();
  });
  it("keeps only the first of two alternate forms of one name", () => {
    // York: OWNER_FULL || OWN_NAME1 in the build.
    expect(
      joinOwnerFields(
        { OWNER_FULL: "SMITH JOHN R & MARY L", OWN_NAME1: "SMITH JOHN R" },
        ["OWNER_FULL", "OWN_NAME1"],
      ),
    ).toBe("SMITH JOHN R & MARY L");
  });
});

describe("lookupPaParcelOwnerAtPoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports no signal when the request can't be made", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    const result = await lookupPaParcelOwnerAtPoint(41.4, -77.2);
    expect(result.status).toBe("error");
    expect(result.message).toBe(COUNTY_RECORD_NO_SIGNAL_MESSAGE);
  });
});

describe("propertyLinesErrorState", () => {
  it("ignores a stray failed tile", () => {
    expect(propertyLinesErrorState(11, 1, true)).toBeNull();
    expect(propertyLinesErrorState(12, 0, true)).toBeNull();
  });
  it("reports unavailable when most tiles failed", () => {
    expect(propertyLinesErrorState(2, 10, true)?.message).toBe("Property lines unavailable here");
  });
  it("says the lines need a signal when offline", () => {
    expect(propertyLinesErrorState(5, 1, false)?.message).toBe("Property lines need a signal");
  });
});
