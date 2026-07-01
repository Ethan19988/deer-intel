import type { CSSProperties, FormEvent } from "react";
import Button from "@/components/ui/Button";
import type {
  HuntFormValues,
  YesNoValue,
} from "@/lib/huntFormValues";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

type HuntLogFormProps = {
  values: HuntFormValues;
  properties: Property[];
  stands: Stand[];
  onChange: (values: HuntFormValues) => void;
  onSubmit: () => void;
};

export default function HuntLogForm({
  values,
  properties,
  stands,
  onChange,
  onSubmit,
}: HuntLogFormProps) {
  const availableStands = stands.filter(
    (stand) => stand.propertyId === values.propertyId,
  );
  const canSave = Boolean(values.propertyId && values.standId && values.date);

  function updateField<Field extends keyof HuntFormValues>(
    field: Field,
    value: HuntFormValues[Field],
  ) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  function updateProperty(propertyId: string) {
    const standStillBelongsToProperty = stands.some(
      (stand) => stand.id === values.standId && stand.propertyId === propertyId,
    );

    onChange({
      ...values,
      propertyId,
      standId: standStillBelongsToProperty ? values.standId : "",
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
          <span style={labelStyle}>Property</span>
          <select
            value={values.propertyId}
            onChange={(event) => updateProperty(event.target.value)}
            style={inputStyle}
          >
            <option value="">Choose property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Stand</span>
          <select
            value={values.standId}
            onChange={(event) => updateField("standId", event.target.value)}
            style={inputStyle}
            disabled={!values.propertyId || availableStands.length === 0}
          >
            <option value="">
              {values.propertyId ? "Choose stand" : "Choose property first"}
            </option>
            {availableStands.map((stand) => (
              <option key={stand.id} value={stand.id}>
                {stand.name}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Date</span>
          <input
            type="date"
            value={values.date}
            onChange={(event) => updateField("date", event.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={formGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Start Time</span>
          <input
            type="time"
            value={values.startTime}
            onChange={(event) => updateField("startTime", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>End Time</span>
          <input
            type="time"
            value={values.endTime}
            onChange={(event) => updateField("endTime", event.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={formGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Wind Direction</span>
          <input
            placeholder="NW, W, S"
            value={values.windDirection}
            onChange={(event) => updateField("windDirection", event.target.value)}
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
          <span style={labelStyle}>Temperature</span>
          <input
            placeholder="42"
            value={values.temperature}
            onChange={(event) => updateField("temperature", event.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={formGridStyle}>
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

      <div style={formGridStyle}>
        <CountField
          label="Bucks Seen"
          value={values.bucks}
          onChange={(value) => updateField("bucks", value)}
        />
        <CountField
          label="Does Seen"
          value={values.does}
          onChange={(value) => updateField("does", value)}
        />
        <CountField
          label="Fawns Seen"
          value={values.fawns}
          onChange={(value) => updateField("fawns", value)}
        />
      </div>

      <div style={formGridStyle}>
        <YesNoField
          label="Shot Opportunity"
          value={values.shotOpportunity}
          onChange={(value) => updateField("shotOpportunity", value)}
        />
        <YesNoField
          label="Harvest"
          value={values.harvest}
          onChange={(value) => updateField("harvest", value)}
        />
      </div>

      <label style={fieldStyle}>
        <span style={labelStyle}>Notes</span>
        <textarea
          placeholder="Deer movement, access, pressure, mistakes, or what you learned"
          value={values.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          style={{ ...inputStyle, minHeight: "110px", resize: "vertical" }}
        />
      </label>

      <Button type="submit" disabled={!canSave}>
        Save Hunt
      </Button>
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

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNoValue;
  onChange: (value: YesNoValue) => void;
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as YesNoValue)}
        style={inputStyle}
      >
        <option value="No">No</option>
        <option value="Yes">Yes</option>
      </select>
    </label>
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
