import { useState, type CSSProperties, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { formatPropertyCoordinate } from "@/lib/propertyLocation";
import type { Property } from "@/types/property";

export type PropertyFormValues = Pick<
  Property,
  "name" | "county" | "acres" | "notes"
> & {
  // "lat, lng" text, parsed to numbers on save. Empty means no center set.
  coordinate: string;
};

type PropertyFormProps = {
  values: PropertyFormValues;
  submitLabel: string;
  onChange: (values: PropertyFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
};

export default function PropertyForm({
  values,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: PropertyFormProps) {
  const [locationMessage, setLocationMessage] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  function updateField(field: keyof PropertyFormValues, value: string) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationMessage("This device can't share a location.");
      return;
    }

    setIsLocating(true);
    setLocationMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...values,
          coordinate: formatPropertyCoordinate({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        });
        setIsLocating(false);
        setLocationMessage("Set to your current location.");
      },
      () => {
        setIsLocating(false);
        setLocationMessage("Couldn't get your location. Allow access or type it.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
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
            <span style={labelStyle}>Property Name</span>
            <input
              placeholder="Finley Run"
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>County / Region</span>
            <input
              placeholder="Northern PA"
              value={values.county}
              onChange={(event) => updateField("county", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Acres</span>
            <input
              placeholder="Unknown"
              value={values.acres}
              onChange={(event) => updateField("acres", event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Property Center (GPS)">
        <p style={helpTextStyle}>
          Set a center point so live weather and the map know where this
          property is, even before you place cameras or pins. To highlight the
          whole area you hunt, open the Map, pick this property, and tap Draw
          Area.
        </p>
        <div style={coordinateRowStyle}>
          <label style={{ ...fieldStyle, flex: 1, minWidth: "200px" }}>
            <span style={labelStyle}>Latitude, Longitude</span>
            <input
              placeholder="40.90000, -77.80000"
              value={values.coordinate}
              onChange={(event) =>
                updateField("coordinate", event.target.value)
              }
              style={inputStyle}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={useMyLocation}
            disabled={isLocating}
          >
            {isLocating ? "Locating..." : "Use my location"}
          </Button>
        </div>
        {locationMessage ? (
          <p style={locationMessageStyle}>{locationMessage}</p>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection title="Notes">
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea
            placeholder="Access, deer movement, cover, food, wind, and observations"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            style={{ ...inputStyle, minHeight: "110px", resize: "vertical" }}
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

const coordinateRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  alignItems: "flex-end",
};

const helpTextStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  color: "var(--accent-text)",
  fontSize: "0.85rem",
  lineHeight: 1.4,
};

const locationMessageStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  color: "var(--success-text)",
  fontSize: "0.85rem",
};
