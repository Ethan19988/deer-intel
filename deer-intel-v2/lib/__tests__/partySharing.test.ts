import { describe, expect, it } from "vitest";
import {
  buckPhotoCaption,
  isKnownPinType,
  pinsToShare,
  shareAction,
} from "@/lib/partySharing";
import { clampPartyText, PARTY_TEXT_LIMITS } from "@/lib/partyLimits";
import { parseSupabaseUser } from "@/lib/apiGuard";
import type { MapPin } from "@/types/mapPin";

function pin(id: string, propertyId: string, type: string = "Stand"): MapPin {
  return {
    id,
    propertyId,
    type: type as MapPin["type"],
    lat: 41,
    lng: -77,
    createdAt: "",
    name: id,
    notes: "private",
  };
}

describe("shareAction (H4)", () => {
  it("syncs while sharing is on", () => {
    expect(shareAction(true, false)).toBe("sync");
    expect(shareAction(true, true)).toBe("sync");
  });

  it("withdraws once, only after this device had sharing on", () => {
    expect(shareAction(false, true)).toBe("withdraw");
  });

  it("leaves the party's rows alone when sharing is simply off here", () => {
    expect(shareAction(false, false)).toBe("idle");
  });
});

describe("pinsToShare (M4 / H5)", () => {
  const pins = [pin("a", "p1"), pin("b", "p2"), pin("c", "p1", "Mystery")];

  it("shares one property's pins of known types", () => {
    expect(pinsToShare(pins, "p1").map((p) => p.id)).toEqual(["a"]);
  });

  it("shares nothing without a property", () => {
    expect(pinsToShare(pins, null)).toEqual([]);
  });

  it("knows the app's pin types", () => {
    expect(isKnownPinType("Buck Sighting")).toBe(true);
    expect(isKnownPinType("Mystery")).toBe(false);
    expect(isKnownPinType(undefined)).toBe(false);
  });
});

describe("buckPhotoCaption (M4)", () => {
  it("is the buck's name and the date only", () => {
    expect(buckPhotoCaption("Big 8", "2026-10-30T06:12")).toBe("Big 8 · 2026-10-30");
    expect(buckPhotoCaption("  ", "")).toBe("Unnamed buck");
  });
});

describe("clampPartyText (L9)", () => {
  it("trims and caps to the limit", () => {
    expect(clampPartyText("  Sam  ", PARTY_TEXT_LIMITS.displayName)).toBe("Sam");
    expect(clampPartyText("x".repeat(100), PARTY_TEXT_LIMITS.displayName)).toHaveLength(40);
    expect(clampPartyText(undefined, 10)).toBe("");
  });
});

describe("parseSupabaseUser (M8)", () => {
  it("reads the id and whether the email is confirmed", () => {
    expect(parseSupabaseUser({ id: "u1", email_confirmed_at: "2026-01-01T00:00:00Z" })).toEqual({
      id: "u1",
      emailConfirmed: true,
    });
    expect(parseSupabaseUser({ id: "u1", confirmed_at: "2026-01-01T00:00:00Z" })?.emailConfirmed).toBe(
      true,
    );
    expect(parseSupabaseUser({ id: "u1", email_confirmed_at: null })?.emailConfirmed).toBe(false);
    expect(parseSupabaseUser({})).toBeNull();
  });
});
