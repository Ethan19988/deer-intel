"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import CountStepper from "@/components/ui/CountStepper";
import LiveWeatherFill from "@/components/weather/LiveWeatherFill";
import {
  EMPTY_CAMERA_CHECK_FORM_VALUES,
  localDateInput,
  type CameraCheckFormValues,
} from "@/lib/cameraCheckFormValues";
import type { WeatherPoint } from "@/lib/liveWeather";

type CameraCheckFormProps = {
  values: CameraCheckFormValues;
  weatherLocation?: WeatherPoint | null;
  onChange: (values: CameraCheckFormValues) => void;
  onSubmit: () => void;
  /** When given, a Cancel button sits beside Save (used when editing). */
  onCancel?: () => void;
  submitLabel?: string;
};

// A save tap is ignored for this long after the last one, so a double-tap on a
// phone can't log the same check twice before the parent resets the form.
const RESUBMIT_GUARD_MS = 1200;

export default function CameraCheckForm({
  values,
  weatherLocation = null,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Save Camera Check",
}: CameraCheckFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBlankForm = isEmptyCheckForm(values);

  // A fresh (or just-reset) form is dated today: most checks are logged at
  // the camera. Only a fully blank form is filled, so editing never changes.
  useEffect(() => {
    if (isBlankForm) onChange({ ...values, date: localDateInput() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBlankForm]);

  useEffect(
    () => () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    },
    [],
  );

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
    if (isSubmitting) return;

    setIsSubmitting(true);
    submitTimerRef.current = setTimeout(
      () => setIsSubmitting(false),
      RESUBMIT_GUARD_MS,
    );
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <CollapsibleSection title="Check Details" defaultOpen>
        <div className="di-form-grid" style={formGridStyle}>
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
              inputMode="numeric"
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
              inputMode="numeric"
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
      </CollapsibleSection>

      <CollapsibleSection title="Weather During Check">
        <LiveWeatherFill
          location={weatherLocation}
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
      </CollapsibleSection>

      <CollapsibleSection title="Wildlife Seen" defaultOpen>
        <div style={countGridStyle}>
          <CountStepper
            label="Bucks"
            value={values.bucks}
            onChange={(value) => updateField("bucks", value)}
          />
          <CountStepper
            label="Does"
            value={values.does}
            onChange={(value) => updateField("does", value)}
          />
          <CountStepper
            label="Fawns"
            value={values.fawns}
            onChange={(value) => updateField("fawns", value)}
          />
          <CountStepper
            label="Turkeys"
            value={values.turkeys}
            onChange={(value) => updateField("turkeys", value)}
          />
          <CountStepper
            label="Bears"
            value={values.bears}
            onChange={(value) => updateField("bears", value)}
          />
          <CountStepper
            label="Coyotes"
            value={values.coyotes}
            onChange={(value) => updateField("coyotes", value)}
          />
        </div>

        <label style={{ ...fieldStyle, marginTop: "1rem" }}>
          <span style={labelStyle}>Other Wildlife</span>
          <input
            placeholder="Bobcat, fox, unknown tracks"
            value={values.otherWildlife}
            onChange={(event) =>
              updateField("otherWildlife", event.target.value)
            }
            style={inputStyle}
          />
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Notes">
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea
            placeholder="Card pull notes, fresh sign, camera angle, deer movement, or maintenance"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
          />
        </label>
      </CollapsibleSection>

      <div style={actionsStyle}>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Saving" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function isEmptyCheckForm(values: CameraCheckFormValues) {
  return (
    Object.keys(EMPTY_CAMERA_CHECK_FORM_VALUES) as (keyof CameraCheckFormValues)[]
  ).every((field) => values[field] === EMPTY_CAMERA_CHECK_FORM_VALUES[field]);
}

// Not di-form-grid: steppers fit two across on a phone, so keep the columns.
const countGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(144px, 100%), 1fr))",
  gap: "1rem",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
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
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
  lineHeight: 1.4,
};
