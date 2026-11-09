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
 * Promote a stand-type map pin into a full stand site. The stand stays linked
 * to the pin through sourcePinId (that is where its location lives), so the
 * coordinates aren't copied into the notes. The stand type can't be known from
 * a pin, so it starts as "Other" and the Stands page prompts the hunter to set
 * it. The pin itself stays on the map untouched.
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

  return {
    id,
    propertyId: pin.propertyId,
    name,
    standType: "Other",
    bestWinds: "",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: pinNotes && pinNotes !== name ? pinNotes : "",
    sourcePinId: pin.id,
  };
}

/** A new "Stand" map pin for a stand saved from the Stands page. */
export function createStandPin({
  id,
  stand,
  point,
  createdAt,
}: {
  id: string;
  stand: Pick<Stand, "propertyId" | "name">;
  point: { lat: number; lng: number };
  createdAt: string;
}): MapPin {
  return {
    id,
    propertyId: stand.propertyId,
    type: "Stand",
    lat: point.lat,
    lng: point.lng,
    createdAt,
    name: stand.name,
    notes: "",
  };
}

/**
 * Find a stand that was already promoted from this pin, so the same pin can't be
 * saved as a stand twice (guards against double-taps on "Save as stand site").
 */
export function findStandForPin(
  stands: Stand[],
  pinId: string,
): Stand | undefined {
  return stands.find((stand) => stand.sourcePinId === pinId);
}
