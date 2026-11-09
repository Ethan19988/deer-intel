"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { CalendarIcon } from "@/components/ui/FieldIcons";
import MonthCalendar from "@/components/calendar/MonthCalendar";
import CalendarDayList from "@/components/calendar/CalendarDayList";
import { updateDeerIntelStore, useDeerIntelStore } from "@/lib/deerIntelStore";
import {
  buildCalendarEvents,
  buildSeasonCalendarEvents,
  CALENDAR_KINDS,
  CALENDAR_KIND_META,
  dateToDayKey,
  groupEventsByDay,
  type CalendarEventKind,
} from "@/lib/calendarEvents";
import { addMonths, buildMonthGrid, monthLabel } from "@/lib/calendarGrid";
import { seasonStateForPoint, type SeasonStateCode } from "@/lib/seasonDates";
import { hasPropertyCoordinate } from "@/lib/propertyLocation";
import type { Property } from "@/types/property";

// The state(s) whose deer-season dates to mark: the picked property's state,
// or every state among the properties when showing all (PA by default).
function seasonStatesFor(
  properties: Property[],
  propertyId: string | "all",
): SeasonStateCode[] {
  const inView =
    propertyId === "all"
      ? properties
      : properties.filter((property) => property.id === propertyId);
  const states = inView.map((property) =>
    hasPropertyCoordinate(property)
      ? seasonStateForPoint({ lat: property.latitude, lng: property.longitude })
      : "PA",
  );
  return states.length > 0 ? [...new Set(states)] : ["PA"];
}

export default function CalendarPage() {
  const state = useDeerIntelStore();
  const [now, setNow] = useState<Date | null>(null);
  // The picker follows the app-wide selected property (the shell's switcher),
  // read from the store each render so it isn't stuck on the empty first
  // snapshot. "All properties" is remembered against the property that was
  // selected when it was picked, so switching property in the shell turns
  // it back to that property.
  const [allPickedFor, setAllPickedFor] = useState<string | null>(null);
  const selectedPropertyExists = state.properties.some(
    (property) => property.id === state.selectedPropertyId,
  );
  const propertyId: string | "all" =
    !selectedPropertyExists || allPickedFor === state.selectedPropertyId
      ? "all"
      : state.selectedPropertyId;

  function pickProperty(value: string) {
    if (value === "all") {
      setAllPickedFor(state.selectedPropertyId);
      return;
    }

    setAllPickedFor(null);
    updateDeerIntelStore((current) =>
      current.selectedPropertyId === value
        ? current
        : { ...current, selectedPropertyId: value },
    );
  }
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

  const seasonStatesKey = seasonStatesFor(state.properties, propertyId).join(",");
  const events = useMemo(
    () => [
      ...buildCalendarEvents(state, propertyId),
      ...buildSeasonCalendarEvents(
        seasonStatesKey.split(",") as SeasonStateCode[],
      ),
    ],
    [state, propertyId, seasonStatesKey],
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
      season: 0,
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
  const hiddenDayEventCount = selected
    ? (eventsByDay.get(selected)?.length ?? 0) - selectedDayEvents.length
    : 0;

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
      <PageHeader
        eyebrow="Season record"
        title="Calendar"
        icon={<CalendarIcon size={22} />}
        description="Everything you've marked, by the day — sits, camera checks, sightings, map marks, and walks, plus the state's deer-season openers and closers. It builds the story of your ground season over season."
        action={
          <select
            aria-label="Property"
            value={propertyId}
            onChange={(event) => pickProperty(event.target.value)}
            style={selectStyle}
          >
            <option value="all">All properties</option>
            {state.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        }
      />

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
          hiddenDayEventCount > 0 ? (
            <EmptyState
              title={`${hiddenDayEventCount} ${
                hiddenDayEventCount === 1 ? "item" : "items"
              } hidden by filters`}
              description="Turn the filters above back on to see everything marked on this day."
            />
          ) : (
            <EmptyState
              title="Nothing marked on this day"
              description="Log a sit, check a camera, tag a photo, or drop a map pin and it will show up here."
            />
          )
        ) : (
          <>
            <CalendarDayList events={selectedDayEvents} />
            {hiddenDayEventCount > 0 ? (
              <p style={hiddenNoteStyle}>
                {hiddenDayEventCount} more{" "}
                {hiddenDayEventCount === 1 ? "item" : "items"} hidden by filters
              </p>
            ) : null}
          </>
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

const hiddenNoteStyle: CSSProperties = {
  margin: "0.75rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.85rem",
};

const selectStyle: CSSProperties = {
  maxWidth: "100%",
  minHeight: "40px",
  padding: "0.4rem 0.7rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const calendarCardStyle: CSSProperties = {
  marginTop: "1rem",
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
  borderRadius: "var(--radius-sm)",
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
  borderRadius: "var(--radius-sm)",
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
  borderRadius: "var(--radius-sm)",
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

