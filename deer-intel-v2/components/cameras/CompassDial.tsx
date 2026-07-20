"use client";

import { useRef, type CSSProperties, type PointerEvent } from "react";
import { compassToDegrees, degreesToCompass } from "@/lib/travelDirection";

type CompassDialProps = {
  value: string;
  onChange: (point: string) => void;
};

const SIZE = 168;
const CENTER = SIZE / 2;
const RING_RADIUS = 70;
const LABEL_RADIUS = 55;
// Matches the map's camera view cone: ±22° reads as a lens field of view.
const CONE_HALF_ANGLE = 22;
const CONE_RADIUS = 62;
// Taps this close to the center are ignored — too ambiguous to aim from.
const DEAD_ZONE_RADIUS = 10;

/**
 * A tappable compass rose for pointing a camera: tap (or drag) toward where
 * the lens looks and the nearest 16-wind point is chosen. Pairs with the
 * Facing Direction select — both edit the same value.
 */
export default function CompassDial({ value, onChange }: CompassDialProps) {
  const isDragging = useRef(false);
  const degrees = compassToDegrees(value);

  function pointFromEvent(event: PointerEvent<SVGSVGElement>): string | null {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);

    if (dx * dx + dy * dy < DEAD_ZONE_RADIUS * DEAD_ZONE_RADIUS) return null;

    // Screen up is north, screen right is east.
    return degreesToCompass((Math.atan2(dx, -dy) * 180) / Math.PI);
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    event.preventDefault();
    // Keeps drags tracked outside the dial; not every pointer supports it.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Tap-only fallback.
    }
    isDragging.current = true;

    const point = pointFromEvent(event);

    if (point && point !== value) onChange(point);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!isDragging.current) return;

    const point = pointFromEvent(event);

    if (point && point !== value) onChange(point);
  }

  function handlePointerUp() {
    isDragging.current = false;
  }

  const coneRad = (CONE_HALF_ANGLE * Math.PI) / 180;
  const coneLeftX = CENTER - CONE_RADIUS * Math.sin(coneRad);
  const coneRightX = CENTER + CONE_RADIUS * Math.sin(coneRad);
  const coneTipY = CENTER - CONE_RADIUS * Math.cos(coneRad);

  return (
    <div style={wrapStyle}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Tap toward where the camera lens points"
        style={dialStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS}
          fill="var(--surface-2)"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={1.5}
        />

        {Array.from({ length: 16 }, (_, index) => {
          const isCardinal = index % 4 === 0;
          const length = isCardinal ? 9 : 5;

          return (
            <line
              key={index}
              x1={CENTER}
              y1={CENTER - RING_RADIUS}
              x2={CENTER}
              y2={CENTER - RING_RADIUS + length}
              stroke="currentColor"
              strokeOpacity={isCardinal ? 0.7 : 0.35}
              strokeWidth={isCardinal ? 2 : 1.4}
              transform={`rotate(${index * 22.5} ${CENTER} ${CENTER})`}
            />
          );
        })}

        {["N", "E", "S", "W"].map((label, index) => {
          const angle = (index * 90 * Math.PI) / 180;
          const x = CENTER + LABEL_RADIUS * Math.sin(angle);
          const y = CENTER - LABEL_RADIUS * Math.cos(angle);

          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="currentColor"
              fillOpacity={0.75}
              fontSize={13}
              fontWeight={800}
            >
              {label}
            </text>
          );
        })}

        {degrees !== null ? (
          <g transform={`rotate(${degrees} ${CENTER} ${CENTER})`}>
            <path
              d={`M${CENTER} ${CENTER} L${coneLeftX.toFixed(1)} ${coneTipY.toFixed(1)}
                A${CONE_RADIUS} ${CONE_RADIUS} 0 0 1 ${coneRightX.toFixed(1)} ${coneTipY.toFixed(1)} Z`}
              fill="var(--accent)"
              fillOpacity={0.22}
              stroke="var(--accent)"
              strokeOpacity={0.75}
              strokeWidth={1.6}
            />
            <line
              x1={CENTER}
              y1={CENTER}
              x2={CENTER}
              y2={CENTER - CONE_RADIUS}
              stroke="var(--accent)"
              strokeWidth={2.4}
            />
          </g>
        ) : null}

        <circle cx={CENTER} cy={CENTER} r={4} fill="var(--accent)" />
      </svg>

      <p style={readoutStyle}>
        {value ? `Facing ${value}` : "Tap toward where the lens looks"}
      </p>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
  justifyItems: "center",
};

const dialStyle: CSSProperties = {
  display: "block",
  color: "var(--text)",
  cursor: "pointer",
  touchAction: "none",
};

const readoutStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
};
