import { describe, expect, it } from "vitest";
import { isPersonalDataKey, personalDataKeysIn } from "@/lib/localDataKeys";

describe("isPersonalDataKey", () => {
  it("clears records, drafts and per-property entries", () => {
    for (const key of [
      "deer-intel:state",
      "deer-intel:land-tags",
      "deer-intel:pending-photo-uploads",
      "deer-intel:sit-draft",
      "deer-intel:active-walk",
      "deer-intel:active-blood-trail",
      "deer-intel:forecast-snapshot",
      "deer-intel:restore-undo",
      "deer-intel:ai-scout-last:property-123",
      "deer-intel:state.corrupt-2026-11-01T00:00:00Z",
      "deer-intel:shared-keys:user-1",
    ]) {
      expect(isPersonalDataKey(key), key).toBe(true);
    }
  });

  it("keeps preferences, sign-in and offline map packs", () => {
    for (const key of [
      "deer-intel:theme",
      "deer-intel:units",
      "deer-intel:ai-scout-enabled",
      "deer-intel:notifications",
      "deer-intel:auth",
      "deer-intel:offline-packs",
      "deer-intel:season-calendar",
      "deer-intel:share-sightings:user-1",
      "other-app:state",
    ]) {
      expect(isPersonalDataKey(key), key).toBe(false);
    }
  });

  it("filters a key list", () => {
    expect(
      personalDataKeysIn(["deer-intel:theme", "deer-intel:state", "deer-intel:ai-scout-last:p"]),
    ).toEqual(["deer-intel:state", "deer-intel:ai-scout-last:p"]);
  });
});
