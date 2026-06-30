import type { CSSProperties, FormEvent } from "react";
import type { CameraStatus, CameraType } from "@/types/camera";

export type CameraFormValues = {
  name: string;
  cameraType: CameraType;
  manufacturer: string;
  model: string;
  status: CameraStatus;
  latitude: string;
  longitude: string;
  locationNotes: string;
  batteryPercent: string;
  sdCardPercent: string;
  signalStrength: string;
  carrier: string;
  lastChecked: string;
  lastTransmission: string;
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
  const isCellular = values.cameraType === "Cellular";

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
      <div style={formGridStyle}>
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

      <div style={formGridStyle}>
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

        <label style={fieldStyle}>
          <span style={labelStyle}>Last Checked</span>
          <input
            type="date"
            value={values.lastChecked}
            onChange={(event) =>
              updateField("lastChecked", event.target.value)
            }
            style={inputStyle}
          />
        </label>
      </div>

      <div style={formGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Latitude</span>
          <input
            type="number"
            step="any"
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
            placeholder="-78.1234"
            value={values.longitude}
            onChange={(event) => updateField("longitude", event.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={formGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Battery %</span>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="85"
            value={values.batteryPercent}
            onChange={(event) =>
              updateField("batteryPercent", event.target.value)
            }
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>SD Card %</span>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="40"
            value={values.sdCardPercent}
            onChange={(event) =>
              updateField("sdCardPercent", event.target.value)
            }
            style={inputStyle}
          />
        </label>
      </div>

      {isCellular ? (
        <div style={cellularFieldsStyle}>
          <div style={formGridStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Signal Strength</span>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="70"
                value={values.signalStrength}
                onChange={(event) =>
                  updateField("signalStrength", event.target.value)
                }
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Carrier</span>
              <input
                placeholder="Verizon, AT&T, Spartan"
                value={values.carrier}
                onChange={(event) => updateField("carrier", event.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Last Transmission</span>
              <input
                type="datetime-local"
                value={values.lastTransmission}
                onChange={(event) =>
                  updateField("lastTransmission", event.target.value)
                }
                style={inputStyle}
              />
            </label>
          </div>
        </div>
      ) : null}

      <label style={fieldStyle}>
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

      <label style={fieldStyle}>
        <span style={labelStyle}>Notes</span>
        <textarea
          placeholder="Battery issues, card pulls, recent activity, or maintenance notes"
          value={values.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
        />
      </label>

      <div style={buttonRowStyle}>
        <button type="submit" style={submitButtonStyle}>
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
            Cancel
          </button>
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
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "1rem",
};

const cellularFieldsStyle: CSSProperties = {
  padding: "1rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const labelStyle: CSSProperties = {
  color: "#c6d5c5",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  borderRadius: "8px",
  border: "1px solid #2b3a2b",
  background: "#070a07",
  color: "white",
  lineHeight: 1.4,
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const submitButtonStyle: CSSProperties = {
  padding: "0.75rem 1rem",
  borderRadius: "8px",
  border: "none",
  background: "#2f6f3e",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "0.75rem 1rem",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#1b1b1b",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};
