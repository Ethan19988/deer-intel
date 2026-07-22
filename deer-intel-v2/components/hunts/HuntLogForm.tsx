import type { CSSProperties, FormEvent } from "react";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import StandPinConvertList from "@/components/hunts/StandPinConvertList";
import LiveWeatherFill from "@/components/weather/LiveWeatherFill";
import type {
  HuntFormValues,
  YesNoValue,
} from "@/lib/huntFormValues";
import { getConvertibleStandPins } from "@/lib/standPins";
import type { WeatherPoint } from "@/lib/liveWeather";
import type { MapPin } from "@/types/mapPin";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

type HuntLogFormProps = {
  values: HuntFormValues;
  properties: Property[];
  stands: Stand[];
  standPins?: MapPin[];
  weatherLocation?: WeatherPoint | null;
  getPropertyName?: (propertyId: string) => string;
  onConvertPin?: (pin: MapPin) => void;
  onChange: (values: HuntFormValues) => void;
  onSubmit: () => void;
};

export default function HuntLogForm({
  values,
  properties,
  stands,
  standPins = [],
  weatherLocation = null,
  getPropertyName,
  onConvertPin,
  onChange,
  onSubmit,
}: HuntLogFormProps) {
  const availableStands = stands.filter(
    (stand) => stand.propertyId === values.propertyId,
  );
  const convertiblePins =
    onConvertPin && values.propertyId
      ? getConvertibleStandPins(standPins, stands, values.propertyId)
      : [];
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
      <CollapsibleSection title="Hunt Details" defaultOpen>
        <div className="di-form-grid" style={formGridStyle}>
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

        {convertiblePins.length > 0 && onConvertPin ? (
          <div style={convertBoxStyle}>
            <StandPinConvertList
              standPins={convertiblePins}
              getPropertyName={getPropertyName ?? ((id) => id)}
              onConvert={onConvertPin}
              title={
                availableStands.length > 0
                  ? "Add a map stand from this property"
                  : "This property's map stands aren't stand sites yet"
              }
              description="These stand pins are on the map but haven't been saved as stand sites, so they can't be selected above. Save one and it's selected for you — the pin stays on the map."
            />
          </div>
        ) : null}

        <div
          className="di-form-grid"
          style={{ ...formGridStyle, marginTop: "1rem" }}
        >
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
      </CollapsibleSection>

      <CollapsibleSection title="Weather and Wind">
        <LiveWeatherFill
          location={weatherLocation}
          when={parseLocalDateTime(values.date, values.startTime)}
          onApply={(fields, source) =>
            onChange({
              ...values,
              ...fields,
              weatherSource: source,
            })
          }
        />
        <div className="di-form-grid" style={formGridStyle}>
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
        </div>

        <div
          className="di-form-grid"
          style={{ ...formGridStyle, marginTop: "1rem" }}
        >
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
      </CollapsibleSection>

      <CollapsibleSection title="Deer Seen">
        <div className="di-form-grid" style={formGridStyle}>
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
      </CollapsibleSection>

      <CollapsibleSection title="Results">
        <div className="di-form-grid" style={formGridStyle}>
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
      </CollapsibleSection>

      <CollapsibleSection title="Notes">
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea
            placeholder="Deer movement, access, pressure, mistakes, or what you learned"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            style={{ ...inputStyle, minHeight: "110px", resize: "vertical" }}
          />
        </label>
      </CollapsibleSection>

      <Button type="submit" disabled={!canSave}>
        Save Hunt
      </Button>
    </form>
  );
}

// Build a local Date from the form's "YYYY-MM-DD" date and "HH:MM" time so the
// weather fill can pull that day (and hour, if given) from history. Constructed
// from parts to stay in local time — new Date("YYYY-MM-DD") would parse as UTC.
function parseLocalDateTime(date: string, time: string): Date | null {
  if (!date) return null;

  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) return null;

  const [hours, minutes] = (time || "").split(":").map(Number);

  return new Date(
    year,
    month - 1,
    day,
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
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

const convertBoxStyle: CSSProperties = {
  marginTop: "1rem",
  padding: "0.9rem",
  borderRadius: "10px",
  border: "1px dashed var(--border)",
  background: "var(--surface-2)",
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
