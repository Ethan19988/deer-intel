import { beforeEach, describe, expect, it } from "vitest";
import {
  normalizeState,
  readStateFromStorage,
  saveDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  appendQuarantineEntries,
  backupCorruptState,
  CORRUPT_STATE_KEY_PREFIX,
  QUARANTINE_STORAGE_KEY,
  readQuarantine,
  type QuarantineEntry,
  type RejectedRecord,
} from "@/lib/storeQuarantine";

const STATE_KEY = "deer-intel:state";

const store = new Map<string, string>();
// Keys whose writes fail, to simulate a full device.
const failingKeys = new Set<(key: string) => boolean>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      for (const fails of failingKeys) {
        if (fails(key)) throw new Error("QuotaExceededError");
      }
      store.set(key, value);
    },
    removeItem: (key: string) => void store.delete(key),
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

const property = { id: "p1", name: "Ridge" };

function rawState(extra: Record<string, unknown>): Record<string, unknown> {
  return { version: 2, properties: [property], ...extra };
}

function corruptCopies(): [string, string][] {
  return [...store.entries()].filter(([key]) => key.startsWith(CORRUPT_STATE_KEY_PREFIX));
}

beforeEach(() => {
  store.clear();
  failingKeys.clear();
});

describe("normalizeState legacy fallbacks", () => {
  it("reads an old hunt's wind and result fields", () => {
    const state = normalizeState(
      rawState({
        hunts: [
          {
            id: "h1",
            propertyId: "p1",
            stand: "Big Oak",
            wind: "NW",
            result: "Shot opportunity, harvest!",
          },
          { id: "h2", propertyId: "p1", result: "Saw does" },
        ],
      }),
    );

    const [old, plain] = state!.hunts;
    expect(old.windDirection).toBe("NW");
    expect(old.weatherSnapshot.windDirection).toBe("NW");
    expect(old.standName).toBe("Big Oak");
    expect(old.shotOpportunity).toBe(true);
    expect(old.harvest).toBe(true);
    expect(plain.shotOpportunity).toBe(false);
    expect(plain.harvest).toBe(false);
  });

  it("prefers the explicit fields over legacy ones", () => {
    const state = normalizeState(
      rawState({
        hunts: [
          {
            id: "h1",
            propertyId: "p1",
            windDirection: "S",
            wind: "NW",
            shotOpportunity: "no",
            result: "shot",
          },
        ],
      }),
    );

    expect(state!.hunts[0].windDirection).toBe("S");
    expect(state!.hunts[0].shotOpportunity).toBe(false);
  });

  it("reads a camera check's legacy wind/weather and a camera's lat/lng", () => {
    const state = normalizeState(
      rawState({
        cameraChecks: [
          {
            id: "c1",
            propertyId: "p1",
            cameraId: "cam",
            date: "2026-10-01",
            wind: "W",
            weather: "Rain",
            bucks: "2",
          },
        ],
        cameras: [{ id: "cam", propertyId: "p1", name: "Creek", lat: "41.5", lng: -77.1 }],
      }),
    );

    expect(state!.cameraChecks[0].weatherSnapshot.windDirection).toBe("W");
    expect(state!.cameraChecks[0].weatherSnapshot.conditions).toBe("Rain");
    expect(state!.cameraChecks[0].bucks).toBe(2);
    expect(state!.cameras[0].latitude).toBe(41.5);
    expect(state!.cameras[0].longitude).toBe(-77.1);
  });

  it("keeps a sit's tagged bucks and a buck's status", () => {
    const state = normalizeState(
      rawState({
        hunts: [{ id: "h1", propertyId: "p1", deerProfileIds: ["d1", "d1", ""] }],
        deerProfiles: [
          { id: "d1", propertyId: "p1", nickname: "Split G2", status: "harvested", statusDate: "2026-11-02" },
          { id: "d2", propertyId: "p1", nickname: "Wide", status: "bogus" },
        ],
      }),
    );

    expect(state!.hunts[0].deerProfileIds).toEqual(["d1"]);
    expect(state!.deerProfiles[0].status).toBe("harvested");
    expect(state!.deerProfiles[0].statusDate).toBe("2026-11-02");
    expect("status" in state!.deerProfiles[1]).toBe(false);
  });

  it("drops untouched seed properties only when upgrading from version 1", () => {
    const seed = {
      id: "finley-run",
      name: "Finley Run",
      county: "Northern PA",
      acres: "Unknown",
      notes: "Creek bottom, laurel, clear cut, ridge travel.",
    };

    expect(normalizeState({ properties: [seed, property] })!.properties.map((p) => p.id)).toEqual([
      "p1",
    ]);
    expect(normalizeState({ version: 2, properties: [seed] })!.properties).toHaveLength(1);
  });
});

