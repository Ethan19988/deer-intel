import { describe, expect, it } from "vitest";
import { normalizeState } from "@/lib/deerIntelStore";
import { readStandDetails, standDetailLabels } from "@/lib/standDetails";
import {
  EMPTY_STAND_FORM_VALUES,
  readStandLocation,
  standFormValuesFromStand,
  standFromValues,
  validateStandForm,
  type StandFormValues,
} from "@/lib/standFormValues";
import { createStandFromPin } from "@/lib/standPins";
import type { MapPin } from "@/types/mapPin";

function values(overrides: Partial<StandFormValues>): StandFormValues {
  return { ...EMPTY_STAND_FORM_VALUES, name: "Oak Flat", ...overrides };
}

describe("standFromValues", () => {
  it("saves blank notes as blank, not a placeholder", () => {
    const stand = standFromValues({ id: "s1", propertyId: "p1", values: values({}) });
    expect(stand?.notes).toBe("");
  });

  it("saves an unchosen type as Other and leaves unset details off the record", () => {
    const stand = standFromValues({ id: "s1", propertyId: "p1", values: values({}) });
    expect(stand?.standType).toBe("Other");
    expect(stand).not.toHaveProperty("bestTime");
    expect(stand).not.toHaveProperty("setup");
    expect(stand).not.toHaveProperty("weapon");
    expect(stand).not.toHaveProperty("maxShotYards");
    expect(stand).not.toHaveProperty("heightFeet");
    expect(stand).not.toHaveProperty("sourcePinId");
  });

  it("writes every detail that is set", () => {
    const stand = standFromValues({
      id: "s1",
      propertyId: "p1",
      sourcePinId: "pin-1",
      values: values({
        standType: "Hang-on",
        bestTime: "am",
        setup: ["Saddle", "Bedding edge"],
        weapon: "bow",
        maxShotYards: 30,
        heightFeet: "22",
      }),
    });
    expect(stand).toMatchObject({
      standType: "Hang-on",
      bestTime: "am",
      setup: ["Saddle", "Bedding edge"],
      weapon: "bow",
      maxShotYards: 30,
      heightFeet: 22,
      sourcePinId: "pin-1",
    });
  });

  it("round-trips through the edit form", () => {
    const stand = standFromValues({
      id: "s1",
      propertyId: "p1",
      values: values({ bestTime: "pm", heightFeet: "18", weapon: "gun" }),
    })!;
    const form = standFormValuesFromStand(stand, { lat: 41.5, lng: -77.25 });
    expect(form).toMatchObject({ bestTime: "pm", heightFeet: "18", weapon: "gun", lat: "41.500000", lng: "-77.250000" });
    expect(standFromValues({ id: "s1", propertyId: "p1", values: form })).toEqual(stand);
  });

  it("clears the legacy placeholder when editing", () => {
    const form = standFormValuesFromStand({
      id: "s1",
      propertyId: "p1",
      name: "Oak",
      standType: "Ladder",
      bestWinds: "",
      avoidWinds: "",
      accessRouteNotes: "",
      exitRouteNotes: "",
      notes: "No notes yet.",
    });
    expect(form.notes).toBe("");
  });
});

describe("validateStandForm / readStandLocation", () => {
  it("needs a name", () => {
    expect(validateStandForm(values({ name: "  " }))).toMatch(/name/);
  });

  it("accepts no location, or a full valid one", () => {
    expect(readStandLocation({ lat: "", lng: "" })).toEqual({ ok: true, point: null });
    expect(readStandLocation({ lat: "41.5", lng: "-77.2" })).toEqual({
      ok: true,
      point: { lat: 41.5, lng: -77.2 },
    });
  });

  it("rejects half or out-of-range coordinates", () => {
    expect(readStandLocation({ lat: "41.5", lng: "" }).ok).toBe(false);
    expect(readStandLocation({ lat: "95", lng: "-77" }).ok).toBe(false);
    expect(readStandLocation({ lat: "41", lng: "-200" }).ok).toBe(false);
    expect(readStandLocation({ lat: "abc", lng: "-77" }).ok).toBe(false);
    expect(readStandLocation({ lat: "0", lng: "0" }).ok).toBe(false);
  });

  it("checks height", () => {
    expect(validateStandForm(values({ heightFeet: "20" }))).toBeNull();
    expect(validateStandForm(values({ heightFeet: "200" }))).toMatch(/Height/);
    expect(validateStandForm(values({ heightFeet: "0" }))).toMatch(/Height/);
  });
});

describe("readStandDetails", () => {
  it("keeps only valid values", () => {
    expect(
      readStandDetails({
        bestTime: "noon",
        setup: ["Saddle", "Nope", "Funnel/pinch"],
        weapon: "rifle",
        maxShotYards: "40",
        heightFeet: 400,
      }),
    ).toEqual({ setup: ["Funnel/pinch", "Saddle"], maxShotYards: 40 });
  });

  it("labels details for the card", () => {
    expect(
      standDetailLabels({ bestTime: "all", weapon: "both", maxShotYards: 200, heightFeet: 20 }).map(
        (detail) => detail.value,
      ),
    ).toEqual(["All day", "Bow & gun", "200+ yd", "20 ft"]);
  });
});

describe("normalizeState stands", () => {
  const base = { version: 2, properties: [{ id: "p1", name: "Ridge" }] };
  const raw = {
    id: "s1",
    propertyId: "p1",
    name: "Oak",
    standType: "Ladder",
    bestWinds: "NW",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
  };

  it("turns the stored placeholder note into no note", () => {
    const state = normalizeState({ ...base, stands: [{ ...raw, notes: "No notes yet." }] });
    expect(state?.stands[0].notes).toBe("");
  });

  it("keeps an old record's exact shape (no new keys)", () => {
    const state = normalizeState({ ...base, stands: [{ ...raw, notes: "Big oak" }] });
    expect(Object.keys(state!.stands[0]).sort()).toEqual(
      ["accessRouteNotes", "avoidWinds", "bestWinds", "exitRouteNotes", "id", "name", "notes", "propertyId", "standType"],
    );
  });

  it("reads the optional details", () => {
    const state = normalizeState({
      ...base,
      stands: [{ ...raw, notes: "", bestTime: "pm", setup: ["Saddle"], weapon: "gun", maxShotYards: 100, heightFeet: 16 }],
    });
    expect(state?.stands[0]).toMatchObject({
      bestTime: "pm",
      setup: ["Saddle"],
      weapon: "gun",
      maxShotYards: 100,
      heightFeet: 16,
    });
  });
});

describe("createStandFromPin", () => {
  const pin: MapPin = {
    id: "pin-1",
    propertyId: "p1",
    type: "Treestand",
    lat: 41.123456,
    lng: -77.654321,
    createdAt: "",
    name: "Big Oak",
    notes: "",
  };

  it("links the pin instead of copying coordinates into notes", () => {
    const stand = createStandFromPin({ id: "s1", pin });
    expect(stand.notes).toBe("");
    expect(stand.notes).not.toMatch(/41\.12/);
    expect(stand.sourcePinId).toBe("pin-1");
    expect(stand.standType).toBe("Other");
  });

  it("keeps the pin's own notes", () => {
    expect(createStandFromPin({ id: "s1", pin: { ...pin, notes: "Faces the creek" } }).notes).toBe(
      "Faces the creek",
    );
  });
});
