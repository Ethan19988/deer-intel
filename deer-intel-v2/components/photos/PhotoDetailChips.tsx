"use client";

import type { CSSProperties } from "react";
import {
  AGE_CLASS_OPTIONS,
  DEER_COUNT_OPTIONS,
  MAX_DEER_COUNT_CHIP,
  cleanAntlerPoints,
  speciesAllowsDeerCount,
} from "@/lib/photoOptions";
import type { PhotoAgeClass } from "@/types/photo";

export type PhotoDetailValues = {
  deerCount?: number;
  ageClass?: PhotoAgeClass | "";
  antlerPoints?: number;
};

type PhotoDetailChipsProps = PhotoDetailValues & {
  species: string;
  idPrefix: string;
  onChange: (patch: PhotoDetailValues) => void;
};

// The extra deer details on one compact block: how many deer (1/2/3/4+), and
// for a buck his age class and point count. Tapping a lit chip clears it —
// "not judged" is always a valid answer.
export default function PhotoDetailChips({
  species,
  idPrefix,
  deerCount,
  ageClass,
  antlerPoints,
  onChange,
}: PhotoDetailChipsProps) {
  if (!speciesAllowsDeerCount(species)) return null;

  const isBuck = species === "Buck";
  const countChip =
    deerCount && deerCount >= MAX_DEER_COUNT_CHIP ? MAX_DEER_COUNT_CHIP : deerCount;

  return (
    <div style={wrapStyle}>
      <div style={rowStyle} role="group" aria-label="Deer in the photo">
        <span style={labelStyle}>Deer</span>
        {DEER_COUNT_OPTIONS.map((count) => {
          const selected = countChip === count;
          return (
            <button
              key={count}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({ deerCount: selected ? undefined : count })}
              style={{ ...chipStyle, ...(selected ? chipOnStyle : null) }}
            >
              {count === MAX_DEER_COUNT_CHIP ? `${count}+` : count}
            </button>
          );
        })}
      </div>

      {isBuck ? (
        <div style={rowStyle} role="group" aria-label="Buck age and points">
          <span style={labelStyle}>Age</span>
          {AGE_CLASS_OPTIONS.map((option) => {
            const selected = ageClass === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ageClass: selected ? "" : option })}
                style={{ ...chipStyle, ...(selected ? chipOnStyle : null) }}
              >
                {option}
              </button>
            );
          })}
          <label style={pointsLabelStyle} htmlFor={`${idPrefix}-points`}>
            <span style={labelStyle}>Pts</span>
            <input
              id={`${idPrefix}-points`}
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              placeholder="–"
              value={antlerPoints ?? ""}
              onChange={(event) =>
                onChange({ antlerPoints: cleanAntlerPoints(event.target.value) })
              }
              style={pointsInputStyle}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.35rem",
};

const labelStyle: CSSProperties = {
  minWidth: "2.4rem",
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.72rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const chipStyle: CSSProperties = {
  minWidth: "44px",
  minHeight: "44px",
  padding: "0 0.55rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.95rem",
  cursor: "pointer",
};

const chipOnStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};

const pointsLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  marginLeft: "0.25rem",
};

const pointsInputStyle: CSSProperties = {
  width: "4rem",
  minHeight: "44px",
  padding: "0 0.5rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
};
