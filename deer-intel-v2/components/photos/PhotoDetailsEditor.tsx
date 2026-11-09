"use client";

import { useState, type CSSProperties } from "react";
import PhotoDateTimeFields from "@/components/photos/PhotoDateTimeFields";
import PhotoDetailChips, {
  type PhotoDetailValues,
} from "@/components/photos/PhotoDetailChips";
import SpeciesSelect from "@/components/photos/SpeciesSelect";
import Button from "@/components/ui/Button";
import { BEHAVIOR_OPTIONS, buckOnlyFields, deerCountFor } from "@/lib/photoOptions";
import type { PhotoCaptureTimeSource, PhotoRecord } from "@/types/photo";

type PhotoDetailsEditorProps = {
  photo: PhotoRecord;
  onSave: (patch: Partial<PhotoRecord>) => void;
  onCancel: () => void;
};

// Fix a saved photo: species, capture date/time, behavior, and the deer
// details (count, age class, points). Saves only on the button press.
export default function PhotoDetailsEditor({ photo, onSave, onCancel }: PhotoDetailsEditorProps) {
  const [species, setSpecies] = useState(photo.species);
  const [photoDate, setPhotoDate] = useState(photo.photoDate);
  const [source, setSource] = useState<PhotoCaptureTimeSource | "">(
    photo.captureTimeSource ?? "",
  );
  const [behavior, setBehavior] = useState(photo.behavior ?? "");
  const [details, setDetails] = useState<PhotoDetailValues>({
    deerCount: photo.deerCount,
    ageClass: photo.ageClass ?? "",
    antlerPoints: photo.antlerPoints,
  });
  const canSave = Boolean(species && photoDate);

  function save() {
    if (!canSave) return;

    onSave({
      species,
      photoDate,
      captureTimeSource: source || undefined,
      behavior: species === "No animal" ? undefined : behavior || undefined,
      deerCount: deerCountFor(species, details.deerCount),
      ...buckOnlyFields(species, details.ageClass, details.antlerPoints),
    });
  }

  return (
    <div style={wrapStyle}>
      <div style={gridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Species</span>
          <SpeciesSelect value={species} onChange={setSpecies} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Behavior</span>
          <select
            value={behavior}
            onChange={(event) => setBehavior(event.target.value)}
            style={inputStyle}
          >
            <option value="">Not observed</option>
            {BEHAVIOR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PhotoDateTimeFields
        idPrefix={`edit-${photo.id}`}
        value={photoDate}
        source={source}
        onChange={(value, nextSource) => {
          setPhotoDate(value);
          setSource(nextSource);
        }}
      />

      <PhotoDetailChips
        idPrefix={`edit-${photo.id}`}
        species={species}
        {...details}
        onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
      />

      <div style={actionsStyle}>
        <Button type="button" onClick={save} disabled={!canSave}>
          Save changes
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
  gap: "0.6rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "46px",
  padding: "0 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "1rem",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};
