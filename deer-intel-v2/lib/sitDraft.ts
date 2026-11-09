// A sit in progress: started from the stand ("Start sit"), counted live, and
// finished with "End sit". It lives in localStorage as it changes so an iOS
// tab reload (memory pressure, the phone sleeping in a cold stand) doesn't
// lose it. Same shape and age rule as lib/activeFieldSession.

import {
  EMPTY_HUNT_FORM_VALUES,
  formatDateInput,
  formatTimeInput,
  type HuntFormValues,
} from "@/lib/huntFormValues";

const DRAFT_KEY = "deer-intel:sit-draft";

// A draft older than this is from another day, not one to resume.
export const SIT_DRAFT_MAX_AGE_MS = 18 * 60 * 60 * 1000;

export type SitDraft = {
  /** ISO time the hunter tapped "Start sit". */
  startedAt: string;
  /** ISO time "End sit" was tapped; set while the sit is being reviewed. */
  endedAt?: string;
  /** Stand name at start, for the banner if the stand list changes. */
  standName: string;
  values: HuntFormValues;
};

/** Validate stored JSON; anything malformed or stale comes back null. */
export function parseSitDraft(
  raw: string | null,
  now: number = Date.now(),
): SitDraft | null {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<SitDraft>;
  const started = Date.parse(
    typeof draft.startedAt === "string" ? draft.startedAt : "",
  );

  if (!Number.isFinite(started) || now - started > SIT_DRAFT_MAX_AGE_MS) {
    return null;
  }
  if (!draft.values || typeof draft.values !== "object") return null;

  // Keep only known string fields so an old or hand-edited draft can't put a
  // non-string into a controlled input.
  const stored = draft.values as Record<string, unknown>;
  const values = { ...EMPTY_HUNT_FORM_VALUES };
  for (const field of Object.keys(values) as (keyof HuntFormValues)[]) {
    if (typeof stored[field] === "string") {
      (values as Record<string, string>)[field] = stored[field] as string;
    }
  }
  // Bucks tagged while the sit was running.
  if (Array.isArray(stored.deerProfileIds)) {
    const ids = stored.deerProfileIds.filter(
      (id): id is string => typeof id === "string" && id !== "",
    );
    if (ids.length > 0) values.deerProfileIds = ids;
  }
  if (values.shotOpportunity !== "Yes") values.shotOpportunity = "No";
  if (values.harvest !== "Yes") values.harvest = "No";

  if (!values.propertyId || !values.standId) return null;

  const endedAt =
    typeof draft.endedAt === "string" && Number.isFinite(Date.parse(draft.endedAt))
      ? draft.endedAt
      : undefined;

  return {
    startedAt: draft.startedAt as string,
    ...(endedAt ? { endedAt } : null),
    standName: typeof draft.standName === "string" ? draft.standName : "",
    values,
  };
}

export function readSitDraft(now: number = Date.now()): SitDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const draft = parseSitDraft(window.localStorage.getItem(DRAFT_KEY), now);
    if (!draft) window.localStorage.removeItem(DRAFT_KEY);
    return draft;
  } catch {
    return null;
  }
}

export function saveSitDraft(draft: SitDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the sit still runs, it just can't resume.
  }
}

export function clearSitDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do.
  }
}

/** A new draft from the form as it stands: today, In = now, no Out yet. */
export function startSitDraft(
  values: HuntFormValues,
  standName: string,
  now: Date = new Date(),
): SitDraft {
  return {
    startedAt: now.toISOString(),
    standName,
    values: {
      ...values,
      date: formatDateInput(now),
      startTime: formatTimeInput(now),
      endTime: "",
    },
  };
}

/** "End sit": Out = now, and the draft moves to review. */
export function endSitDraft(draft: SitDraft, now: Date = new Date()): SitDraft {
  return {
    ...draft,
    endedAt: now.toISOString(),
    values: { ...draft.values, endTime: formatTimeInput(now) },
  };
}

/** Back from review to the running sit; Out is cleared again. */
export function resumeSitDraft(draft: SitDraft): SitDraft {
  const { endedAt: _endedAt, ...rest } = draft;
  void _endedAt;
  return { ...rest, values: { ...draft.values, endTime: "" } };
}

/** "1h 12m" / "8m" since the sit started. */
export function formatSitElapsed(startedAt: string, now: number = Date.now()) {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return "";

  const minutes = Math.max(0, Math.floor((now - started) / 60_000));
  const hours = Math.floor(minutes / 60);

  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
