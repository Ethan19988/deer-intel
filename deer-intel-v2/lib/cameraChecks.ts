import type { CameraCheck } from "@/types/cameraCheck";

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

export function formatCameraCheckDate(date: string | undefined) {
  if (!date) return "Not checked yet";

  const time = Date.parse(date);

  if (Number.isNaN(time)) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

function checkTime(check: CameraCheck) {
  const time = Date.parse(check.date);

  return Number.isNaN(time) ? 0 : time;
}
