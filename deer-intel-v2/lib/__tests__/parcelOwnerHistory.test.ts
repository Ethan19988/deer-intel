import { describe, expect, it } from "vitest";
import {
  CHANGE_KEEP_MONTHS,
  buildMonthOf,
  coerceSnapshot,
  createOwnerHistory,
  emptySnapshot,
  monthsBetween,
  sameOwnerForHistory,
} from "../../scripts/parcel-owner-history.mjs";

const snapshot = (
  built: string,
  owners: Record<string, string>,
  changes: Record<string, [string, string]> = {},
) => ({ v: 1, built, owners, changes });

describe("owner history helpers", () => {
  it("formats the build month in UTC", () => {
    expect(buildMonthOf(new Date(Date.UTC(2026, 10, 1, 6)))).toBe("2026-11");
  });

  it("counts months between builds", () => {
    expect(monthsBetween("2025-11", "2026-11")).toBe(12);
    expect(monthsBetween("2026-10", "2026-11")).toBe(1);
    expect(Number.isNaN(monthsBetween("bad", "2026-11"))).toBe(true);
  });

  it("ignores formatting noise in owner names", () => {
    expect(sameOwnerForHistory("DOE JANE ETAL", "Doe, Jane")).toBe(true);
    expect(sameOwnerForHistory("SMITH JOHN & MARY", "SMITH JOHN AND MARY")).toBe(true);
    expect(sameOwnerForHistory("SMITH JOHN", "JONES AMY")).toBe(false);
  });

  it("treats a missing or foreign snapshot as empty", () => {
    expect(coerceSnapshot(null)).toEqual(emptySnapshot());
    expect(coerceSnapshot({ v: 99, owners: { a: "X" } })).toEqual(emptySnapshot());
  });
});

describe("createOwnerHistory", () => {
  it("marks nothing on the first build", () => {
    const h = createOwnerHistory(emptySnapshot(), "2026-11");
    h.observe("1", "SMITH JOHN");
    expect(h.stampFor("1")).toEqual({});
    expect(h.finish()).toEqual(snapshot("2026-11", { "1": "SMITH JOHN" }));
  });

  it("stamps a parcel whose owner changed since the last build", () => {
    const h = createOwnerHistory(
      snapshot("2026-10", { "1": "SMITH JOHN", "2": "DOE JANE ETAL" }),
      "2026-11",
    );
    h.observe("1", "JONES AMY");
    h.observe("2", "Doe Jane");
    expect(h.stampFor("1")).toEqual({ prev: "SMITH JOHN", chg: "2026-11" });
    expect(h.stampFor("2")).toEqual({});
    expect(h.finish().changes).toEqual({ "1": ["SMITH JOHN", "2026-11"] });
  });

  it("carries a change forward for about a year, then drops it", () => {
    const prev = snapshot("2026-10", { "1": "JONES AMY" }, { "1": ["SMITH JOHN", "2026-01"] });
    const h = createOwnerHistory(prev, "2026-11");
    h.observe("1", "JONES AMY");
    expect(h.stampFor("1")).toEqual({ prev: "SMITH JOHN", chg: "2026-01" });

    // CHANGE_KEEP_MONTHS after the change, it ages out.
    expect(CHANGE_KEEP_MONTHS).toBe(12);
    const later = createOwnerHistory(prev, "2027-01");
    later.observe("1", "JONES AMY");
    expect(later.stampFor("1")).toEqual({});
  });

  it("replaces a carried change when the parcel sells again", () => {
    const prev = snapshot("2026-10", { "1": "JONES AMY" }, { "1": ["SMITH JOHN", "2026-05"] });
    const h = createOwnerHistory(prev, "2026-11");
    h.observe("1", "BROWN BOB");
    expect(h.stampFor("1")).toEqual({ prev: "JONES AMY", chg: "2026-11" });
  });

  it("ignores parcel ids shared by different owners", () => {
    const h = createOwnerHistory(snapshot("2026-10", { "9": "OLD OWNER" }), "2026-11");
    h.observe("9", "CONDO UNIT A");
    h.observe("9", "CONDO UNIT B");
    expect(h.stampFor("9")).toEqual({});
    expect(h.finish().changes).toEqual({});
  });

  it("skips parcels with no id", () => {
    const h = createOwnerHistory(snapshot("2026-10", { "": "X" }), "2026-11");
    h.observe("", "Y");
    expect(h.stampFor("")).toEqual({});
    expect(h.stats().compared).toBe(0);
  });

  it("treats a county-wide rename as a reformat, not sales", () => {
    const owners: Record<string, string> = {};
    for (let i = 0; i < 400; i++) owners[String(i)] = `SMITH JOHN ${i}`;
    const prev = snapshot("2026-10", owners, { "0": ["EARLIER OWNER", "2026-06"] });
    const h = createOwnerHistory(prev, "2026-11");
    h.observe("0", "SMITH JOHN 0"); // unchanged, carries its earlier change
    for (let i = 1; i < 400; i++) h.observe(String(i), `JOHN SMITH ${i}`);
    expect(h.stats().massChange).toBe(true);
    expect(h.stampFor("5")).toEqual({});
    expect(h.stampFor("0")).toEqual({ prev: "EARLIER OWNER", chg: "2026-06" });
    const next = h.finish();
    expect(next.owners["5"]).toBe("JOHN SMITH 5");
    expect(next.changes).toEqual({ "0": ["EARLIER OWNER", "2026-06"] });
  });
});
