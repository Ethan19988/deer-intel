import type { DeerIntelState } from "@/types/deerIntelStore";
import { formatWalkDistance, walkTrackDistanceMeters } from "@/lib/walkTrack";

// Everything the hunter marks that carries a date, folded into one timeline the
// calendar can render. Building this season over season is how a property gets
// learned: when scrapes open, when the cameras light up, when bucks move.
export type CalendarEventKind =
  | "hunt"
  | "camera"
  | "sighting"
  | "pin"
  | "walk";

export type CalendarEvent = {
  id: string;
  /** Local day key, YYYY-MM-DD — the calendar buckets on this. */
  dayKey: string;
  kind: CalendarEventKind;
  title: string;
  detail: string;
  propertyId: string;
};

export const CALENDAR_KINDS: CalendarEventKind[] = [
  "hunt",
  "camera",
  "sighting",
  "pin",
  "walk",
];

export const CALENDAR_KIND_META: Record<
  CalendarEventKind,
  { label: string; color: string }
> = {
  hunt: { label: "Hunts", color: "#2f7d43" },
  camera: { label: "Camera checks", color: "#e0642a" },
  sighting: { label: "Sightings", color: "#3b82c4" },
  pin: { label: "Map marks", color: "#9a7b1e" },
  walk: { label: "Walks", color: "#2a9d8f" },
};

/** Local YYYY-MM-DD for a Date (no timezone shift). */
export function dateToDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// A stored date string → its day bucket. A plain date or ISO string keeps its
// leading YYYY-MM-DD (what the app stamps and displays elsewhere); anything else
// is parsed. Null when it can't be read as a date.
export function toDayKey(value: string): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  const leading = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (leading) return `${leading[1]}-${leading[2]}-${leading[3]}`;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return dateToDayKey(parsed);
}

function huntDetail(bucks: number, does: number, fawns: number, harvest: boolean, shot: boolean): string {
  const deer = bucks + does + fawns;
  const seen = deer > 0 ? `${deer} deer` : "no deer";
  const tag = harvest ? "harvest" : shot ? "shot opp." : "";
  return [seen, tag].filter(Boolean).join(" · ");
}

function wildlifeDetail(check: {
  bucks: number;
  does: number;
  fawns: number;
  turkeys: number;
  bears: number;
  coyotes: number;
}): string {
  const parts = [
    check.bucks > 0 ? `${check.bucks} buck` : "",
    check.does > 0 ? `${check.does} doe` : "",
    check.fawns > 0 ? `${check.fawns} fawn` : "",
    check.turkeys > 0 ? `${check.turkeys} turkey` : "",
    check.bears > 0 ? `${check.bears} bear` : "",
    check.coyotes > 0 ? `${check.coyotes} coyote` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "checked";
}

// Fold the whole store into calendar events, optionally scoped to one property.
export function buildCalendarEvents(
  state: DeerIntelState,
  propertyId: string | "all",
): CalendarEvent[] {
  const scope = <T extends { propertyId: string }>(items: T[]) =>
    propertyId === "all"
      ? items
      : items.filter((item) => item.propertyId === propertyId);

  const events: CalendarEvent[] = [];

  for (const hunt of scope(state.hunts)) {
    const dayKey = toDayKey(hunt.date);
    if (!dayKey) continue;
    events.push({
      id: `hunt-${hunt.id}`,
      dayKey,
      kind: "hunt",
      title: hunt.standName?.trim() || "Hunt",
      detail: huntDetail(
        hunt.bucks,
        hunt.does,
        hunt.fawns,
        hunt.harvest,
        hunt.shotOpportunity,
      ),
      propertyId: hunt.propertyId,
    });
  }

  const cameraName = new Map(
    state.cameras.map((camera) => [camera.id, camera.name]),
  );
  for (const check of scope(state.cameraChecks)) {
    const dayKey = toDayKey(check.date);
    if (!dayKey) continue;
    events.push({
      id: `camera-${check.id}`,
      dayKey,
      kind: "camera",
      title: cameraName.get(check.cameraId)?.trim() || "Camera check",
      detail: wildlifeDetail(check),
      propertyId: check.propertyId,
    });
  }

  for (const photo of scope(state.photoRecords)) {
    const dayKey = toDayKey(photo.photoDate);
    if (!dayKey) continue;
    events.push({
      id: `sighting-${photo.id}`,
      dayKey,
      kind: "sighting",
      title: photo.buckName?.trim() || photo.species?.trim() || "Sighting",
      detail: photo.behavior?.trim() || photo.travelDirection?.trim() || "",
      propertyId: photo.propertyId,
    });
  }

  for (const pin of scope(state.pins)) {
    const dayKey = toDayKey(pin.createdAt);
    if (!dayKey) continue;
    const name = pin.name.trim();
    events.push({
      id: `pin-${pin.id}`,
      dayKey,
      kind: "pin",
      title: name || pin.type,
      detail: name ? pin.type : "marked",
      propertyId: pin.propertyId,
    });
  }

  for (const track of scope(state.walkTracks)) {
    const dayKey = toDayKey(track.startedAt);
    if (!dayKey) continue;
    events.push({
      id: `walk-${track.id}`,
      dayKey,
      kind: "walk",
      title: track.name?.trim() || "Walk",
      detail: formatWalkDistance(walkTrackDistanceMeters(track.points)),
      propertyId: track.propertyId,
    });
  }

  return events;
}

/** Group events by their day key for O(1) lookup while rendering the grid. */
export function groupEventsByDay(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const bucket = byDay.get(event.dayKey);
    if (bucket) bucket.push(event);
    else byDay.set(event.dayKey, [event]);
  }

  return byDay;
}
