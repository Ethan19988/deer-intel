"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CountStepper from "@/components/ui/CountStepper";
import {
  fireNotification,
  getNotificationPermission,
  useNotificationPrefs,
} from "@/lib/notifications";
import {
  currentSeasons,
  DOE_TAGS_STORAGE_KEY,
  doeTagsLine,
  formatSeasonDay,
  licenseYearFor,
  nextOpener,
  normalizeDoeTags,
  parseDoeTags,
  SEASON_DATA_YEAR,
  SEASON_DIGEST,
  seasonOpenerReminder,
  seasonStateForPoint,
  sundayStatus,
  type DoeTags,
} from "@/lib/seasonDates";

// Today's season line: the next statewide opener with a countdown, what's in
// season now, whether Sunday hunting is legal, and a per-device antlerless-tag
// count. Dates come from lib/seasonDates (official PGC / MD DNR pages) and the
// card always links back to the official page to confirm. Hidden until the
// client clock is known so server and client render the same thing.

// --- Doe-tag count: localStorage on this device only (not synced) ---------
let memoryTagsRaw: string | null = null;
const tagListeners = new Set<() => void>();

function readTagsRaw(): string | null {
  try {
    return window.localStorage.getItem(DOE_TAGS_STORAGE_KEY) ?? memoryTagsRaw;
  } catch {
    return memoryTagsRaw;
  }
}

function writeTags(tags: DoeTags) {
  const serialized = JSON.stringify(normalizeDoeTags(tags));
  memoryTagsRaw = serialized;
  try {
    window.localStorage.setItem(DOE_TAGS_STORAGE_KEY, serialized);
  } catch {
    // Storage blocked (private mode): keep the count in memory for this visit.
  }
  tagListeners.forEach((listener) => listener());
}

