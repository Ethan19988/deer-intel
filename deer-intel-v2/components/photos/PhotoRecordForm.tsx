"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import DeerProfileMultiSelect from "@/components/photos/DeerProfileMultiSelect";
import PhotoDateTimeFields from "@/components/photos/PhotoDateTimeFields";
import PhotoDetailChips from "@/components/photos/PhotoDetailChips";
import PhotoUploadField, {
  type SelectedPhotoImage,
} from "@/components/photos/PhotoUploadField";
import SpeciesSelect from "@/components/photos/SpeciesSelect";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { formatCameraCheckDate } from "@/lib/cameraChecks";
import type { PhotoFormValues } from "@/lib/photoFormValues";
import { BEHAVIOR_OPTIONS } from "@/lib/photoOptions";
import { COMPASS_16, frameDirectionToHeading } from "@/lib/travelDirection";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";

type PhotoRecordFormProps = {
  values: PhotoFormValues;
  cameraChecks: CameraCheck[];
  deerProfiles?: DeerProfile[];
  // Compass point the camera site faces; lets the AI's frame-relative travel
  // read auto-fill as a real compass heading.
  cameraFacingDirection?: string;
  onChange: (values: PhotoFormValues) => void;
  onSubmit: () => void;
};

export default function PhotoRecordForm({
  values,
  cameraChecks,
  deerProfiles = [],
  cameraFacingDirection = "",
  onChange,
  onSubmit,
}: PhotoRecordFormProps) {
  // A camera check is optional — cellular cams and quick single adds don't need
  // a card-pull. The photo just needs an image (or label), a date, and species.
  const canSave = Boolean(
    (values.fileName || values.imageId) && values.photoDate && values.species,
  );
  // The picked photo's stamp and file data disagreed about the date.
  const [clockWarning, setClockWarning] = useState(false);

  function updateField<Field extends keyof PhotoFormValues>(
    field: Field,
    value: PhotoFormValues[Field],
  ) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  // The saved deer profiles' descriptions let vision recognize individual
  // bucks by their characteristics.
  const knownBucks = deerProfiles.map((profile) => ({
    id: profile.id,
    name: profile.nickname,
    description: [profile.estimatedAge, profile.notes]
      .filter(Boolean)
      .join(" — "),
  }));

  function handleImageSelected(image: SelectedPhotoImage) {
    setClockWarning(image.clockWarning);
    // Only what the photo itself says fills the date: the printed stamp or
    // EXIF ("YYYY-MM-DDTHH:mm"), or a date-only stamp ("YYYY-MM-DD"). The
    // date/time the form was opened at is NOT a capture time, so when the
    // photo carries none the field is cleared for the hunter to set — and
    // the file's own date is never used (for a cellular camera that's when
    // the batch arrived). The label only auto-fills when blank.
    const imageDate = image.capturedAt;
    const detectedSpecies = values.species || image.detectedSpecies;

    onChange({
      ...values,
      imageId: image.imageId,
      imageWidth: image.imageWidth,
      imageHeight: image.imageHeight,
      fileName: values.fileName.trim() || cleanFileLabel(image.fileName),
      photoDate: imageDate,
      captureTimeSource: image.captureSource,
      stampedTemperature: image.stampedTemperature,
      stampedMoonPhase: image.stampedMoonPhase,
      stampedWindDirection: image.stampedWindDirection,
      stampedWindSpeed: image.stampedWindSpeed,
      stampedHumidity: image.stampedHumidity,
      // Pre-select what the AI saw; anything the hunter already picked or
      // typed stays untouched, and everything stays editable before submitting.
      species: detectedSpecies,
      behavior: values.behavior || image.detectedBehavior,
      deerCount: values.deerCount ?? (image.detectedDeerCount || undefined),
      ageClass:
        values.ageClass ||
        (detectedSpecies === "Buck" ? image.detectedAgeClass : ""),
      antlerPoints:
        values.antlerPoints ??
        (detectedSpecies === "Buck" && image.detectedAntlerPoints
          ? image.detectedAntlerPoints
          : undefined),
      frameDirection: image.detectedFrameDirection,
      travelDirection:
        values.travelDirection ||
        frameDirectionToHeading(
          image.detectedFrameDirection,
          cameraFacingDirection,
        ),
      notes: values.notes.trim() ? values.notes : image.detectedNotes,
      // Add the AI's matched buck to the links, but only when nothing was
      // picked yet and it isn't already there — never clobber the hunter's set.
      deerProfileIds:
        values.deerProfileIds.length === 0 && image.matchedProfileId
          ? [image.matchedProfileId]
          : values.deerProfileIds,
    });
  }

  function handleImageCleared() {
    setClockWarning(false);
    onChange({
      ...values,
      imageId: "",
      imageWidth: 0,
      imageHeight: 0,
      stampedTemperature: "",
      stampedMoonPhase: "",
      stampedWindDirection: "",
      stampedWindSpeed: "",
      stampedHumidity: "",
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <CollapsibleSection title="Photo Details" defaultOpen>
        <div style={{ ...fieldStyle, marginBottom: "1rem" }}>
          <span style={labelStyle}>Photo</span>
          <PhotoUploadField
            imageId={values.imageId}
            knownBucks={knownBucks}
            onImageSelected={handleImageSelected}
            onImageCleared={handleImageCleared}
          />
        </div>

        <div className="di-form-grid" style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Camera Check (optional)</span>
            <select
              value={values.cameraCheckId}
              onChange={(event) =>
                updateField("cameraCheckId", event.target.value)
              }
              style={inputStyle}
            >
              <option value="">No camera check</option>
              {cameraChecks.map((check) => (
                <option key={check.id} value={check.id}>
                  {formatCameraCheckDate(check.date)}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Photo Label</span>
            <input
              placeholder="Card pull 7, IMG_2042, or Big 8 at creek"
              value={values.fileName}
              onChange={(event) => updateField("fileName", event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <div
          className="di-form-grid"
          style={{ ...formGridStyle, marginTop: "1rem" }}
        >
          <div style={wideFieldStyle}>
            <PhotoDateTimeFields
              idPrefix="photo-form"
              value={values.photoDate}
              source={values.captureTimeSource}
              clockWarning={clockWarning}
              onChange={(photoDate, captureTimeSource) =>
                onChange({ ...values, photoDate, captureTimeSource })
              }
            />
          </div>

          <label style={fieldStyle}>
            <span style={labelStyle}>Species</span>
            <SpeciesSelect
              value={values.species}
              onChange={(species) => updateField("species", species)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Behavior</span>
            <select
              value={values.behavior}
              onChange={(event) => updateField("behavior", event.target.value)}
              style={inputStyle}
            >
              <option value="">Not observed</option>
              {BEHAVIOR_OPTIONS.map((behavior) => (
                <option key={behavior} value={behavior}>
                  {behavior}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Headed (compass)</span>
            <select
              value={values.travelDirection}
              onChange={(event) =>
                updateField("travelDirection", event.target.value)
              }
              style={inputStyle}
            >
              <option value="">Direction unknown</option>
              {COMPASS_16.map((point) => (
                <option key={point} value={point}>
                  {point}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <PhotoDetailChips
            idPrefix="photo-form"
            species={values.species}
            deerCount={values.deerCount}
            ageClass={values.ageClass}
            antlerPoints={values.antlerPoints}
            onChange={(patch) => onChange({ ...values, ...patch })}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Deer Link">
        <DeerProfileMultiSelect
          deerProfiles={deerProfiles}
          selectedProfileIds={values.deerProfileIds}
          buckNames={values.buckNames}
          idPrefix="photo-form"
          onChange={(deerProfileIds, buckNames) =>
            onChange({ ...values, deerProfileIds, buckNames })
          }
        />
      </CollapsibleSection>

      <CollapsibleSection title="Notes">
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea
            placeholder="Direction of travel, time pattern, behavior, or anything worth remembering"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
          />
        </label>
      </CollapsibleSection>

      <Button type="submit" disabled={!canSave}>
        Add Photo Record
      </Button>
    </form>
  );
}

function cleanFileLabel(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, "").trim();

  return withoutExtension || fileName.trim();
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
  gap: "1rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

// Date + time sit side by side and need the full row.
const wideFieldStyle: CSSProperties = {
  gridColumn: "1 / -1",
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "46px",
  padding: "0.8rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
  lineHeight: 1.4,
};
