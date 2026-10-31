"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { compassToDegrees } from "@/lib/travelDirection";
import {
  nextWindMark,
  WIND_POINTS,
  type WindMark,
  type WindMarks,
  type WindPoint,
} from "@/lib/windPicker";

type WindPickerProps = {
  marks: WindMarks;
  onChange: (marks: WindMarks) => void;
  /** Today's wind (compass point the wind comes FROM), marked on the ring. */
  currentWind?: string;
  /** Map imagery drawn behind the compass (see StandWindBackdrop). */
  backdrop?: ReactNode;
};

const SIZE = 300;
const C = SIZE / 2;
const R_OUT = 128;
const R_IN = 46;

const FILL: Record<WindMark, string> = {
  good: "var(--success-bg)",
  avoid: "var(--danger-bg)",
  none: "var(--surface-2)",
};
const STROKE: Record<WindMark, string> = {
  good: "var(--success-border)",
  avoid: "var(--danger-border)",
  none: "var(--border)",
};
const INK: Record<WindMark, string> = {
  good: "var(--success-text)",
  avoid: "var(--danger-text)",
  none: "var(--text-muted)",
};
// Over satellite imagery the wedges go see-through so the ground shows.
const MAP_FILL: Record<WindMark, string> = {
  good: "rgba(34, 160, 80, 0.5)",
  avoid: "rgba(220, 50, 40, 0.5)",
  none: "rgba(255, 255, 255, 0.06)",
};
const MAP_STROKE: Record<WindMark, string> = {
  good: "#7ee2a0",
  avoid: "#ff8a80",
  none: "rgba(255, 255, 255, 0.55)",
};

const GLYPH: Record<WindMark, string> = { good: "✓", avoid: "✕", none: "" };
const SPOKEN: Record<WindMark, string> = { good: "good", avoid: "avoid", none: "not set" };

function polar(radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: C + radius * Math.cos(radians), y: C + radius * Math.sin(radians) };
}

