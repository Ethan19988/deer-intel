import type { CSSProperties, FormEvent } from "react";
import Button from "@/components/ui/Button";
import type { CameraCheckFormValues } from "@/lib/cameraCheckFormValues";

type CameraCheckFormProps = {
  values: CameraCheckFormValues;
  onChange: (values: CameraCheckFormValues) => void;
  onSubmit: () => void;
};

export default function CameraCheckForm({
  values,
  onChange,
  onSubmit,
}: CameraCheckFormProps) {
  function updateField<Field extends keyof CameraCheckFormValues>(
    field: Field,
    value: CameraCheckFormValues[Field],
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
          <span style={labelStyle}>Check Date</span>
          <input
            type="date"
            value={values.date}
            onChange={(event) => updateField("date", event.target.value)}
            style={inputStyle}
          />
        </label>

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

        <label style={fieldStyle}>
          <span style={labelStyle}>Signal %</span>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="Cell cameras only"
            value={values.signalStrength}
            onChange={(event) =>
              updateField("signalStrength", event.target.value)
            }
            style={inputStyle}
          />
        </label>
      </div>

      <div style={sectionBlockStyle}>
        <p style={sectionLabelStyle}>Weather During Check</p>
        <div style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Temperature</span>
            <input
              placeholder="42"
              value={values.temperature}
              onChange={(event) =>
                updateField("temperature", event.target.value)
              }
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Wind Direction</span>
            <input
              placeholder="NW, W, S"
              value={values.windDirection}
              onChange={(event) =>
                updateField("windDirection", event.target.value)
              }
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Wind Speed</span>
            <input
              placeholder="8 mph"
              value={values.windSpeed}
              onChange={(event) => updateField("windSpeed", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Weather</span>
            <input
              placeholder="Clear, rain, snow, cloudy"
              value={values.weather}
              onChange={(event) => updateField("weather", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Moon Phase</span>
            <input
              placeholder="Full, new, waxing"
              value={values.moonPhase}
              onChange={(event) => updateField("moonPhase", event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
      </div>

      <div style={formGridStyle}>
        <CountField
          label="Bucks"
          value={values.bucks}
          onChange={(value) => updateField("bucks", value)}
        />
        <CountField
          label="Does"
          value={values.does}
          onChange={(value) => updateField("does", value)}
        />
        <CountField
          label="Fawns"
          value={values.fawns}
          onChange={(value) => updateField("fawns", value)}
        />
        <CountField
          label="Turkeys"
          value={values.turkeys}
          onChange={(value) => updateField("turkeys", value)}
        />
        <CountField
          label="Bears"
          value={values.bears}
          onChange={(value) => updateField("bears", value)}
        />
        <CountField
          label="Coyotes"
          value={values.coyotes}
          onChange={(value) => updateField("coyotes", value)}
        />
      </div>

      <label style={fieldStyle}>
        <span style={labelStyle}>Other Wildlife</span>
        <input
          placeholder="Bobcat, fox, raccoon, unknown tracks"
          value={values.otherWildlife}
          onChange={(event) => updateField("otherWildlife", event.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>Notes</span>
        <textarea
          placeholder="Card pull notes, fresh sign, camera angle, deer movement, or maintenance"
          value={values.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
        />
      </label>

      <Button type="submit">Save Camera Check</Button>
    </form>
  );
}

function CountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="number"
        min="0"
        placeholder="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "1rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const sectionBlockStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  paddingTop: "0.25rem",
};

const sectionLabelStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "1rem",
  fontWeight: 800,
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
