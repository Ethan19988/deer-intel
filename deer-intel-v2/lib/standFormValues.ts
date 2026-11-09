import { isValidHeightFeet } from "@/lib/standDetails";
import type {
  Stand,
  StandBestTime,
  StandSetup,
  StandType,
  StandWeapon,
} from "@/types/stand";

// Form state for adding or editing a stand. Text fields stay as typed until
// save; optional details use "" / [] / null for "not set" and are left off the
// saved record entirely when unset.

export type StandFormValues = {
  name: string;
  /** "" = not chosen yet; saved as "Other". */
  standType: StandType | "";
  bestWinds: string;
  avoidWinds: string;
  accessRouteNotes: string;
  exitRouteNotes: string;
  notes: string;
  bestTime: StandBestTime | "";
  setup: StandSetup[];
  weapon: StandWeapon | "";
  maxShotYards: number | null;
  /** As typed; validated on save. */
  heightFeet: string;
  /** Stand location as typed or filled from GPS; both blank = no location. */
  lat: string;
  lng: string;
};

export const EMPTY_STAND_FORM_VALUES: StandFormValues = {
  name: "",
  standType: "",
  bestWinds: "",
  avoidWinds: "",
  accessRouteNotes: "",
  exitRouteNotes: "",
  notes: "",
  bestTime: "",
  setup: [],
  weapon: "",
  maxShotYards: null,
  heightFeet: "",
  lat: "",
  lng: "",
};

/** Old builds saved this placeholder as if it were a real note. */
export const LEGACY_NOTES_PLACEHOLDER = "No notes yet.";

export function cleanStandNotes(notes: string): string {
  const trimmed = notes.trim();
  return trimmed === LEGACY_NOTES_PLACEHOLDER ? "" : trimmed;
}

/** Coordinates with enough decimals for a single tree (~1 m). */
export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

/** Fill the edit form from a saved stand and its map location (if any). */
export function standFormValuesFromStand(
  stand: Stand,
  location?: { lat: number; lng: number } | null,
): StandFormValues {
  return {
    name: stand.name,
    standType: stand.standType,
    bestWinds: stand.bestWinds,
    avoidWinds: stand.avoidWinds,
    accessRouteNotes: stand.accessRouteNotes,
    exitRouteNotes: stand.exitRouteNotes,
    notes: cleanStandNotes(stand.notes),
    bestTime: stand.bestTime ?? "",
    setup: stand.setup ? [...stand.setup] : [],
    weapon: stand.weapon ?? "",
    maxShotYards: stand.maxShotYards ?? null,
    heightFeet: stand.heightFeet ? String(stand.heightFeet) : "",
    lat: location ? formatCoordinate(location.lat) : "",
    lng: location ? formatCoordinate(location.lng) : "",
  };
}

export type StandLocationRead =
  | { ok: true; point: { lat: number; lng: number } | null }
  | { ok: false; error: string };

/** Both blank = no location; otherwise both must be valid decimal degrees. */
export function readStandLocation(values: Pick<StandFormValues, "lat" | "lng">): StandLocationRead {
  const latText = values.lat.trim();
  const lngText = values.lng.trim();
  if (!latText && !lngText) return { ok: true, point: null };
  if (!latText || !lngText) {
    return { ok: false, error: "Enter both latitude and longitude, or leave both blank." };
  }
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) {
    return { ok: false, error: "Latitude must be a number between -90 and 90." };
  }
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) {
    return { ok: false, error: "Longitude must be a number between -180 and 180." };
  }
  if (lat === 0 && lng === 0) {
    return { ok: false, error: "0, 0 isn't a real stand location." };
  }
  return { ok: true, point: { lat, lng } };
}

/** First problem with the form, or null when it can be saved. */
export function validateStandForm(values: StandFormValues): string | null {
  if (!values.name.trim()) return "Give the stand a name.";
  const location = readStandLocation(values);
  if (!location.ok) return location.error;
  const height = values.heightFeet.trim();
  if (height && !isValidHeightFeet(Number(height))) {
    return "Height should be a number of feet between 1 and 60.";
  }
  return null;
}

/**
 * The stand record the form describes. `base` is the stand being edited (its
 * id, property and pin link are kept); unset optional details are left off so
 * clearing one in the form really clears it.
 */
export function standFromValues({
  id,
  propertyId,
  values,
  sourcePinId,
}: {
  id: string;
  propertyId: string;
  values: StandFormValues;
  sourcePinId?: string;
}): Stand | null {
  const name = values.name.trim();
  if (!name || validateStandForm(values)) return null;

  const height = values.heightFeet.trim() ? Math.round(Number(values.heightFeet)) : undefined;

  return {
    id,
    propertyId,
    name,
    standType: values.standType || "Other",
    bestWinds: values.bestWinds.trim(),
    avoidWinds: values.avoidWinds.trim(),
    accessRouteNotes: values.accessRouteNotes.trim(),
    exitRouteNotes: values.exitRouteNotes.trim(),
    notes: cleanStandNotes(values.notes),
    ...(sourcePinId ? { sourcePinId } : {}),
    ...(values.bestTime ? { bestTime: values.bestTime } : {}),
    ...(values.setup.length ? { setup: [...values.setup] } : {}),
    ...(values.weapon ? { weapon: values.weapon } : {}),
    ...(values.maxShotYards ? { maxShotYards: values.maxShotYards } : {}),
    ...(height ? { heightFeet: height } : {}),
  };
}

/** New stand from the add form (kept for existing callers). */
export function createStandFromValues(input: {
  id: string;
  propertyId: string;
  values: StandFormValues;
}): Stand | null {
  return standFromValues(input);
}
