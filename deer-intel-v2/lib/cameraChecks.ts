import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerIntelState } from "@/types/deerIntelStore";
import { dateInputTime } from "@/lib/photos";

export type CameraCheckSummary = {
  checkCount: number;
  latestCheck: CameraCheck | null;
  totalBucks: number;
  totalDoes: number;
  totalFawns: number;
  totalTurkeys: number;
  totalBears: number;
  totalCoyotes: number;
};

export function sortCameraChecksChronologically(checks: CameraCheck[]) {
  return [...checks].sort((left, right) => checkTime(left) - checkTime(right));
}

export function getCameraCheckSummary(
  checks: CameraCheck[],
): CameraCheckSummary {
  const chronologicalChecks = sortCameraChecksChronologically(checks);

  return chronologicalChecks.reduce<CameraCheckSummary>(
    (summary, check) => ({
      checkCount: summary.checkCount + 1,
      latestCheck: check,
      totalBucks: summary.totalBucks + check.bucks,
      totalDoes: summary.totalDoes + check.does,
      totalFawns: summary.totalFawns + check.fawns,
      totalTurkeys: summary.totalTurkeys + check.turkeys,
      totalBears: summary.totalBears + check.bears,
      totalCoyotes: summary.totalCoyotes + check.coyotes,
    }),
    {
      checkCount: 0,
      latestCheck: null,
      totalBucks: 0,
      totalDoes: 0,
      totalFawns: 0,
      totalTurkeys: 0,
      totalBears: 0,
      totalCoyotes: 0,
    },
  );
}

/** The newest check for one camera, or null when it's never been checked. */
export function latestCheckForCamera(
  checks: CameraCheck[],
  cameraId: string,
): CameraCheck | null {
  return getCameraCheckSummary(
    checks.filter((check) => check.cameraId === cameraId),
  ).latestCheck;
}

// Pure state transforms for adding, editing and deleting a camera check.
// Callers pass these to updateDeerIntelStore so they run against the latest
// state. Deleting is a plain removal: cloud sync reads a missing id as this
// device's deletion.

/** Append a check; no change when one with that id is already saved. */
export function addCameraCheckToState(
  state: DeerIntelState,
  check: CameraCheck,
): DeerIntelState {
  if (state.cameraChecks.some((entry) => entry.id === check.id)) return state;

  return { ...state, cameraChecks: [...state.cameraChecks, check] };
}

/** Replace the saved check with the same id; no change when it's gone. */
export function updateCameraCheckInState(
  state: DeerIntelState,
  check: CameraCheck,
): DeerIntelState {
  if (!state.cameraChecks.some((entry) => entry.id === check.id)) return state;

  return {
    ...state,
    cameraChecks: state.cameraChecks.map((entry) =>
      entry.id === check.id ? check : entry,
    ),
  };
}

/**
 * Remove a saved check by id; no change when it's already gone. Photos that
 * were filed under it stay, detached from the check (like a photo moved to
 * another camera), so deleting a typo'd check never deletes photos.
 */
export function deleteCameraCheckFromState(
  state: DeerIntelState,
  checkId: string,
): DeerIntelState {
  if (!state.cameraChecks.some((entry) => entry.id === checkId)) return state;

  const hasLinkedPhotos = state.photoRecords.some(
    (photo) => photo.cameraCheckId === checkId,
  );

  return {
    ...state,
    cameraChecks: state.cameraChecks.filter((entry) => entry.id !== checkId),
    photoRecords: hasLinkedPhotos
      ? state.photoRecords.map((photo) =>
          photo.cameraCheckId === checkId
            ? { ...photo, cameraCheckId: "" }
            : photo,
        )
      : state.photoRecords,
  };
}

export function formatCameraCheckDate(date: string | undefined) {
  if (!date) return "Not checked yet";

  // A date-only "YYYY-MM-DD" must be read in local time; Date.parse treats it as
  // UTC midnight, which formats a day early for negative-offset (US) users.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const time = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      ).getTime()
    : Date.parse(date);

  if (Number.isNaN(time)) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

function checkTime(check: CameraCheck) {
  // "YYYY-MM-DD" is local midnight, not UTC (a day early in the US).
  const time = dateInputTime(check.date);

  return Number.isNaN(time) ? 0 : time;
}
