import type { CSSProperties } from "react";

// Tappable chips for the stand form. Single-select chips toggle off when the
// selected one is tapped again (every stand detail can go back to "not set").

type Option<T> = { value: T; label: string };

export function ChipSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  hint?: string;
}) {
  return (
    <div style={groupStyle} role="group" aria-label={label}>
      <span style={chipLabelStyle}>{label}</span>
      <div style={rowStyle}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : option.value)}
              style={{ ...chipStyle, ...(selected ? chipOnStyle : null) }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint ? <span style={hintStyle}>{hint}</span> : null}
    </div>
  );
}

export function ChipMultiSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  return (
    <div style={groupStyle} role="group" aria-label={label}>
      <span style={chipLabelStyle}>{label}</span>
      <div style={rowStyle}>
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange(
                  selected
                    ? value.filter((item) => item !== option)
                    : // Keep the canonical option order however they're tapped.
                      options.filter((item) => item === option || value.includes(item)),
                )
              }
              style={{ ...chipStyle, ...(selected ? chipOnStyle : null) }}
            >
              <span aria-hidden="true">{selected ? "✓ " : "+ "}</span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const groupStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

export const chipLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.4rem",
};

const chipStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 0.9rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-strong, var(--border))",
  background: "transparent",
  color: "var(--text)",
  fontSize: "0.95rem",
  cursor: "pointer",
  touchAction: "manipulation",
};

const chipOnStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};

const hintStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "0.8rem",
  lineHeight: 1.4,
};
