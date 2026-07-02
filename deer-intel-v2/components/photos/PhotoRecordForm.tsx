import type { CSSProperties, FormEvent } from "react";
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
    values.cameraCheckId && values.fileName && values.photoDate && values.species,
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <CollapsibleSection title="Photo Details" defaultOpen>
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
            <span style={labelStyle}>File Name or Photo Label</span>
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
  color: "#c6d5c5",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "46px",
  padding: "0.8rem",
  borderRadius: "8px",
  border: "1px solid #2b3a2b",
  background: "#070a07",
  color: "white",
  fontSize: "1rem",
  lineHeight: 1.4,
};
