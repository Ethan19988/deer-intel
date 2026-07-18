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
  };
}
