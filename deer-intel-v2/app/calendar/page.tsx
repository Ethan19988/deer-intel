"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { CalendarIcon } from "@/components/ui/FieldIcons";
import MonthCalendar from "@/components/calendar/MonthCalendar";
import CalendarDayList from "@/components/calendar/CalendarDayList";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import {
  buildCalendarEvents,
  CALENDAR_KINDS,
  CALENDAR_KIND_META,
  dateToDayKey,
  groupEventsByDay,
  type CalendarEventKind,
} from "@/lib/calendarEvents";
import { addMonths, buildMonthGrid, monthLabel } from "@/lib/calendarGrid";

export default function CalendarPage() {
  const state = useDeerIntelStore();
  const [now, setNow] = useState<Date | null>(null);
  const [propertyId, setPropertyId] = useState<string | "all">(
    state.selectedPropertyId || "all",
  );
  const [viewOverride, setViewOverride] = useState<{
    year: number;
    month: number;
  } | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [visibleKinds, setVisibleKinds] = useState<Set<CalendarEventKind>>(
    () => new Set(CALENDAR_KINDS),
  );

  useEffect(() => {
    // Client-only clock seed (null on server → no hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
  }, []);

  const events = useMemo(
    () => buildCalendarEvents(state, propertyId),
    [state, propertyId],
  );
  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);

  const view = useMemo(
    () =>
      viewOverride ??
      (now ? { year: now.getFullYear(), month: now.getMonth() } : null),
    [viewOverride, now],
  );
  const todayKey = now ? dateToDayKey(now) : null;
  const selected = selectedDayKey ?? todayKey;

  const monthCountByKind = useMemo(() => {
    const counts: Record<CalendarEventKind, number> = {
      hunt: 0,
      camera: 0,
      sighting: 0,
      pin: 0,
      walk: 0,
    };
    if (!view) return counts;

    const prefix = `${view.year}-${String(view.month + 1).padStart(2, "0")}`;
    for (const event of events) {
      if (event.dayKey.startsWith(prefix)) counts[event.kind] += 1;
    }
    return counts;
  }, [events, view]);

  const selectedDayEvents = useMemo(() => {
    if (!selected) return [];
    const forDay = eventsByDay.get(selected) ?? [];
    return forDay
      .filter((event) => visibleKinds.has(event.kind))
      .sort(
        (a, b) =>
          CALENDAR_KINDS.indexOf(a.kind) - CALENDAR_KINDS.indexOf(b.kind) ||
          a.title.localeCompare(b.title),
      );
  }, [eventsByDay, selected, visibleKinds]);

  function toggleKind(kind: CalendarEventKind) {
    setVisibleKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function stepMonth(delta: number) {
    if (!view) return;
    setViewOverride(addMonths(view.year, view.month, delta));
  }

  function goToday() {
    setViewOverride(null);
    setSelectedDayKey(todayKey);
  }

  return (
    <PageShell maxWidth="920px">
      <div style={headerStyle}>
        <div style={headerTitleWrapStyle}>
          <span style={headerIconStyle} aria-hidden="true">
            <CalendarIcon size={22} />
          </span>
          <div>
            <h1 style={titleStyle}>Calendar</h1>
            <p style={subtitleStyle}>
              Everything you&rsquo;ve marked, by the day — hunts, camera checks,
              sightings, map marks, and walks. It builds the story of your
              ground season over season.
            </p>
          </div>
        </div>

        <select
          aria-label="Property"
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          style={selectStyle}
        >
          <option value="all">All properties</option>
          {state.properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </div>

      <Card as="section" style={calendarCardStyle}>
        <div style={navRowStyle}>
          <div style={navButtonsStyle}>
            <button
              type="button"
              style={navButtonStyle}
              aria-label="Previous year"
              onClick={() => stepMonth(-12)}
            >
              «
            </button>
            <button
              type="button"
              style={navButtonStyle}
              aria-label="Previous month"
              onClick={() => stepMonth(-1)}
            >
              ‹
            </button>
          </div>

          <span style={monthLabelStyle}>
            {view ? monthLabel(view.year, view.month) : "…"}
          </span>

          <div style={navButtonsStyle}>
            <button
              type="button"
              style={navButtonStyle}
              aria-label="Next month"
              onClick={() => stepMonth(1)}
            >
              ›
            </button>
            <button
              type="button"
              style={navButtonStyle}
              aria-label="Next year"
              onClick={() => stepMonth(12)}
            >
              »
            </button>
          </div>
        </div>

        <div style={filterRowStyle}>
          <button type="button" style={todayButtonStyle} onClick={goToday}>
            Today
          </button>
          {CALENDAR_KINDS.map((kind) => {
            const active = visibleKinds.has(kind);
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => toggleKind(kind)}
                style={{
                  ...filterChipStyle,
                  ...(active ? null : filterChipOffStyle),
                }}
              >
                <span
                  style={{
                    ...filterDotStyle,
                    background: CALENDAR_KIND_META[kind].color,
                    ...(active ? null : { opacity: 0.35 }),
                  }}
                />
                {CALENDAR_KIND_META[kind].label}
                <span style={filterCountStyle}>{monthCountByKind[kind]}</span>
              </button>
            );
          })}
        </div>

        {view ? (
          <MonthCalendar
            weeks={buildMonthGrid(view.year, view.month)}
            eventsByDay={eventsByDay}
            visibleKinds={visibleKinds}
            selectedDayKey={selected}
            todayKey={todayKey}
            onSelectDay={setSelectedDayKey}
          />
        ) : (
          <p style={loadingStyle}>Loading…</p>
        )}
      </Card>

      <Card as="section" style={dayCardStyle}>
        <h2 style={dayTitleStyle}>{formatSelectedLabel(selected, todayKey)}</h2>

        {selectedDayEvents.length === 0 ? (
          <EmptyState
            title="Nothing marked on this day"
            description="Log a hunt, check a camera, tag a photo, or drop a map pin and it will show up here."
          />
        ) : (
          <CalendarDayList events={selectedDayEvents} />
        )}
      </Card>
    </PageShell>
  );
}

