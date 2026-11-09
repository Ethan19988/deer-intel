import type { CSSProperties, FormEvent } from "react";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { ChipMultiSelect, ChipSelect } from "@/components/stands/StandChips";
import StandLocationField from "@/components/stands/StandLocationField";
import WindPicker from "@/components/stands/WindPicker";
import type { StandFormValues } from "@/lib/standFormValues";
import {
  hasUnreadableWindText,
  windMarksFromText,
  windTextForSave,
} from "@/lib/windPicker";
import {
  STAND_BEST_TIME_LABEL,
  STAND_BEST_TIMES,
  STAND_SETUPS,
  STAND_SHOT_YARDS,
  STAND_TYPES,
  STAND_WEAPON_LABEL,
  STAND_WEAPONS,
  shotYardsLabel,
  type StandBestTime,
  type StandType,
  type StandWeapon,
} from "@/types/stand";

type StandFormProps = {
  values: StandFormValues;
  onChange: (values: StandFormValues) => void;
  onSubmit: () => void;
  /** "edit" shows Save/Cancel and keeps the saved pin's location. */
  mode?: "add" | "edit";
  onCancel?: () => void;
  /** Validation message from the last submit. */
  error?: string | null;
  /** Editing: the stand's saved map coordinates (as formatted in the form). */
  savedLocation?: { lat: string; lng: string } | null;
};

// Add or edit a stand. Basics first (name, type, best time, location) so a
// stand can be saved in a few taps; winds, details and route notes follow.
export default function StandForm({
  values,
  onChange,
  onSubmit,
  mode = "add",
  onCancel,
  error,
  savedLocation = null,
}: StandFormProps) {
  function updateField<Field extends keyof StandFormValues>(
    field: Field,
    value: StandFormValues[Field],
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

  const unreadableWinds = [values.bestWinds, values.avoidWinds].filter(hasUnreadableWindText);
  const typeUnset = !values.standType || (mode === "edit" && values.standType === "Other");
  const savedOnMap = Boolean(
    savedLocation && savedLocation.lat === values.lat && savedLocation.lng === values.lng,
  );

  return (
    <form onSubmit={handleSubmit} style={formStyle} noValidate>
      <div style={basicsStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Stand name</span>
          <input
            placeholder="North Ridge Stand"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            style={inputStyle}
            autoComplete="off"
            enterKeyHint="done"
          />
        </label>

        <ChipSelect<StandType>
          label="Stand type"
          options={STAND_TYPES.map((type) => ({ value: type, label: type }))}
          value={values.standType || null}
          onChange={(type) => updateField("standType", type ?? "")}
          hint={
            typeUnset
              ? "Pick the type so the stand reads right everywhere. Left blank it saves as Other."
              : undefined
          }
        />

        <ChipSelect<StandBestTime>
          label="Best time"
          options={STAND_BEST_TIMES.map((time) => ({
            value: time,
            label: STAND_BEST_TIME_LABEL[time],
          }))}
          value={values.bestTime || null}
          onChange={(time) => updateField("bestTime", time ?? "")}
          hint="Morning or evening keeps it from being picked for the other sit."
        />

        <StandLocationField
          lat={values.lat}
          lng={values.lng}
          onChange={(point) => onChange({ ...values, ...point })}
          savedOnMap={savedOnMap}
          allowClear={!savedLocation}
        />
      </div>

      <CollapsibleSection title="Wind" defaultOpen={mode === "add"}>
        {unreadableWinds.length > 0 ? (
          <p style={warnStyle} role="note">
            Saved wind note{unreadableWinds.length > 1 ? "s" : ""}{" "}
            {unreadableWinds.map((text) => `“${text}”`).join(" and ")} include
            {unreadableWinds.length > 1 ? "" : "s"} words the compass can&apos;t
            show. They&apos;re kept unless you change that list&apos;s directions
            below, which rewrites it as directions only.
          </p>
        ) : null}
        <WindPicker
          marks={windMarksFromText(values.bestWinds, values.avoidWinds)}
          onChange={(marks) => onChange({ ...values, ...windTextForSave(values, marks) })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="More details" description="Setup, weapon, longest shot, height">
        <div style={stackStyle}>
          <ChipMultiSelect
            label="Setup"
            options={STAND_SETUPS}
            value={values.setup}
            onChange={(setup) => updateField("setup", setup)}
          />
          <ChipSelect<StandWeapon>
            label="Weapon"
            options={STAND_WEAPONS.map((weapon) => ({
              value: weapon,
              label: STAND_WEAPON_LABEL[weapon],
            }))}
            value={values.weapon || null}
            onChange={(weapon) => updateField("weapon", weapon ?? "")}
          />
          <ChipSelect<number>
            label="Longest shot"
            options={STAND_SHOT_YARDS.map((yards) => ({
              value: yards,
              label: shotYardsLabel(yards),
            }))}
            value={values.maxShotYards}
            onChange={(yards) => updateField("maxShotYards", yards)}
          />
          <label style={{ ...fieldStyle, maxWidth: "12rem" }}>
            <span style={labelStyle}>Height (ft)</span>
            <input
              inputMode="numeric"
              placeholder="20"
              value={values.heightFeet}
              onChange={(event) =>
                updateField("heightFeet", event.target.value.replace(/[^\d.]/g, ""))
              }
              style={inputStyle}
              autoComplete="off"
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Access & exit">
        <div style={stackStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Access route</span>
            <textarea
              placeholder="How to get in without bumping deer"
              value={values.accessRouteNotes}
              onChange={(event) => updateField("accessRouteNotes", event.target.value)}
              style={textareaStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Exit route</span>
            <textarea
              placeholder="Best way to leave after the sit"
              value={values.exitRouteNotes}
              onChange={(event) => updateField("exitRouteNotes", event.target.value)}
              style={textareaStyle}
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Notes">
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea
            placeholder="Food, bedding, trails, visibility, safety, or reminders"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            style={textareaStyle}
          />
        </label>
      </CollapsibleSection>

      {error ? (
        <p style={errorStyle} role="alert">
          {error}
        </p>
      ) : null}

      {mode === "edit" ? (
        <div style={actionsStyle}>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save stand</Button>
        </div>
      ) : (
        <Button type="submit">Add Stand</Button>
      )}
    </form>
  );
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const basicsStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const stackStyle: CSSProperties = {
  display: "grid",
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

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "90px",
  resize: "vertical",
};

const warnStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  padding: "0.55rem 0.7rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--warning-border)",
  background: "var(--warning-bg)",
  color: "var(--warning-text)",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

const errorStyle: CSSProperties = {
  margin: 0,
  padding: "0.55rem 0.7rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--danger-border)",
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const actionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.5rem",
};
