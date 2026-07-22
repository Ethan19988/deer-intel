import type { MapPin, PinType } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// Map pin types that represent a stand location. Pins of these types can be
// promoted into full stand sites so hunts can be logged against them.
export const STAND_PIN_TYPES = ["Stand", "Treestand"] as const satisfies readonly PinType[];

export function getStandPins(pins: MapPin[]): MapPin[] {
  return pins.filter((pin) =>
    (STAND_PIN_TYPES as readonly PinType[]).includes(pin.type),
  );
}

/**
 * Stand-type map pins for a property that haven't been promoted into a stand
 * site yet. Used by the hunt log so a hunter can turn a property's map stands
 * into selectable sites even when other properties already have sites — and so
 * a pin already saved as a site isn't offered again.
 */
export function getConvertibleStandPins(
  pins: MapPin[],
  stands: Stand[],
  propertyId: string,
): MapPin[] {
  if (!propertyId) return [];

  const convertedPinIds = new Set(
    stands
      .filter((stand) => stand.sourcePinId)
      .map((stand) => stand.sourcePinId),
  );

  return getStandPins(pins).filter(
    (pin) => pin.propertyId === propertyId && !convertedPinIds.has(pin.id),
  );
}

/**
 * Promote a stand-type map pin into a full stand site. The Stand type has no
 * coordinates, so the pin's location is preserved in the notes; the pin itself
 * stays on the map untouched.
 */
export function createStandFromPin({
  id,
  pin,
}: {
  id: string;
  pin: MapPin;
}): Stand {
  const pinNotes = pin.notes.trim();
  const name = pin.name.trim() || pinNotes || pin.type;
  const locationLine = `Saved from a ${pin.type} map pin at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}.`;
  const notes =
    pinNotes && pinNotes !== name ? `${pinNotes}\n${locationLine}` : locationLine;

  return {
    id,
    propertyId: pin.propertyId,
    name,
    standType: "Other",
    bestWinds: "",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes,
    sourcePinId: pin.id,
  };
}