function wedgePath(center: number): string {
  const a0 = center - 22.5 + 1.2;
  const a1 = center + 22.5 - 1.2;
  const o0 = polar(R_OUT, a0);
  const o1 = polar(R_OUT, a1);
  const i1 = polar(R_IN, a1);
  const i0 = polar(R_IN, a0);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${R_OUT} ${R_OUT} 0 0 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${R_IN} ${R_IN} 0 0 0 ${i0.x} ${i0.y}`,
    "Z",
  ].join(" ");
}

// Arrow inside a wedge showing the wind's travel: it comes in from that side
// and blows toward the stand at the center.
const ARROW_TAIL = 72;
const ARROW_TIP = 51;
const ARROW_HEAD = 6;

function windArrowPath(center: number): string {
  const tail = polar(ARROW_TAIL, center);
  const tip = polar(ARROW_TIP, center);
  const back = polar(ARROW_TIP + ARROW_HEAD + 1, center);
  // Perpendicular offset for the two barbs of the head.
  const radians = (center * Math.PI) / 180;
  const px = Math.cos(radians) * ARROW_HEAD;
  const py = Math.sin(radians) * ARROW_HEAD;
  return [
    `M ${tail.x} ${tail.y} L ${tip.x} ${tip.y}`,
    `M ${back.x + px} ${back.y + py} L ${tip.x} ${tip.y} L ${back.x - px} ${back.y - py}`,
  ].join(" ");
}

// Tap a direction to cycle it: good wind (green) → avoid (red) → not set.
// A wind is named for where it comes FROM, so "NW" means the wind blows from
// the northwest toward the southeast.
export default function WindPicker({ marks, onChange, currentWind, backdrop }: WindPickerProps) {
  const onMap = Boolean(backdrop);
  const currentDegrees = currentWind ? compassToDegrees(currentWind) : null;

  function cycle(point: WindPoint) {
    onChange({ ...marks, [point]: nextWindMark(marks[point]) });
  }

  function onKey(event: KeyboardEvent, point: WindPoint) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      cycle(point);
    }
  }

  const good = WIND_POINTS.filter((point) => marks[point] === "good");
  const avoid = WIND_POINTS.filter((point) => marks[point] === "avoid");

  return (
    <div style={wrapStyle}>
      <div style={roseFrameStyle}>
      {backdrop}
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={svgStyle}
        role="group"
        aria-label="Wind directions for this stand"
      >
        {WIND_POINTS.map((point, index) => {
          const center = index * 45;
          const mark = marks[point];
          const label = polar((R_IN + R_OUT) / 2 + 12, center);
          return (
            <g
              key={point}
              role="button"
              tabIndex={0}
              aria-label={`${point} wind: ${SPOKEN[mark]}. Tap to change.`}
              aria-pressed={mark !== "none"}
              className="di-wind-wedge"
              onClick={() => cycle(point)}
              onKeyDown={(event) => onKey(event, point)}
              style={wedgeGroupStyle}
            >
              <path
                d={wedgePath(center)}
                fill={onMap ? MAP_FILL[mark] : FILL[mark]}
                stroke={onMap ? MAP_STROKE[mark] : STROKE[mark]}
                strokeWidth={2}
              />
              <text
                x={label.x}
                y={label.y - (GLYPH[mark] ? 8 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="19"
                fontWeight={800}
                fill={onMap ? "#fff" : INK[mark]}
                style={onMap ? mapTextStyle : noPointerStyle}
              >
                {point}
              </text>
              <path
                d={windArrowPath(center)}
                fill="none"
                stroke={onMap ? "#fff" : INK[mark]}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={onMap ? mapArrowStyle : noPointerStyle}
              />
              {GLYPH[mark] ? (
                <text
                  x={label.x}
                  y={label.y + 13}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="16"
                  fontWeight={900}
                  fill={onMap ? "#fff" : INK[mark]}
                  style={onMap ? mapTextStyle : noPointerStyle}
                >
                  {GLYPH[mark]}
                </text>
              ) : null}
            </g>
          );
        })}

        {currentDegrees !== null ? (
          <g style={noPointerStyle} aria-hidden="true">
            {/* Marker on the rim where today's wind is coming from. */}
            <circle
              cx={polar(R_OUT + 14, currentDegrees).x}
              cy={polar(R_OUT + 14, currentDegrees).y}
              r={13}
              fill="var(--accent-2)"
            />
            <text
              {...polar(R_OUT + 14, currentDegrees)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="9"
              fontWeight={900}
              fill="#fff"
            >
              NOW
            </text>
          </g>
        ) : null}

        {onMap ? null : (
          <>
            <text x={C} y={C - 6} textAnchor="middle" fontSize="12" fontWeight={700} fill="var(--text-muted)" style={noPointerStyle}>
              Tap a
            </text>
            <text x={C} y={C + 10} textAnchor="middle" fontSize="12" fontWeight={700} fill="var(--text-muted)" style={noPointerStyle}>
              direction
            </text>
          </>
        )}
      </svg>
      </div>

      <p style={summaryStyle}>
        <span>
          <strong style={{ color: "var(--success-text)" }}>Good:</strong>{" "}
          {good.length ? good.join(", ") : "none yet"}
        </span>
        <span>
          <strong style={{ color: "var(--danger-text)" }}>Avoid:</strong>{" "}
          {avoid.length ? avoid.join(", ") : "none"}
        </span>
      </p>
      <p style={hintStyle}>
        Arrows show the wind blowing in from that side toward your stand; your
        scent drifts out the opposite side. Tap once for a good wind, twice for
        one to avoid, three times to clear. Each also covers its neighbors (NW
        counts NNW and WNW).
      </p>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  justifyItems: "center",
};

const roseFrameStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "300px",
  aspectRatio: "1 / 1",
};

const mapTextStyle: CSSProperties = {
  pointerEvents: "none",
  paintOrder: "stroke",
  stroke: "rgba(0, 0, 0, 0.7)",
  strokeWidth: 3,
};

// Dark halo so the white arrow reads over satellite imagery.
const mapArrowStyle: CSSProperties = {
  pointerEvents: "none",
  filter: "drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.9))",
};

const svgStyle: CSSProperties = {
  position: "relative",
  display: "block",
  width: "100%",
  height: "auto",
  overflow: "visible",
  touchAction: "manipulation",
  userSelect: "none",
};

const wedgeGroupStyle: CSSProperties = {
  cursor: "pointer",
  outline: "none",
};

const noPointerStyle: CSSProperties = {
  pointerEvents: "none",
};

const summaryStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "0.25rem 1rem",
  margin: 0,
  color: "var(--text)",
  fontSize: "0.95rem",
};

const hintStyle: CSSProperties = {
  margin: 0,
  maxWidth: "36ch",
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  lineHeight: 1.45,
  textAlign: "center",
};