function subscribeTags(listener: () => void) {
  tagListeners.add(listener);
  function handleStorage(event: StorageEvent) {
    if (event.key === DOE_TAGS_STORAGE_KEY || event.key === null) listener();
  }
  window.addEventListener("storage", handleStorage);
  return () => {
    tagListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

const serverTagsSnapshot = () => null;

export default function SeasonRemindersCard({
  now,
  point,
}: {
  /** The page clock; null before mount. */
  now: Date | null;
  /** The active property's spot — picks PA vs MD dates. */
  point: { lat: number; lng: number } | null | undefined;
}) {
  const prefs = useNotificationPrefs();
  const tagsRaw = useSyncExternalStore(subscribeTags, readTagsRaw, serverTagsSnapshot);
  const [editingTags, setEditingTags] = useState(false);

  const state = seasonStateForPoint(point);
  const reminder = prefs.seasonOpener && now ? seasonOpenerReminder(now, state) : null;
  const reminderKey = reminder?.key ?? "";
  const reminderTitle = reminder?.title ?? "";
  const reminderBody = reminder?.body ?? "";

  // Opt-in "season opener tomorrow" alert, deduped per day in lib/notifications.
  useEffect(() => {
    if (!reminderKey || getNotificationPermission() !== "granted") return;
    void fireNotification(reminderKey, reminderTitle, reminderBody);
  }, [reminderKey, reminderTitle, reminderBody]);

  if (!now) return null;

  const digest = SEASON_DIGEST[state];
  const opener = nextOpener(now, state);
  const open = currentSeasons(now, state);
  const sunday = sundayStatus(now, state);
  const tags = parseDoeTags(tagsRaw, licenseYearFor(now));
  const tagsLine = doeTagsLine(tags);

  const headline = opener
    ? `${opener.seasons.map((season) => season.shortLabel).join(" + ")} ${
        opener.seasons.length > 1 ? "open" : "opens"
      } ${formatSeasonDay(opener.start)} · ${
        opener.days === 1 ? "tomorrow" : `${opener.days} days`
      }`
    : open.length > 0
      ? `All ${SEASON_DATA_YEAR.label} openers are in`
      : `Next season's dates aren't loaded yet`;

  const inSeason =
    open.length > 0
      ? `In season: ${open
          .slice(0, 2)
          .map((season) => `${season.shortLabel} · ends ${formatSeasonDay(season.end, false)}`)
          .join(" | ")}`
      : "No statewide deer season open today";

  function updateTags(next: Partial<DoeTags>) {
    writeTags({ ...tags, ...next });
  }

  return (
    <Card as="section" variant="subtle" style={cardStyle} aria-label="Season reminders">
      <div style={headRowStyle}>
        <span style={eyebrowStyle}>{state} deer seasons</span>
        <span style={yearStyle}>{tags.year}</span>
      </div>
      <p style={headlineStyle}>{headline}</p>
      <p style={lineStyle}>{inSeason}</p>
      {sunday ? (
        <p style={{ ...monoStyle, color: sundayColor[sunday.tone] }}>{sunday.text}</p>
      ) : null}
      <p style={noteStyle}>
        Statewide dates — {state === "PA" ? "WMU 2B, 5C, 5D and antlerless rules differ; check your WMU." : "regions and Sundays differ by county."}
      </p>

      <div style={actionsRowStyle}>
        <button
          type="button"
          aria-expanded={editingTags}
          onClick={() => setEditingTags((value) => !value)}
          style={tagsButtonStyle}
        >
          <span style={tagsLabelStyle}>Tags</span>
          <span>{tagsLine ?? "Add doe tags"}</span>
        </button>
        <a href={digest.url} target="_blank" rel="noreferrer" style={digestLinkStyle}>
          {digest.label} ↗
        </a>
      </div>

      {editingTags ? (
        <div style={tagsEditorStyle}>
          <CountStepper
            label="Antlerless tags this season"
            value={tags.total > 0 ? String(tags.total) : ""}
            onChange={(value) => updateTags({ total: Number(value) || 0 })}
            max={99}
          />
          <div style={tagButtonsStyle}>
            <Button
              type="button"
              variant="secondary"
              disabled={tags.filled >= tags.total}
              onClick={() => updateTags({ filled: tags.filled + 1 })}
            >
              Mark one filled
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={tags.filled <= 0}
              onClick={() => updateTags({ filled: tags.filled - 1 })}
            >
              Undo
            </Button>
          </div>
          <p style={noteStyle}>
            {tags.filled} of {tags.total} filled. Saved on this device only — not synced to
            your account.
          </p>
        </div>
      ) : null}
    </Card>
  );
}

const sundayColor: Record<"legal" | "closed" | "check", string> = {
  legal: "var(--accent-text)",
  closed: "var(--text-muted)",
  check: "var(--warning-text)",
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  padding: "0.75rem 0.85rem",
};

const headRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const monoStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.72rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const eyebrowStyle: CSSProperties = { ...monoStyle, color: "var(--text-faint)" };
const yearStyle: CSSProperties = { ...monoStyle, color: "var(--text-faint)" };

const headlineStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1.45rem",
  fontWeight: 400,
  letterSpacing: "0.04em",
  lineHeight: 1.1,
  color: "var(--text)",
};

const lineStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  color: "var(--text-muted)",
};

const noteStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.78rem",
  lineHeight: 1.4,
  color: "var(--text-faint)",
};

const actionsRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  marginTop: "0.2rem",
};

const tagsButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  minHeight: "44px",
  padding: "0.35rem 0.75rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "var(--text)",
  fontSize: "0.88rem",
  cursor: "pointer",
};

const tagsLabelStyle: CSSProperties = { ...monoStyle, color: "var(--text-faint)" };

const digestLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  padding: "0 0.25rem",
  color: "var(--accent-text)",
  fontSize: "0.82rem",
  textDecoration: "underline",
};

const tagsEditorStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  paddingTop: "0.6rem",
  borderTop: "1px solid var(--border)",
};

const tagButtonsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};
