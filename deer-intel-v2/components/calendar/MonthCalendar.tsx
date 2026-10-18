import type { CSSProperties } from "react";
import type { CalendarDayCell } from "@/lib/calendarGrid";
import { WEEKDAY_LABELS } from "@/lib/calendarGrid";
import {
  CALENDAR_KINDS,
  CALENDAR_KIND_META,
  type CalendarEvent,
  type CalendarEventKind,
} from "@/lib/calendarEvents";

type MonthCalendarProps = {
  weeks: CalendarDayCell[][];
  eventsByDay: Map<string, CalendarEvent[]>;
  visibleKinds: Set<CalendarEventKind>;
  selectedDayKey: string | null;
  todayKey: string | null;
  onSelectDay: (dayKey: string) => void;
};

// The month grid. Each day shows a dot per kind of thing marked that day and a
// small count, so a season's rhythm reads at a glance; tapping a day opens its
// detail list. Purely presentational — the page owns the state.
export default function MonthCalendar({
  weeks,
  eventsByDay,
  visibleKinds,
  selectedDayKey,
  todayKey,
  onSelectDay,
}: MonthCalendarProps) {
  return (
    <div>
      <div style={weekdayRowStyle}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} style={weekdayCellStyle}>
            {label}
          </div>
        ))}
      </div>

      <div style={gridStyle}>
        {weeks.flat().map((cell) => {
          const dayEvents = (eventsByDay.get(cell.dayKey) ?? []).filter(
            (event) => visibleKinds.has(event.kind),
          );
          const kindsPresent = CALENDAR_KINDS.filter((kind) =>
            dayEvents.some((event) => event.kind === kind),
          );
          const isSelected = cell.dayKey === selectedDayKey;
          const isToday = cell.dayKey === todayKey;

          return (
            <button
              key={cell.dayKey}
              type="button"
              onClick={() => onSelectDay(cell.dayKey)}
              aria-pressed={isSelected}
              aria-label={`${cell.dayKey}${
                dayEvents.length ? `, ${dayEvents.length} marked` : ""
              }`}
              style={{
                ...cellStyle,
                ...(cell.inMonth ? null : outsideMonthStyle),
                ...(isSelected ? selectedCellStyle : null),
              }}
            >
              <span
                style={{
                  ...dayNumberStyle,
                  ...(isToday ? todayNumberStyle : null),
                }}
              >
                {cell.day}
              </span>

              {kindsPresent.length > 0 ? (
                <span style={dotsRowStyle}>
                  {kindsPresent.map((kind) => (
                    <span
                      key={kind}
                      style={{
                        ...dotStyle,
                        background: CALENDAR_KIND_META[kind].color,
                      }}
                    />
                  ))}
                </span>
              ) : (
                <span style={dotsRowStyle} />
              )}

              {dayEvents.length > 0 ? (
                <span style={countStyle}>{dayEvents.length}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const weekdayRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: "0.25rem",
  marginBottom: "0.35rem",
};

const weekdayCellStyle: CSSProperties = {
  textAlign: "center",
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: "0.25rem",
};

const cellStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.2rem",
  minHeight: "62px",
  padding: "0.3rem 0.15rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
  cursor: "pointer",
};

const outsideMonthStyle: CSSProperties = {
  background: "var(--surface-2)",
  color: "var(--text-faint)",
};

const selectedCellStyle: CSSProperties = {
  borderColor: "var(--accent)",
  boxShadow: "0 0 0 2px var(--accent-tint-border)",
};

const dayNumberStyle: CSSProperties = {
  fontSize: "0.86rem",
  fontWeight: 700,
  lineHeight: 1,
};

const todayNumberStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "22px",
  height: "22px",
  padding: "0 4px",
  borderRadius: "999px",
  background: "var(--accent-2)",
  color: "var(--accent-2-fg)",
};

const dotsRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "2px",
  minHeight: "8px",
};

const dotStyle: CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "999px",
};

const countStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.66rem",
  fontWeight: 700,
  lineHeight: 1,
};