function formatSelectedLabel(
  selected: string | null,
  todayKey: string | null,
): string {
  if (!selected) return "Select a day";

  const [year, month, day] = selected.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const label = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return selected === todayKey ? `Today — ${label}` : label;
}

const headerStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  marginBottom: "1rem",
};

const headerTitleWrapStyle: CSSProperties = {
  display: "flex",
  gap: "0.7rem",
  flex: 1,
  minWidth: "260px",
};

const headerIconStyle: CSSProperties = {
  flex: "none",
  color: "var(--accent-text)",
  marginTop: "0.15rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.5rem",
  fontWeight: 800,
  color: "var(--text)",
};

const subtitleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.45,
};

const selectStyle: CSSProperties = {
  flex: "none",
  minHeight: "40px",
  padding: "0.4rem 0.7rem",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const calendarCardStyle: CSSProperties = {
  display: "grid",
  gap: "0.9rem",
};

const navRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const navButtonsStyle: CSSProperties = {
  display: "flex",
  gap: "0.3rem",
};

const navButtonStyle: CSSProperties = {
  minWidth: "40px",
  minHeight: "40px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "1.1rem",
  fontWeight: 800,
  cursor: "pointer",
};

const monthLabelStyle: CSSProperties = {
  flex: 1,
  textAlign: "center",
  fontSize: "1.05rem",
  fontWeight: 800,
  color: "var(--text)",
};

const filterRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.4rem",
};

const todayButtonStyle: CSSProperties = {
  minHeight: "34px",
  padding: "0.3rem 0.75rem",
  borderRadius: "999px",
  border: "1px solid var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  fontSize: "0.8rem",
  fontWeight: 800,
  cursor: "pointer",
};

const filterChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  minHeight: "34px",
  padding: "0.3rem 0.6rem",
  borderRadius: "999px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.8rem",
  fontWeight: 700,
  cursor: "pointer",
};

const filterChipOffStyle: CSSProperties = {
  opacity: 0.5,
};

const filterDotStyle: CSSProperties = {
  width: "9px",
  height: "9px",
  borderRadius: "999px",
};

const filterCountStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.74rem",
  fontWeight: 800,
};

const loadingStyle: CSSProperties = {
  margin: 0,
  padding: "2rem 0",
  textAlign: "center",
  color: "var(--text-muted)",
};

const dayCardStyle: CSSProperties = {
  marginTop: "1rem",
};

const dayTitleStyle: CSSProperties = {
  margin: "0 0 0.7rem",
  fontSize: "1.05rem",
  fontWeight: 800,
  color: "var(--text)",
};

