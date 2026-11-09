"use client";

import type { CSSProperties } from "react";
import { SPECIES_OPTIONS } from "@/lib/photoOptions";

type SpeciesSelectProps = {
  id?: string;
  value: string;
  onChange: (species: string) => void;
  style?: CSSProperties;
};

// The species picker every photo form shares. It starts unpicked (never a
// silent "Other") and is outlined until the hunter chooses, so an unidentified
// photo can't slip into the deer counts.
export default function SpeciesSelect({ id, value, onChange, style }: SpeciesSelectProps) {
  const options: readonly string[] = SPECIES_OPTIONS;
  // Older records may carry a label that isn't in today's list; keep it showing.
  const legacy = value && !options.includes(value) ? value : "";

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={!value}
      style={{ ...style, ...(value ? null : unpickedStyle) }}
    >
      <option value="">Choose species…</option>
      {legacy ? <option value={legacy}>{legacy}</option> : null}
      {options.map((species) => (
        <option key={species} value={species}>
          {species === "No animal" ? "No animal (false trigger)" : species}
        </option>
      ))}
    </select>
  );
}

const unpickedStyle: CSSProperties = {
  borderColor: "var(--warning-border)",
  boxShadow: "inset 3px 0 0 var(--warning-text)",
};
