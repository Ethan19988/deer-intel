import type { CSSProperties } from "react";
import { bestSitsLine, bestSitsThisWeek } from "@/lib/huntPlanner";
import type { ForecastDay } from "@/lib/liveWeather";
import type { Stand } from "@/types/stand";

// "Best this week: Tue PM (3 stands) · Thu AM (2)" above the Wind by sit grid:
// the grid's answer in one glance. Hidden when no stand has winds set.
export default function BestSitsLine({
  days,
  stands,
  activeKey,
}: {
  days: ForecastDay[];
  stands: Stand[];
  /** Next sit's column key; sits before it are over and don't count. */
  activeKey?: string;
}) {
  const line = bestSitsLine(bestSitsThisWeek(days, stands, activeKey));
  if (!line) return null;

  return <p style={lineStyle}>{line}</p>;
}

const lineStyle: CSSProperties = {
  margin: 0,
  padding: "0.55rem 0.85rem",
  borderLeft: "3px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.74rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};
