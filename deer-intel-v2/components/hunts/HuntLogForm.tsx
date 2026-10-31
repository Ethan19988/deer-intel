import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import Button from "@/components/ui/Button";
import StandPinConvertList from "@/components/hunts/StandPinConvertList";
import LiveWeatherFill, {
  type WeatherFillInfo,
} from "@/components/weather/LiveWeatherFill";
import type {
  HuntFormValues,
  YesNoValue,
} from "@/lib/huntFormValues";
import { getConvertibleStandPins } from "@/lib/standPins";
import {
  mergeWeatherFill,
  WEATHER_FILL_FIELDS,
  type LiveWeatherFields,
  type WeatherPoint,
} from "@/lib/liveWeather";
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
  // A state setter, so async updates (the weather fill) can merge into the
  // latest values instead of overwriting taps made while they were loading.
  onChange: Dispatch<SetStateAction<HuntFormValues>>;
  onSubmit: () => void;
  /** Save button text; "Save sit" by default, e.g. "Save changes" when editing. */
  submitLabel?: string;
  /** When given (editing), shows a Cancel button beside Save. */
  onCancel?: () => void;
  /**
   * Fill the weather on its own and refresh it when the date or start time
   * changes (fields typed by hand are kept). Off when editing a saved sit, so
   * opening one never rewrites its recorded weather.
   */
  autoFillWeather?: boolean;
};

