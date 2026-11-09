import { findStandLocation } from "@/lib/accessScent";
import { huntMatchesStand } from "@/lib/standHunts";
import { createStandPin } from "@/lib/standPins";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { MapPin } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// Saving a stand from the Stands page (add or edit) together with its map
// location. A stand's location lives on a map pin (lib/accessScent
// findStandLocation: its sourcePinId, else a same-name Stand/Treestand pin), so
// saving a location creates or moves that pin and links it by sourcePinId.

/**
 * The pin a stand sits on, for showing and editing its location. Like
 * findStandLocation, but a name-matched pin that another stand already links to
 * by sourcePinId is not this stand's (it would steal — and the store would then
 * merge — the other stand).
 */
export function standLocationPin(
  stand: Stand,
  stands: Stand[],
  pins: MapPin[],
): MapPin | null {
  const pin = findStandLocation(stand, pins);
  if (!pin) return null;
  if (stand.sourcePinId === pin.id) return pin;
  const claimed = stands.some(
    (other) => other.id !== stand.id && other.sourcePinId === pin.id,
  );
  return claimed ? null : pin;
}

/**
 * Insert or replace `stand` and apply its location:
 * - a location with a linked pin moves that pin (and renames it to the stand);
 * - a location with no pin creates a "Stand" pin with `newPinId`;
 * - no location leaves any existing pin alone.
 * Whenever a pin ends up linked, the stand's sourcePinId points at it.
 */
export function saveStandWithLocation(
  state: DeerIntelState,
  input: {
    stand: Stand;
    location: { lat: number; lng: number } | null;
    newPinId: string;
    createdAt: string;
  },
): DeerIntelState {
  const { location, newPinId, createdAt } = input;
  const previous = state.stands.find((stand) => stand.id === input.stand.id);
  // Look the pin up by the stand as it was saved (its old name), so a rename
  // doesn't lose a name-matched pin.
  const linkedPin = standLocationPin(
    previous ? { ...previous, sourcePinId: input.stand.sourcePinId ?? previous.sourcePinId } : input.stand,
    state.stands,
    state.pins,
  );

  let pins = state.pins;
  let sourcePinId = linkedPin?.id ?? input.stand.sourcePinId;

  if (location && linkedPin) {
    pins = pins.map((pin) =>
      pin.id === linkedPin.id
        ? { ...pin, lat: location.lat, lng: location.lng, name: input.stand.name }
        : pin,
    );
  } else if (location) {
    pins = [
      ...pins,
      createStandPin({ id: newPinId, stand: input.stand, point: location, createdAt }),
    ];
    sourcePinId = newPinId;
  } else if (linkedPin && linkedPin.name.trim() !== input.stand.name) {
    // Keep the map label in step with a rename.
    pins = pins.map((pin) =>
      pin.id === linkedPin.id ? { ...pin, name: input.stand.name } : pin,
    );
  }

  const stand: Stand = { ...input.stand, ...(sourcePinId ? { sourcePinId } : {}) };
  const stands = previous
    ? state.stands.map((existing) => (existing.id === stand.id ? stand : existing))
    : [...state.stands, stand];

  // Older id-less sits are matched to a stand by name (lib/standHunts). On a
  // rename, give them the stand's id first so they don't fall off its record —
  // unless another stand here still has the old name (then they're ambiguous).
  let hunts = state.hunts;
  if (previous && previous.name.trim().toLowerCase() !== stand.name.trim().toLowerCase()) {
    const oldNameShared = state.stands.some(
      (other) =>
        other.id !== previous.id &&
        other.propertyId === previous.propertyId &&
        other.name.trim().toLowerCase() === previous.name.trim().toLowerCase(),
    );
    if (!oldNameShared && state.hunts.some((hunt) => !hunt.standId && huntMatchesStand(previous, hunt))) {
      hunts = state.hunts.map((hunt) =>
        !hunt.standId && huntMatchesStand(previous, hunt) ? { ...hunt, standId: stand.id } : hunt,
      );
    }
  }

  return { ...state, stands, pins, hunts };
}
