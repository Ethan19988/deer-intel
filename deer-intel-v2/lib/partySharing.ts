// Shared-to-party content (pins, hit-list bucks, buck thumbnails) is kept in
// step by headless sync components. The sharing switches are account-level,
// but each device used to treat "switch off here" as "delete everything I
// shared" — so a device with the switch off kept deleting what another device
// shared, and the two fought forever. Now a device withdraws its shares only
// on an explicit on -> off transition it applied itself, remembered here per
// account + party + kind.

import { clampPartyText, PARTY_TEXT_LIMITS } from "@/lib/partyLimits";
import { PIN_TYPES, type MapPin, type PinType } from "@/types/mapPin";

export type ShareKind = "pins" | "bucks" | "buckPhotos";

export type ShareAction = "sync" | "withdraw" | "idle";

const APPLIED_PREFIX = "deer-intel:party-share-applied:";

function appliedKey(kind: ShareKind, userId: string, partyId: string): string {
  return `${APPLIED_PREFIX}${kind}:${userId}:${partyId}`;
}

/** True when this device last applied "sharing on" for this party and kind. */
export function readShareApplied(kind: ShareKind, userId: string, partyId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(appliedKey(kind, userId, partyId)) === "on";
  } catch {
    return false;
  }
}

export function writeShareApplied(
  kind: ShareKind,
  userId: string,
  partyId: string,
  on: boolean,
): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(appliedKey(kind, userId, partyId), "on");
    else window.localStorage.removeItem(appliedKey(kind, userId, partyId));
  } catch {
    // Best-effort; worst case a later off doesn't withdraw from this device.
  }
}

/**
 * What a sync component should do: keep shares in step while sharing is on;
 * withdraw them once after sharing was turned off (only if this device had it
 * on); otherwise leave the party's rows alone — they may be another of this
 * account's devices' shares.
 */
export function shareAction(enabled: boolean, lastAppliedOn: boolean): ShareAction {
  if (enabled) return "sync";
  return lastAppliedOn ? "withdraw" : "idle";
}

const KNOWN_PIN_TYPES = new Set<string>(PIN_TYPES);

/** True for a pin type this build can draw (shared rows can hold anything). */
export function isKnownPinType(type: unknown): type is PinType {
  return typeof type === "string" && KNOWN_PIN_TYPES.has(type);
}

/**
 * The local pins to share: one property's pins only (never every property's),
 * of known types. Notes stay private, so they are not part of the share.
 */
export function pinsToShare(
  pins: readonly MapPin[],
  propertyId: string | null | undefined,
): MapPin[] {
  if (!propertyId) return [];
  return pins.filter((pin) => pin.propertyId === propertyId && isKnownPinType(pin.type));
}

/**
 * A shared buck thumbnail's caption: the buck's name and the photo's date
 * only. File names and photo notes stay private.
 */
export function buckPhotoCaption(buckName: string, photoDate: string): string {
  const date = photoDate.slice(0, 10);
  return clampPartyText(
    [buckName.trim() || "Unnamed buck", date].filter(Boolean).join(" · "),
    PARTY_TEXT_LIMITS.caption,
  );
}
