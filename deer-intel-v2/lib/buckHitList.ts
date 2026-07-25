import { getDeerProfileIntelligence } from "@/lib/deerProfileIntelligence";
import type { PartyBuckInput } from "@/lib/partyClient";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { DeerProfile } from "@/types/deerProfile";

// Turn a local deer profile into a shareable hit-list snapshot: the profile
// basics plus its computed movement pattern (from getDeerProfileIntelligence).
// This is what gets pushed to the party so the whole crew sees the same card
// and stats without needing each other's photos.
export function buildBuckSnapshot(
  profile: DeerProfile,
  state: DeerIntelState,
): PartyBuckInput {
  const propertyName =
    state.properties.find((p) => p.id === profile.propertyId)?.name ?? "";

  const intel = getDeerProfileIntelligence({
    profile,
    propertyName,
    cameras: state.cameras,
    photoRecords: state.photoRecords,
    cameraChecks: state.cameraChecks,
    hunts: state.hunts,
    pins: state.pins,
  });

  return {
    sourceId: profile.id,
    nickname: profile.nickname.trim() || "Unnamed buck",
    estimatedAge: profile.estimatedAge.trim(),
    status: intel.maturityStatus.title,
    propertyName,
    sightingCount: intel.sightingCount,
    cameras: intel.associatedCameraSites.join(", "),
    mostRecent: intel.mostRecentSighting.title,
    commonTime: intel.commonTimeOfDay.title,
    commonArea: intel.commonArea.title,
    notable: profile.notes.trim().slice(0, 400),
  };
}