describe("pins", () => {
  it("accepts numeric-string coordinates", () => {
    const state = normalizeState(
      rawState({
        pins: [{ id: "pin1", propertyId: "p1", type: "Rub", lat: "41.25", lng: " -77.5 " }],
      }),
    );

    expect(state!.pins).toHaveLength(1);
    expect(state!.pins[0].lat).toBe(41.25);
    expect(state!.pins[0].lng).toBe(-77.5);
  });

  it("still rejects a pin with no usable location", () => {
    const rejected: RejectedRecord[] = [];
    const bad = { id: "pin2", propertyId: "p1", type: "Rub", lat: "north", lng: -77 };
    const state = normalizeState(rawState({ pins: [bad] }), rejected);

    expect(state!.pins).toHaveLength(0);
    expect(rejected).toEqual([{ collection: "pins", record: bad }]);
  });
});

describe("stand dedupe", () => {
  it("collapses stands promoted from the same pin and repoints their hunts", () => {
    const state = normalizeState(
      rawState({
        stands: [
          { id: "s1", propertyId: "p1", name: "Pin stand", sourcePinId: "pin1" },
          { id: "s2", propertyId: "p1", name: "Pin stand", sourcePinId: "pin1" },
          { id: "s3", propertyId: "p1", name: "Hand made" },
          { id: "s4", propertyId: "p1", name: "Hand made" },
        ],
        hunts: [{ id: "h1", propertyId: "p1", standId: "s2" }],
      }),
    );

    expect(state!.stands.map((stand) => stand.id)).toEqual(["s1", "s3", "s4"]);
    expect(state!.hunts[0].standId).toBe("s1");
  });
});

describe("quarantine", () => {
  it("sets an unreadable record aside instead of losing it", () => {
    const badStand = { id: "s9", propertyId: "p1", name: "" };
    store.set(
      STATE_KEY,
      JSON.stringify(
        rawState({ stands: [badStand, { id: "s1", propertyId: "p1", name: "Ok" }] }),
      ),
    );

    const state = readStateFromStorage();
    expect(state.stands.map((stand) => stand.id)).toEqual(["s1"]);

    const entries = readQuarantine();
    expect(entries).toHaveLength(1);
    expect(entries[0].collection).toBe("stands");
    expect(entries[0].record).toEqual(badStand);
  });

  it("keeps one copy when the same bad record is read again", () => {
    const badPin = { id: "x", propertyId: "p1", type: "Rub" };
    store.set(STATE_KEY, JSON.stringify(rawState({ pins: [badPin] })));
    readStateFromStorage();
    // A different raw value (so the read isn't cached) carrying the same record.
    store.set(STATE_KEY, JSON.stringify(rawState({ pins: [badPin], selectedPropertyId: "p1" })));
    readStateFromStorage();

    expect(JSON.parse(store.get(QUARANTINE_STORAGE_KEY)!)).toHaveLength(1);
  });

  it("quarantines bad records passed to a save", () => {
    saveDeerIntelStore(
      rawState({ cameras: [{ id: "c1", propertyId: "p1" }] }) as never,
    );

    expect(readQuarantine().map((entry) => entry.collection)).toEqual(["cameras"]);
  });

  it("is bounded to the newest entries", () => {
    const existing: QuarantineEntry[] = Array.from({ length: 5 }, (_, index) => ({
      collection: "pins",
      record: { id: `old-${index}` },
      at: "2026-01-01T00:00:00.000Z",
    }));
    const next = appendQuarantineEntries(
      existing,
      [
        { collection: "pins", record: { id: "old-4" } },
        { collection: "pins", record: { id: "new" } },
      ],
      "2026-11-08T00:00:00.000Z",
      3,
    );

    expect(next.map((entry) => (entry.record as { id: string }).id)).toEqual([
      "old-3",
      "old-4",
      "new",
    ]);
  });
});

describe("corrupt store", () => {
  it("copies an unreadable save aside before a write replaces it", () => {
    const raw = '{"version":2,"properties":[{"id":"p1"';
    store.set(STATE_KEY, raw);

    const state = readStateFromStorage();
    expect(state.properties).toEqual([]);

    const copies = corruptCopies();
    expect(copies).toHaveLength(1);
    expect(copies[0][1]).toBe(raw);

    saveDeerIntelStore(normalizeState(rawState({}))!);
    expect(JSON.parse(store.get(STATE_KEY)!).properties[0].id).toBe("p1");
    // The copy survives the overwrite.
    expect(corruptCopies()[0][1]).toBe(raw);
  });

  it("copies the same damaged value only once", () => {
    const raw = "not json at all";
    expect(backupCorruptState(raw, new Date(1000))).toBe(true);
    expect(backupCorruptState(raw, new Date(2000))).toBe(true);
    expect(corruptCopies()).toHaveLength(1);
  });

  it("treats valid JSON with no properties list as damaged", () => {
    store.set(STATE_KEY, '{"stands":[]}');
    readStateFromStorage();
    expect(corruptCopies()).toHaveLength(1);
  });

  it("won't overwrite a damaged save it couldn't copy", () => {
    const raw = "{broken";
    failingKeys.add((key) => key.startsWith(CORRUPT_STATE_KEY_PREFIX));
    store.set(STATE_KEY, raw);

    readStateFromStorage();
    saveDeerIntelStore(normalizeState(rawState({}))!);

    expect(store.get(STATE_KEY)).toBe(raw);
  });
});
