import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_HUNT_FORM_VALUES } from "@/lib/huntFormValues";
import {
  clearSitDraft,
  endSitDraft,
  formatSitElapsed,
  parseSitDraft,
  readSitDraft,
  resumeSitDraft,
  saveSitDraft,
  SIT_DRAFT_MAX_AGE_MS,
  startSitDraft,
} from "@/lib/sitDraft";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
};

const START = new Date(2026, 10, 8, 15, 42);
const formValues = {
  ...EMPTY_HUNT_FORM_VALUES,
  propertyId: "p1",
  standId: "s1",
  date: "2026-11-01",
  startTime: "06:00",
  endTime: "09:00",
  windDirection: "NW",
};

describe("sit draft", () => {
  beforeEach(() => store.clear());

  it("starts with today's date and In = now, Out empty, keeping the form", () => {
    const draft = startSitDraft(formValues, "My Tree", START);

    expect(draft.values.date).toBe("2026-11-08");
    expect(draft.values.startTime).toBe("15:42");
    expect(draft.values.endTime).toBe("");
    expect(draft.values.windDirection).toBe("NW");
    expect(draft.standName).toBe("My Tree");
    expect(draft.endedAt).toBeUndefined();
  });

  it("ends with Out = now and resumes with Out cleared", () => {
    const ended = endSitDraft(
      startSitDraft(formValues, "My Tree", START),
      new Date(2026, 10, 8, 17, 5),
    );

    expect(ended.values.endTime).toBe("17:05");
    expect(ended.endedAt).toBeTruthy();

    const resumed = resumeSitDraft(ended);
    expect(resumed.values.endTime).toBe("");
    expect(resumed.endedAt).toBeUndefined();
  });

  it("round-trips through storage and clears", () => {
    const draft = startSitDraft(formValues, "My Tree", START);
    saveSitDraft({ ...draft, values: { ...draft.values, bucks: "2" } });

    const read = readSitDraft(START.getTime() + 60_000);
    expect(read?.values.bucks).toBe("2");
    expect(read?.standName).toBe("My Tree");

    clearSitDraft();
    expect(readSitDraft(START.getTime())).toBeNull();
  });

  it("discards a draft older than the max age", () => {
    saveSitDraft(startSitDraft(formValues, "My Tree", START));

    expect(readSitDraft(START.getTime() + SIT_DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("tolerates bad data", () => {
    const now = START.getTime();
    expect(parseSitDraft(null, now)).toBeNull();
    expect(parseSitDraft("not json", now)).toBeNull();
    expect(parseSitDraft("42", now)).toBeNull();
    expect(parseSitDraft(JSON.stringify({ startedAt: "nope", values: formValues }), now)).toBeNull();
    expect(
      parseSitDraft(JSON.stringify({ startedAt: START.toISOString(), values: { propertyId: "p1" } }), now),
    ).toBeNull();

    const repaired = parseSitDraft(
      JSON.stringify({
        startedAt: START.toISOString(),
        values: { ...formValues, bucks: 3, harvest: "maybe", extra: "x" },
      }),
      now,
    );
    expect(repaired?.values.bucks).toBe("");
    expect(repaired?.values.harvest).toBe("No");
    expect(repaired?.standName).toBe("");
    expect(repaired && "extra" in repaired.values).toBe(false);
  });

  it("formats elapsed time", () => {
    const startedAt = START.toISOString();
    expect(formatSitElapsed(startedAt, START.getTime() + 8 * 60_000)).toBe("8m");
    expect(formatSitElapsed(startedAt, START.getTime() + 72 * 60_000)).toBe("1h 12m");
    expect(formatSitElapsed("bad", START.getTime())).toBe("");
  });
});
