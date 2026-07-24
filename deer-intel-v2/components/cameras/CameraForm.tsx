import type { CSSProperties, FormEvent } from "react";
import Button from "@/components/ui/Button";
import CompassDial from "@/components/cameras/CompassDial";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { COMPASS_16 } from "@/lib/travelDirection";
import type { CameraStatus, CameraType } from "@/types/camera";

export type CameraFormValues = {
  name: string;
  cameraType: CameraType;
  manufacturer: string;
  model: string;
  status: CameraStatus;
  latitude: string;
  longitude: string;
  facingDirection: string;
  locationNotes: string;
  notes: string;
};

type CameraFormProps = {
  values: CameraFormValues;
  submitLabel: string;
  onChange: (values: CameraFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
};

export default function CameraForm({
  values,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: CameraFormProps) {
  function updateField<Field extends keyof CameraFormValues>(
    field: Field,
    value: CameraFormValues[Field],
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
      <CollapsibleSection title="Basic Info" defaultOpen>
        <div className="di-form-grid" style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Camera Name</span>
            <input
              placeholder="North Ridge Camera"
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Camera Type</span>
            <select
              value={values.cameraType}
              onChange={(event) =>
                updateField(
                  "cameraType",
                  event.target.value === "Cellular" ? "Cellular" : "Standard",
                )
              }
              style={inputStyle}
            >
              <option value="Standard">Standard</option>
              <option value="Cellular">Cellular</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Status</span>
            <select
              value={values.status}
              onChange={(event) =>
                updateField(
                  "status",
                  event.target.value === "Inactive" ? "Inactive" : "Active",
                )
              }
              style={inputStyle}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Camera Details">
        <div className="di-form-grid" style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Manufacturer</span>
            <input
              placeholder="Tactacam, Moultrie, Browning"
              value={values.manufacturer}
              onChange={(event) =>
                updateField("manufacturer", event.target.value)
              }
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Model</span>
            <input
              placeholder="Reveal X, Edge, Strike Force"
              value={values.model}
              onChange={(event) => updateField("model", event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Location">
        <div className="di-form-grid" style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Latitude</span>
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              placeholder="41.1234"
              value={values.latitude}
              onChange={(event) => updateField("latitude", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Longitude</span>
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              placeholder="-78.1234"
              value={values.longitude}
              onChange={(event) => updateField("longitude", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Facing Direction</span>
            <select
              value={values.facingDirection}
              onChange={(event) =>
                updateField("facingDirection", event.target.value)
              }
              style={inputStyle}
            >
              <option value="">Not set</option>
              {COMPASS_16.map((point) => (
                <option key={point} value={point}>
                  {point}
                </option>
              ))}
            </select>
          </label>

          <div style={fieldStyle}>
            <span style={labelStyle}>Or Point It on the Dial</span>
            <CompassDial
              value={values.facingDirection}
              onChange={(point) => updateField("facingDirection", point)}
            />
          </div>
        </div>

        <p style={facingHintStyle}>
          The compass direction the lens looks toward. With it set, Deer Intel
          turns the AI&apos;s &quot;walking left to right&quot; photo reads into
          real travel headings for each buck.
        </p>

        <label style={{ ...fieldStyle, marginTop: "1rem" }}>
          <span style={labelStyle}>Location Notes</span>
          <textarea
            placeholder="Trail, scrape, field edge, creek crossing, or access notes"
            value={values.locationNotes}
            onChange={(event) =>
              updateField("locationNotes", event.target.value)
            }
            style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
          />
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Notes">
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea
            placeholder="Battery issues, card pulls, recent activity, or maintenance notes"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
          />
        </label>
      </CollapsibleSection>

      <div className="di-form-actions" style={buttonRowStyle}>
        <Button type="submit">
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
  gap: "1rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const facingHintStyle: CSSProperties = {
  margin: "0.75rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  lineHeight: 1.5,
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

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};
