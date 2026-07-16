"use client";

import type { CSSProperties } from "react";
import {
  getSeasonContext,
  useSeasonCalendar,
  type RutPhase,
} from "@/lib/seasonCalendar";

type SeasonRutCardProps = {
  /** Property latitude, to localize the rut estimate; omit for the default. */
  latitude?: number;
};

// A compact "where are we in the season" readout: the current rut phase, a
// countdown to the local peak, and a one-line tactic. Reads the hunter's saved
// calendar (lib/seasonCalendar) so it can sit in Settings today and drop onto
// the dashboard or a property page unchanged.
export default function SeasonRutCard({ latitude }: SeasonRutCardProps) {
  const prefs = useSeasonCalendar();
  const context = getSeasonContext(new Date(), prefs, latitude);

  return (
    <div style={{ ...cardStyle, ...toneStyle(context.phase) }}>
      <div style={headerRowStyle}>
        <p style={eyebrowStyle}>Season</p>
        <span style={badgeStyle}>{context.phaseLabel}</span>
      </div>

      <p style={countdownStyle}>{peakCountdown(context.daysToPeak)}</p>
      <p style={hintStyle}>{context.phaseHint}</p>

      <p style={metaStyle}>
        {context.regionLabel} rut ·{" "}
        {context.peakIsCustom
          ? `your peak ${formatMonthDay(context.peakDate)}`
          : `estimated peak ${formatMonthDay(context.peakDate)}`}
        {context.opener ? ` · ${openerLine(context.opener)}` : ""}
      </p>
    </div>
  );
}

function peakCountdown(daysToPeak: number): string {
  if (daysToPeak === 0) return "Peak rut is today";
  if (daysToPeak > 0) {
    return `Peak rut in ${daysToPeak} day${daysToPeak === 1 ? "" : "s"}`;
  }
  const past = -daysToPeak;
  return `Peak rut was ${past} day${past === 1 ? "" : "s"} ago`;
}

function openerLine(opener: NonNullable<
  ReturnType<typeof getSeasonContext>["opener"]
>): string {
  if (opener.daysToOpener > 0) {
    return `season opens in ${opener.daysToOpener} day${
      opener.daysToOpener === 1 ? "" : "s"
    }`;
  }
  if (opener.daysToOpener === 0) return "opening day";
  return `day ${opener.dayOfSeason} of season`;
}

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The three rut-prime phases get the blaze-orange accent; the shoulder seasons
// stay neutral, so a glance tells you whether it's time to be in the woods.
function toneStyle(phase: RutPhase): CSSProperties {
  const hot = phase === "seeking" || phase === "chasing" || phase === "peak";
  if (hot) {
    return {
      border: "1px solid var(--accent-2-tint-border)",
      background: "var(--accent-2-tint)",
    };
  }
  return { border: "1px solid var(--border)", background: "var(--surface-2)" };
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  padding: "0.9rem 1rem",
  borderRadius: "var(--radius)",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.2rem 0.55rem",
  borderRadius: "999px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const countdownStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "1.15rem",
  fontWeight: 900,
  lineHeight: 1.15,
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.4,
};

const metaStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  fontWeight: 700,
};
