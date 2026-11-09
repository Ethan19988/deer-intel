"use client";

import { useId, useState, type CSSProperties, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import CountStepper from "@/components/ui/CountStepper";
import {
  BATTERY_CHOICES,
  choiceForValue,
  createCameraCheckFromValues,
  newCameraCheckFormValues,
  SD_CARD_CHOICES,
  type CameraCheckFormValues,
  type CheckChoice,
} from "@/lib/cameraCheckFormValues";
import { addCameraCheckToState } from "@/lib/cameraChecks";
import { createDeerIntelId, updateDeerIntelStore } from "@/lib/deerIntelStore";
import type { Camera } from "@/types/camera";

type QuickCameraCheckProps = {
  camera: Camera;
  onDone: () => void;
};

// The on-foot camera check: today's date, battery and card as one tap each,
// deer counts on big steppers, a note only if you want one. Saves straight to
// the store; the full form (weather, other wildlife) stays on the camera page.
export default function QuickCameraCheck({
  camera,
  onDone,
}: QuickCameraCheckProps) {
  const headingId = useId();
  const [values, setValues] = useState<CameraCheckFormValues>(() =>
    newCameraCheckFormValues(),
  );
  // One id per open form: a second save of the same check is a no-op.
  const [checkId] = useState(() => createDeerIntelId("camera-check"));
  const [showNote, setShowNote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function update<Field extends keyof CameraCheckFormValues>(
    field: Field,
    value: CameraCheckFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const check = createCameraCheckFromValues({
      id: checkId,
      propertyId: camera.propertyId,
      cameraId: camera.id,
      values,
    });
    if (!check) return;

    setIsSaving(true);
    updateDeerIntelStore((state) => addCameraCheckToState(state, check));
    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby={headingId}
      style={panelStyle}
    >
      <div style={headerStyle}>
        <h3 id={headingId} style={titleStyle}>
          Check {camera.name}
        </h3>
        <label style={dateFieldStyle}>
          <span style={labelStyle}>Date</span>
          <input
            type="date"
            required
            value={values.date}
            onChange={(event) => update("date", event.target.value)}
            style={dateInputStyle}
          />
        </label>
      </div>

      <ChoiceGroup
        label="Battery"
        choices={BATTERY_CHOICES}
        value={values.batteryPercent}
        onChange={(value) => update("batteryPercent", value)}
      />
      <ChoiceGroup
        label="SD card"
        choices={SD_CARD_CHOICES}
        value={values.sdCardPercent}
        onChange={(value) => update("sdCardPercent", value)}
      />

      <div style={countGridStyle}>
        <CountStepper
          size="lg"
          label="Bucks"
          value={values.bucks}
          onChange={(value) => update("bucks", value)}
        />
        <CountStepper
          size="lg"
          label="Does"
          value={values.does}
          onChange={(value) => update("does", value)}
        />
        <CountStepper
          size="lg"
          label="Fawns"
          value={values.fawns}
          onChange={(value) => update("fawns", value)}
        />
      </div>

      {showNote ? (
        <label style={noteFieldStyle}>
          <span style={labelStyle}>Note</span>
          <textarea
            autoFocus
            placeholder="Fresh scrape, moved the camera, swapped batteries"
            value={values.notes}
            onChange={(event) => update("notes", event.target.value)}
            style={noteInputStyle}
          />
        </label>
      ) : (
        <button
          type="button"
          style={addNoteStyle}
          onClick={() => setShowNote(true)}
        >
          + Add note
        </button>
      )}

      <div style={actionsStyle}>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSaving || !values.date}
          aria-busy={isSaving}
        >
          {isSaving ? "Saving" : "Save check"}
        </Button>
      </div>
    </form>
  );
}

// A one-tap segmented pick. Tapping the selected choice again clears it, so
// "not looked at" stays possible. A hand-typed value from the full form that
// matches no choice shows as no selection and is kept until a choice is tapped.
function ChoiceGroup({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: readonly CheckChoice[];
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = choiceForValue(choices, value);

  return (
    <div role="group" aria-label={label} style={choiceGroupStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={choiceRowStyle}>
        {choices.map((choice) => {
          const isSelected = selected === choice;

          return (
            <button
              key={choice.label}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(isSelected ? "" : choice.value)}
              style={{
                ...choiceStyle,
                ...(isSelected
                  ? choice.warn
                    ? choiceWarnStyle
                    : choiceGoodStyle
                  : null),
              }}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  margin: "0 0 0.75rem",
  padding: "1rem",
  border: "1px solid var(--border-strong)",
  borderLeft: "3px solid var(--accent)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  margin: 0,
  minWidth: 0,
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1.5rem",
  fontWeight: 400,
  letterSpacing: "0.04em",
  lineHeight: 1.05,
  overflowWrap: "anywhere",
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.72rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const dateFieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
};

const dateInputStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
};

const choiceGroupStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const choiceRowStyle: CSSProperties = {
  display: "grid",
  gridAutoColumns: "1fr",
  gridAutoFlow: "column",
  gap: "0.35rem",
};

const choiceStyle: CSSProperties = {
  minHeight: "48px",
  padding: "0 0.4rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text-muted)",
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1.1rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const choiceGoodStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};

const choiceWarnStyle: CSSProperties = {
  borderColor: "var(--warning-border)",
  background: "var(--warning-bg)",
  color: "var(--warning-text)",
};

// Three steppers in a row on desktop, wrapping on a narrow phone.
const countGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
  gap: "0.85rem",
};

const addNoteStyle: CSSProperties = {
  justifySelf: "start",
  minHeight: "44px",
  padding: "0 0.25rem",
  border: 0,
  background: "transparent",
  color: "var(--accent-text)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.75rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const noteFieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const noteInputStyle: CSSProperties = {
  width: "100%",
  minHeight: "88px",
  padding: "0.7rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
  lineHeight: 1.4,
  resize: "vertical",
};

const actionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr",
  gap: "0.6rem",
};
