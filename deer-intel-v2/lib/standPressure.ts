import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

// How hard a stand has been hunted lately. Mature bucks pattern a hunter fast:
// sitting the same stand day after day leaves scent and noise on the access, so
// a stand needs rest between sits. This reads only the hunt log.

export type StandPressureLevel = "fresh" | "pressured" | "burned";

export type StandPressure = {
  level: StandPressureLevel;
  /** Sits on this stand in the last PRESSURE_WINDOW_DAYS days, today included. */
  recentSits: number;
  /** Whole days since the last sit (0 = today), or null if never sat. */
  daysSinceLastSit: number | null;
  label: string;
};

export const PRESSURE_WINDOW_DAYS = 7;
// Three sits in a week is the point most hunters agree a stand is educating
// deer; two in a week, or back-to-back days, is worth a rest if another works.
const BURNED_SITS = 3;
const PRESSURED_SITS = 2;
const NEVER_SAT_DAYS = 100_000;

/** Day number for a local "YYYY-MM-DD" date, for whole-day differences. */
function dayNumber(date: string): number | null {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getStandPressure(
  stand: Stand,
  hunts: HuntLogEntry[],
  today: string,
): StandPressure {
  const todayNumber = dayNumber(today);
  const ages = hunts
    .filter((hunt) => hunt.standId === stand.id)
    .map((hunt) => {
      const sitDay = dayNumber(hunt.date);
      return todayNumber === null || sitDay === null
        ? null
        : todayNumber - sitDay;
    })
    // Ignore planned/future-dated entries; they aren't pressure yet.
    .filter((age): age is number => age !== null && age >= 0);

  const recentSits = ages.filter((age) => age < PRESSURE_WINDOW_DAYS).length;
  const daysSinceLastSit = ages.length > 0 ? Math.min(...ages) : null;

  if (recentSits >= BURNED_SITS) {
    return {
      level: "burned",
      recentSits,
      daysSinceLastSit,
      label: `${recentSits} sits in ${PRESSURE_WINDOW_DAYS} days — rest it`,
    };
  }

  if (recentSits >= PRESSURED_SITS || daysSinceLastSit === 0 || daysSinceLastSit === 1) {
    return {
      level: "pressured",
      recentSits,
      daysSinceLastSit,
      label:
        daysSinceLastSit === 0
          ? "Sat today"
          : daysSinceLastSit === 1
            ? "Sat yesterday"
            : `${recentSits} sits this week`,
    };
  }

  return {
    level: "fresh",
    recentSits,
    daysSinceLastSit,
    label:
      daysSinceLastSit === null
        ? "Not sat yet"
        : `Rested ${daysSinceLastSit} days`,
  };
}

const LEVEL_RANK: Record<StandPressureLevel, number> = {
  fresh: 0,
  pressured: 1,
  burned: 2,
};

/**
 * Of the stands the wind favors, the one with the least recent pressure — ties
 * go to the one rested longest (never-sat counts as most rested). Returns null
 * when no stand has a good wind or every good-wind stand is burned.
 */
export function pickRestedStand(
  goodWindStands: Stand[],
  pressureById: Map<string, StandPressure>,
): Stand | null {
  const ranked = goodWindStands
    .map((stand) => ({ stand, pressure: pressureById.get(stand.id) }))
    .filter(
      (entry): entry is { stand: Stand; pressure: StandPressure } =>
        Boolean(entry.pressure) && entry.pressure!.level !== "burned",
    )
    .sort(
      (a, b) =>
        LEVEL_RANK[a.pressure.level] - LEVEL_RANK[b.pressure.level] ||
        // Never sat ranks as most rested; a big finite number keeps two
        // never-sat stands from producing NaN (Infinity - Infinity).
        (b.pressure.daysSinceLastSit ?? NEVER_SAT_DAYS) -
          (a.pressure.daysSinceLastSit ?? NEVER_SAT_DAYS),
    );

  return ranked[0]?.stand ?? null;
}
