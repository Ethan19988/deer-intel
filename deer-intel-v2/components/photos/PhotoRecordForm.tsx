import type { CSSProperties, FormEvent } from "react";
import PhotoUploadField, {
  type SelectedPhotoImage,
} from "@/components/photos/PhotoUploadField";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { formatCameraCheckDate } from "@/lib/cameraChecks";
import type { PhotoFormValues } from "@/lib/photoFormValues";
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

type PhotoRecordFormProps = {
  values: PhotoFormValues;
  cameraChecks: CameraCheck[];
  deerProfiles?: DeerProfile[];
  onChange: (values: PhotoFormValues) => void;
  onSubmit: () => void;
};

export default function PhotoRecordForm({
  values,
  cameraChecks,
  deerProfiles = [],
  onChange,
  onSubmit,
}: PhotoRecordFormProps) {
  const canSave = Boolean(
    values.cameraCheckId &&
      (values.fileName || values.imageId) &&
      values.photoDate &&
      values.species,
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

  function handleImageSelected(image: SelectedPhotoImage) {
    onChange({
      ...values,
      imageId: image.imageId,
      imageWidth: image.imageWidth,
      imageHeight: image.imageHeight,
      // Auto-fill the label and date from the file, but never clobber anything
      // the user already typed.
      fileName: values.fileName.trim() || cleanFileLabel(image.fileName),
      photoDate: values.photoDate.trim() || toDateInput(image.lastModified),
    });
  }

  function handleImageCleared() {
    onChange({
      ...values,
      imageId: "",
      imageWidth: 0,
      imageHeight: 0,
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
            onImageSelected={handleImageSelected}
            onImageCleared={handleImageCleared}
          />
        </div>

        <div className="di-form-grid" style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Camera Check</span>
            <select
              value={values.cameraCheckId}
              onChange={(event) =>
                updateField("cameraCheckId", event.target.value)
              }
              style={inputStyle}
            >
              <option value="">Choose check</option>
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
