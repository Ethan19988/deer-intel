import type { CSSProperties, FormEvent } from "react";
import PhotoUploadField, {
  type SelectedPhotoImage,
} from "@/components/photos/PhotoUploadField";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { formatCameraCheckDate } from "@/lib/cameraChecks";
import type { PhotoFormValues } from "@/lib/photoFormValues";
import { COMPASS_16, frameDirectionToHeading } from "@/lib/travelDirection";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";

const SPECIES_OPTIONS = [
  "Buck",
  "Doe",
  "Fawn",
  "Turkey",
  "Bear",
  "Coyote",
  "Other",
];

// Must match the BEHAVIOR_VALUES the photo vision reports.
const BEHAVIOR_OPTIONS = [
  "Traveling",
  "Feeding",
  "Chasing",
  "At scrape or rub",
  "Bedded",
  "Alert",
  "Other",
];

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
    // The photo's own capture date (EXIF) is the most trustworthy source, then
    // the file's date; either wins over the default so the date matches the
    // photo. The label only auto-fills when blank so a typed label is kept.
    const imageDate =
      image.capturedAt.slice(0, 10) || toDateInput(image.lastModified);

    onChange({
      ...values,
      imageId: image.imageId,
      imageWidth: image.imageWidth,
      imageHeight: image.imageHeight,
      fileName: values.fileName.trim() || cleanFileLabel(image.fileName),
      photoDate: imageDate || values.photoDate,
      stampedTemperature: image.stampedTemperature,
      stampedMoonPhase: image.stampedMoonPhase,
      stampedWindDirection: image.stampedWindDirection,
      stampedWindSpeed: image.stampedWindSpeed,
      stampedHumidity: image.stampedHumidity,
      // Pre-select what the AI saw; anything the hunter already picked or
      // typed stays untouched, and everything stays editable before submitting.
      species: values.species || image.detectedSpecies,
      behavior: values.behavior || image.detectedBehavior,
      travelDirection:
        values.travelDirection ||
        frameDirectionToHeading(
          image.detectedFrameDirection,
          cameraFacingDirection,
        ),
      notes: values.notes.trim() ? values.notes : image.detectedNotes,
      deerProfileId: values.deerProfileId || image.matchedProfileId,
      buckName:
        values.buckName.trim() ||
        (image.matchedProfileId
          ? deerProfiles.find((profile) => profile.id === image.matchedProfileId)
              ?.nickname ?? ""
          : ""),
    });
  }

  function handleImageCleared() {
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
          <label style={fieldStyle}>
            <span style={labelStyle}>Photo Date</span>
            <input
              type="date"
              value={values.photoDate}
              onChange={(event) => updateField("photoDate", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Species</span>
            <select
              value={values.species}
              onChange={(event) => updateField("species", event.target.value)}
              style={inputStyle}
            >
              <option value="">Choose species</option>
              {SPECIES_OPTIONS.map((species) => (
                <option key={species} value={species}>
                  {species}
                </option>
              ))}
            </select>
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
      </CollapsibleSection>

      <CollapsibleSection title="Deer Link">
        <div className="di-form-grid" style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Buck Name</span>
            <input
              placeholder="Optional"
              value={values.buckName}
              onChange={(event) => updateField("buckName", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Deer Profile</span>
            <select
              value={values.deerProfileId}
              onChange={(event) =>
                updateField("deerProfileId", event.target.value)
              }
              style={inputStyle}
            >
              <option value="">No profile linked</option>
              {deerProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.nickname}
                </option>
              ))}
            </select>
          </label>
        </div>
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

function toDateInput(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "1rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
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
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
  lineHeight: 1.4,
};
