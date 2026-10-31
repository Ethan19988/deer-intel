import type { HuntFormValues } from "@/lib/huntFormValues";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { HuntLogEntry } from "@/types/hunt";

// Pure state transforms for editing and deleting a logged sit. Callers pass
// these to updateDeerIntelStore so they run against the latest state. Deleting
// is a plain removal: cloud sync reads a missing id as this device's deletion.

/** Replace the saved sit with the same id; no change when it's gone. */
export function updateHuntInState(
  state: DeerIntelState,
  hunt: HuntLogEntry,
): DeerIntelState {
  if (!state.hunts.some((entry) => entry.id === hunt.id)) return state;

  return {
    ...state,
    hunts: state.hunts.map((entry) => (entry.id === hunt.id ? hunt : entry)),
  };
}

/** Remove a saved sit by id; no change when it's already gone. */
export function deleteHuntFromState(
  state: DeerIntelState,
  huntId: string,
): DeerIntelState {
  if (!state.hunts.some((entry) => entry.id === huntId)) return state;

  return {
    ...state,
    hunts: state.hunts.filter((entry) => entry.id !== huntId),
  };
}

/** A saved sit back into form values, so the log form can edit it. */
export function huntFormValuesFromHunt(hunt: HuntLogEntry): HuntFormValues {
  const countText = (value: number) => (value > 0 ? String(value) : "");

  return {
    propertyId: hunt.propertyId,
    standId: hunt.standId,
    date: hunt.date,
    startTime: hunt.startTime,
    endTime: hunt.endTime,
    windDirection: hunt.windDirection,
    windSpeed: hunt.windSpeed,
    temperature: hunt.temperature,
    weather: hunt.weather,
    moonPhase: hunt.moonPhase,
    weatherSource: hunt.weatherSnapshot?.source ?? "manual",
    bucks: countText(hunt.bucks),
    does: countText(hunt.does),
    fawns: countText(hunt.fawns),
    shotOpportunity: hunt.shotOpportunity ? "Yes" : "No",
    harvest: hunt.harvest ? "Yes" : "No",
    notes: hunt.notes,
  };
}
