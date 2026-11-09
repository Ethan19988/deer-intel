import { beforeEach, describe, expect, it } from "vitest";
import {
  normalizeState,
  saveDeerIntelStore,
  skipNextRecordStamp,
  stampRecordEdits,
} from "@/lib/deerIntelStore";
import type { DeerIntelState } from "@/types/deerIntelStore";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

beforeEach(() => store.clear());

const NOW = "2026-11-09T12:00:00.000Z";
const EARLIER = "2026-11-01T00:00:00.000Z";

function state(stands: Record<string, unknown>[]): DeerIntelState {
  return normalizeState({
    version: 2,
    properties: [{ id: "p1", name: "Ridge" }],
    stands: stands.map((s) => ({ propertyId: "p1", standType: "Ladder", ...s })),
  })!;
}

type WithStamp = { name: string; updatedAt?: string };
const stands = (s: DeerIntelState) => s.stands as unknown as WithStamp[];

describe("normalizeState keeps per-record updatedAt", () => {
  it("passes a valid stamp through for every collection, hunts included", () => {
    const normalized = normalizeState({
      version: 2,
      properties: [{ id: "p1", name: "Ridge", updatedAt: EARLIER }],
      hunts: [{ id: "h1", propertyId: "p1", updatedAt: EARLIER }],
      stands: [{ id: "s1", propertyId: "p1", name: "Oak", updatedAt: EARLIER }],
    })!;
    expect((normalized.properties[0] as { updatedAt?: string }).updatedAt).toBe(EARLIER);
    expect((normalized.hunts[0] as { updatedAt?: string }).updatedAt).toBe(EARLIER);
    expect(stands(normalized)[0].updatedAt).toBe(EARLIER);
  });

  it("drops a stamp that isn't a date", () => {
    const normalized = state([{ id: "s1", name: "Oak", updatedAt: "yesterday-ish" }]);
    expect("updatedAt" in normalized.stands[0]).toBe(false);
  });
});

describe("stampRecordEdits", () => {
  it("stamps a changed record", () => {
    const before = state([{ id: "s1", name: "Oak", updatedAt: EARLIER }]);
    const after = state([{ id: "s1", name: "Big Oak", updatedAt: EARLIER }]);
    expect(stands(stampRecordEdits(before, after, NOW))[0].updatedAt).toBe(NOW);
  });

  it("stamps a changed record rebuilt without the field", () => {
    const before = state([{ id: "s1", name: "Oak", updatedAt: EARLIER }]);
    const after = state([{ id: "s1", name: "Big Oak" }]);
    expect(stands(stampRecordEdits(before, after, NOW))[0].updatedAt).toBe(NOW);
  });

  it("never re-stamps a no-op write (same object back)", () => {
    const before = state([{ id: "s1", name: "Oak", updatedAt: EARLIER }]);
    const after = state([{ id: "s1", name: "Oak", updatedAt: EARLIER }]);
    expect(stampRecordEdits(before, after, NOW)).toBe(after);
  });

  it("carries the old stamp onto an unchanged record rebuilt without it", () => {
    const before = state([{ id: "s1", name: "Oak", updatedAt: EARLIER }]);
    const after = state([{ id: "s1", name: "Oak" }]);
    expect(stands(stampRecordEdits(before, after, NOW))[0].updatedAt).toBe(EARLIER);
  });

  it("keeps a stamp the caller set (a copy from another device)", () => {
    const before = state([{ id: "s1", name: "Oak", updatedAt: EARLIER }]);
    const after = state([{ id: "s1", name: "Laptop edit", updatedAt: "2026-11-05T00:00:00.000Z" }]);
    expect(stands(stampRecordEdits(before, after, NOW))[0].updatedAt).toBe(
      "2026-11-05T00:00:00.000Z",
    );
  });

  it("leaves new records unstamped", () => {
    const before = state([{ id: "s1", name: "Oak" }]);
    const after = state([{ id: "s1", name: "Oak" }, { id: "s2", name: "New" }]);
    const result = stampRecordEdits(before, after, NOW);
    expect(result).toBe(after);
    expect("updatedAt" in result.stands[1]).toBe(false);
  });
});

describe("saveDeerIntelStore stamping", () => {
  it("stamps edits, but not copies applied from the cloud or a restore", () => {
    saveDeerIntelStore(state([{ id: "s1", name: "Oak" }]), { stampEdits: false });

    const edited = saveDeerIntelStore(state([{ id: "s1", name: "Big Oak" }]));
    const stamp = stands(edited)[0].updatedAt;
    expect(typeof stamp).toBe("string");

    // Saving the same thing again keeps the stamp (no loop of fresh stamps).
    const again = saveDeerIntelStore(state([{ id: "s1", name: "Big Oak" }]));
    expect(stands(again)[0].updatedAt).toBe(stamp);

    const pulled = saveDeerIntelStore(state([{ id: "s1", name: "Cloud name" }]), {
      stampEdits: false,
    });
    expect(stands(pulled)[0].updatedAt).toBeUndefined();

    skipNextRecordStamp();
    const restored = saveDeerIntelStore(state([{ id: "s1", name: "Backup name" }]));
    expect(stands(restored)[0].updatedAt).toBeUndefined();

    // The skip covers one save only.
    const next = saveDeerIntelStore(state([{ id: "s1", name: "Edited after" }]));
    expect(typeof stands(next)[0].updatedAt).toBe("string");
  });
});