// How long Save stays locked after a tap, so a double-tap can't log twice.
const SUBMIT_LOCK_MS = 1000;

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
  submitLabel = "Save sit",
  onCancel,
  autoFillWeather = true,
}: HuntLogFormProps) {
  // What the last automatic weather fill wrote, field by field. A field still
  // matching it is the fill's to refresh; one the hunter changed is theirs.
  // Kept in a ref (read by async fills) and mirrored in state for the tag.
  const autoFilledRef = useRef<Partial<LiveWeatherFields>>({});
  const [autoFilled, setAutoFilled] = useState<Partial<LiveWeatherFields>>({});
  const [fillLabel, setFillLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest rendered values, for fills that resolve after an await.
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(
    () => () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    },
    [],
  );

  function rememberAutoFilled(next: Partial<LiveWeatherFields>) {
    autoFilledRef.current = next;
    setAutoFilled(next);
  }

  function applyWeather(
    fields: LiveWeatherFields,
    source: HuntFormValues["weatherSource"],
    info: WeatherFillInfo,
  ) {
    if (info.auto) {
      const previous = autoFilledRef.current;
      const preview = mergeWeatherFill(valuesRef.current, fields, previous);

      rememberAutoFilled(preview.autoFilled);
      if (preview.changed) setFillLabel(info.label);

      // Merge again inside the updater so typing since the last render wins.
      onChange((current) => {
        const merged = mergeWeatherFill(current, fields, previous);
        return merged.changed
          ? { ...merged.values, weatherSource: source }
          : current;
      });
      return;
    }

    // A tap on the button is an explicit ask: replace every weather field.
    onChange((current) => ({ ...current, ...fields, weatherSource: source }));
    rememberAutoFilled({ ...fields });
    setFillLabel(info.label);
  }
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
    if (!canSave || submitLock.current) return;

    submitLock.current = true;
    setSubmitting(true);
    onSubmit();
    // A fresh form starts with no auto-fill history.
    rememberAutoFilled({});
    setFillLabel("");
    unlockTimer.current = setTimeout(() => {
      submitLock.current = false;
      setSubmitting(false);
    }, SUBMIT_LOCK_MS);
  }

  const weatherSummary = [
    [values.windDirection, values.windSpeed].filter(Boolean).join(" "),
    values.temperature
      ? `${values.temperature}${/°/.test(values.temperature) ? "" : "°"}`
      : "",
    values.weather,
    values.moonPhase ? `Moon ${values.moonPhase}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  // Which weather fields the hunter has changed since the last fill.
  const editedAfterFill =
    Boolean(fillLabel) &&
    WEATHER_FILL_FIELDS.some(
      (field) => autoFilled[field] !== undefined && values[field] !== autoFilled[field],
    );
  const fillTag = fillLabel
    ? `${fillLabel}${editedAfterFill ? " · edited" : ""}`
    : values.weatherSource !== "manual"
      ? "Saved weather"
      : "";

  // One flat column of hairline-separated rows, phone first: the stand and
  // times up top, the weather as a single filled-in line (editable under it),
  // the deer counts as big steppers, then the result toggles and notes.
  return (
    <form onSubmit={handleSubmit} style={formStyle} className="di-sit-form">
      <div style={rowStyle}>
        {properties.length > 1 ? (
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
        ) : null}

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
      </div>

      <div style={{ ...rowStyle, ...timeGridStyle }}>
        <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
          <span style={labelStyle}>Date</span>
          <input
            type="date"
            value={values.date}
            onChange={(event) => updateField("date", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>In</span>
          <input
            type="time"
            value={values.startTime}
            onChange={(event) => updateField("startTime", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Out</span>
          <input
            type="time"
            value={values.endTime}
            onChange={(event) => updateField("endTime", event.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={rowStyle}>
        <div style={labelRowStyle}>
          <span style={labelStyle}>Weather</span>
          {fillTag ? <span style={filledStyle}>{fillTag}</span> : null}
        </div>
        <p style={weatherLineStyle}>
          {weatherSummary || "Not filled in yet"}
        </p>
        <details style={detailsStyle}>
          <summary style={summaryStyle}>Edit weather</summary>
          <LiveWeatherFill
            location={weatherLocation}
            autoFetch={autoFillWeather}
            when={parseLocalDateTime(values.date, values.startTime)}
            onApply={applyWeather}
          />
          <div style={weatherGridStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Wind direction</span>
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
              <span style={labelStyle}>Wind speed</span>
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
              <span style={labelStyle}>Moon phase</span>
              <input
                placeholder="Full, new, waxing"
                value={values.moonPhase}
                onChange={(event) => updateField("moonPhase", event.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
        </details>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>What you saw</span>
        <div>
          <CountField
            label="Bucks seen"
            value={values.bucks}
            onChange={(value) => updateField("bucks", value)}
          />
          <CountField
            label="Does seen"
            value={values.does}
            onChange={(value) => updateField("does", value)}
          />
          <CountField
            label="Fawns seen"
            value={values.fawns}
            onChange={(value) => updateField("fawns", value)}
          />
        </div>
      </div>

      <div style={{ ...rowStyle, ...twoColStyle }}>
        <YesNoField
          label="Shot opportunity"
          value={values.shotOpportunity}
          onChange={(value) => updateField("shotOpportunity", value)}
        />
        <YesNoField
          label="Harvest"
          value={values.harvest}
          onChange={(value) => updateField("harvest", value)}
        />
      </div>

      <label style={{ ...rowStyle, borderBottom: 0 }}>
        <span style={labelStyle}>Notes</span>
        <textarea
          placeholder="Where they came from, what they did, what you learned"
          value={values.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          style={{ ...inputStyle, minHeight: "96px", resize: "vertical" }}
        />
      </label>

      <div style={onCancel ? submitRowStyle : undefined}>
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            style={saveStyle}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={!canSave || submitting}
          style={saveStyle}
        >
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>
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

// Big −/+ buttons beside the count: tapping is faster than the number keyboard
// with cold hands in a stand, and the field still accepts typing.
function CountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const count = Math.max(0, Math.floor(Number(value) || 0));

  return (
    <div style={countRowStyle}>
      <span style={countLabelStyle}>{label}</span>
      <div style={stepperStyle}>
        <button
          type="button"
          aria-label={`One fewer ${label.toLowerCase()}`}
          onClick={() => onChange(String(Math.max(0, count - 1)))}
          disabled={count === 0}
          style={stepperButtonStyle}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          placeholder="0"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={stepperInputStyle}
        />
        <button
          type="button"
          aria-label={`One more ${label.toLowerCase()}`}
          onClick={() => onChange(String(count + 1))}
          style={stepperButtonStyle}
        >
          +
        </button>
      </div>
    </div>
  );
}

// One tap tile: a box that checks on and off, the answer visible at a glance.
function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNoValue;
  onChange: (value: YesNoValue) => void;
}) {
  const checked = value === "Yes";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(checked ? "No" : "Yes")}
      style={{ ...toggleTileStyle, ...(checked ? toggleTileOnStyle : null) }}
    >
      <span
        aria-hidden="true"
        style={{ ...checkBoxStyle, ...(checked ? checkBoxOnStyle : null) }}
      >
        {checked ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: 0,
};

const rowStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
  padding: "0.9rem 0",
  borderBottom: "1px solid var(--border)",
};

const timeGridStyle: CSSProperties = {
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.75rem 0.5rem",
};

const twoColStyle: CSSProperties = {
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.5rem",
};

const convertBoxStyle: CSSProperties = {
  padding: "0.9rem",
  borderRadius: "var(--radius-sm)",
  border: "1px dashed var(--border)",
  background: "var(--surface-2)",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const labelRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "0.5rem",
};

const filledStyle: CSSProperties = {
  ...labelStyle,
  color: "var(--accent-text)",
};

const weatherLineStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.85rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  lineHeight: 1.5,
};

const detailsStyle: CSSProperties = {
  display: "grid",
};

const summaryStyle: CSSProperties = {
  ...labelStyle,
  minHeight: "40px",
  display: "flex",
  alignItems: "center",
  color: "var(--text)",
  cursor: "pointer",
};

const weatherGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
  gap: "0.75rem",
  paddingTop: "0.4rem",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: "48px",
  padding: "0.7rem 0.8rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-strong, var(--border))",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
  lineHeight: 1.4,
};

const countRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.45rem 0",
  borderBottom: "1px solid var(--border)",
};

const countLabelStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "0.98rem",
};

const stepperStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 52px 44px",
  gap: "0.35rem",
  alignItems: "stretch",
  flex: "none",
};

const stepperButtonStyle: CSSProperties = {
  minHeight: "44px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-strong, var(--border))",
  background: "transparent",
  color: "var(--text)",
  fontSize: "1.3rem",
  lineHeight: 1,
  cursor: "pointer",
  touchAction: "manipulation",
};

const stepperInputStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: 0,
  border: 0,
  background: "transparent",
  color: "var(--text)",
  textAlign: "center",
  fontFamily: "var(--font-display), sans-serif",
  fontSize: "1.7rem",
  MozAppearance: "textfield",
};

const toggleTileStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.65rem",
  minHeight: "52px",
  padding: "0 0.85rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-strong, var(--border))",
  background: "transparent",
  color: "var(--text)",
  fontSize: "0.95rem",
  textAlign: "left",
  cursor: "pointer",
  touchAction: "manipulation",
};

const toggleTileOnStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent-tint)",
};

const checkBoxStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "20px",
  height: "20px",
  flex: "none",
  border: "1.5px solid var(--text-muted)",
  borderRadius: "2px",
  fontSize: "0.8rem",
  lineHeight: 1,
};

const checkBoxOnStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent)",
  color: "var(--on-accent, #0b0d0b)",
};

const submitRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr",
  gap: "0.5rem",
};

const saveStyle: CSSProperties = {
  width: "100%",
  minHeight: "54px",
  marginTop: "0.5rem",
  fontSize: "1.25rem",
};
