import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

// The one rule for "which sits belong to this stand", shared by stand stats,
// pressure, intelligence, the Stands header and AI Scout so their counts can
// never disagree. A sit belongs to a stand when it carries the stand's id, or —
// for older sits saved before stand ids (or logged against a typed name) — when
// it has no stand id, is on the same property, and has the same stand name
// (trimmed, case-insensitive). Without a known property the name fallback is
// skipped: "Ridge" on two properties is two different stands.

type StandRef = Pick<Stand, "id" | "name"> & { propertyId?: string };
type HuntRef = Pick<HuntLogEntry, "standId"> &
  Partial<Pick<HuntLogEntry, "standName" | "propertyId" | "kind">>;

function nameKey(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

export function huntMatchesStand(stand: StandRef, hunt: HuntRef): boolean {
  // A saved blood trail is a recovery record, not a sit on the stand.
  if (hunt.kind === "blood-trail") return false;
  if (hunt.standId) return hunt.standId === stand.id;
  if (!stand.propertyId || hunt.propertyId !== stand.propertyId) return false;
  const name = nameKey(stand.name);
  return name !== "" && nameKey(hunt.standName) === name;
}

export function huntsForStand<T extends HuntRef>(stand: StandRef, hunts: T[]): T[] {
  return hunts.filter((hunt) => huntMatchesStand(stand, hunt));
}

/** How many of `stands` have at least one sit in `hunts`. */
export function countHuntedStands(stands: StandRef[], hunts: HuntRef[]): number {
  return stands.filter((stand) => hunts.some((hunt) => huntMatchesStand(stand, hunt)))
    .length;
}
