import { latestCheckForCamera } from "@/lib/cameraChecks";
import { dateInputTime } from "@/lib/photos";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";

// Which camera sites need a visit, from data already saved: how long since the
// last check, and the battery / SD card reading on that check. The quick check
// stores plain numbers in the percent fields (battery Full=100, Half=50,
// Low=20, Dead=0; SD space left Fine=100, Full=0) or "Missing" for the card,
// so anything at or under LOW_PERCENT reads as low — the same line camera
// intelligence uses for its alerts.

/** An active camera unchecked for longer than this many days needs a visit. */
export const DEFAULT_STALE_CHECK_DAYS = 14;
export const LOW_PERCENT = 25;

export type CameraHealthIssueKind =
  | "batteryDead"
  | "sdMissing"
  | "sdFull"
  | "batteryLow"
  | "sdLow"
  | "overdue";

export type CameraHealthIssue = {
  kind: CameraHealthIssueKind;
  /** Short chip text: "Battery low", "SD full", "21d unchecked". */
  label: string;
  /** Days since the last check, on an "overdue" issue. */
  days?: number;
};

export type CameraHealth = {
  camera: Camera;
  latestCheck: CameraCheck | null;
  /** Whole days since the last check, or null when never checked. */
  daysSinceCheck: number | null;
  /** Most urgent first; empty when the camera is fine. */
  issues: CameraHealthIssue[];
};

export type CameraHealthOptions = {
  now?: Date;
  staleDays?: number;
};

// Most urgent first: a dead battery or missing card means the camera isn't
// recording at all.
const SEVERITY: CameraHealthIssueKind[] = [
  "batteryDead",
  "sdMissing",
  "sdFull",
  "batteryLow",
  "sdLow",
  "overdue",
];

/** A stored percent ("85", "85%") as a number, or null when it isn't one. */
export function readPercent(value: string | undefined): number | null {
  const text = (value ?? "").trim().replace(/%$/, "").trim();
  if (!text) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Whole local days from a "YYYY-MM-DD" check date to `now`; null if unreadable. */
export function daysSince(date: string | undefined, now: Date): number | null {
  const time = dateInputTime(date);
  if (Number.isNaN(time)) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - time) / 86_400_000));
}

export function getCameraHealth(
  camera: Camera,
  checks: CameraCheck[],
  { now = new Date(), staleDays = DEFAULT_STALE_CHECK_DAYS }: CameraHealthOptions = {},
): CameraHealth {
  const latestCheck = latestCheckForCamera(checks, camera.id);
  const daysSinceCheck = latestCheck ? daysSince(latestCheck.date, now) : null;

  // A pulled (inactive) camera isn't recording, so nothing on it needs a trip.
  if (camera.status !== "Active" || !latestCheck) {
    return { camera, latestCheck, daysSinceCheck, issues: [] };
  }

  const issues: CameraHealthIssue[] = [];
  const battery = readPercent(latestCheck.batteryPercent);
  const sdText = latestCheck.sdCardPercent.trim();
  const sd = readPercent(sdText);

  if (battery !== null && battery <= 0) {
    issues.push({ kind: "batteryDead", label: "Battery dead" });
  } else if (battery !== null && battery <= LOW_PERCENT) {
    issues.push({ kind: "batteryLow", label: "Battery low" });
  }

  if (/^missing$/i.test(sdText)) {
    issues.push({ kind: "sdMissing", label: "SD missing" });
  } else if (sd !== null && sd <= 0) {
    issues.push({ kind: "sdFull", label: "SD full" });
  } else if (sd !== null && sd <= LOW_PERCENT) {
    issues.push({ kind: "sdLow", label: "SD low" });
  }

  if (daysSinceCheck !== null && daysSinceCheck > staleDays) {
    issues.push({
      kind: "overdue",
      label: `${daysSinceCheck}d unchecked`,
      days: daysSinceCheck,
    });
  }

  issues.sort((a, b) => SEVERITY.indexOf(a.kind) - SEVERITY.indexOf(b.kind));

  return { camera, latestCheck, daysSinceCheck, issues };
}

/** Cameras with at least one issue, the most urgent camera first. */
export function camerasNeedingVisit(
  cameras: Camera[],
  checks: CameraCheck[],
  options: CameraHealthOptions = {},
): CameraHealth[] {
  return cameras
    .map((camera) => getCameraHealth(camera, checks, options))
    .filter((health) => health.issues.length > 0)
    .sort(
      (a, b) =>
        SEVERITY.indexOf(a.issues[0].kind) - SEVERITY.indexOf(b.issues[0].kind) ||
        (b.daysSinceCheck ?? 0) - (a.daysSinceCheck ?? 0),
    );
}

/** Lowercase phrase for a camera's top issue: "battery low", "not checked in 21 days". */
export function issuePhrase(issue: CameraHealthIssue): string {
  if (issue.kind === "overdue") return `not checked in ${issue.days} days`;
  // "SD" stays capitalized; "Battery" reads mid-sentence.
  return issue.label.replace(/^Battery/, "battery");
}

/**
 * One line for Today: "2 cameras need a visit · Creek Cam battery low", or
 * null when every camera is fine.
 */
export function cameraAttentionLine(
  cameras: Camera[],
  checks: CameraCheck[],
  options: CameraHealthOptions = {},
): string | null {
  const needing = camerasNeedingVisit(cameras, checks, options);
  if (needing.length === 0) return null;

  const [top] = needing;
  const count =
    needing.length === 1
      ? "1 camera needs a visit"
      : `${needing.length} cameras need a visit`;

  return `${count} · ${top.camera.name} ${issuePhrase(top.issues[0])}`;
}
