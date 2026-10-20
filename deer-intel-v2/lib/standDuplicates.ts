import type { Stand } from "@/types/stand";

// Two stands with the same name on one property are almost always the same
// tree saved twice. The copy to remove is the one carrying nothing: no winds
// while a same-named twin has them (or, if neither has winds, the one that was
// never placed from a map pin). Returns the ids of those likely duplicates.
export function findLikelyDuplicateStands(stands: Stand[]): Set<string> {
  const groups = new Map<string, Stand[]>();
  for (const stand of stands) {
    const key = `${stand.propertyId}::${stand.name.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), stand]);
  }

  const duplicates = new Set<string>();
  const hasWinds = (stand: Stand) =>
    Boolean(stand.bestWinds.trim() || stand.avoidWinds.trim());

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const anyWithWinds = group.some(hasWinds);
    const anyOnMap = group.some((stand) => stand.sourcePinId);
    for (const stand of group) {
      if (hasWinds(stand)) continue;
      if (anyWithWinds || (anyOnMap && !stand.sourcePinId)) duplicates.add(stand.id);
    }
  }
  return duplicates;
}
