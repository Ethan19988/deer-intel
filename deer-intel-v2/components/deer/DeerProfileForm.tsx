import type { CSSProperties, FormEvent } from "react";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import type { DeerProfileFormValues } from "@/lib/deerProfileFormValues";

type DeerProfileFormProps = {
  values: DeerProfileFormValues;
  onChange: (values: DeerProfileFormValues) => void;
  onSubmit: () => void;
  /** Save button text; "Add Deer Profile" by default, e.g. "Save changes" when editing. */
  submitLabel?: string;
  /** When given (editing), shows a Cancel button beside Save. */
  onCancel?: () => void;
  /** Open every section, e.g. when editing so saved notes are visible. */
  expanded?: boolean;
};

export default function DeerProfileForm({
  values,
  onChange,
  onSubmit,
  submitLabel = "Add Deer Profile",
  onCancel,
  expanded = false,
}: DeerProfileFormProps) {
  function updateField<Field extends keyof DeerProfileFormValues>(
    field: Field,
    value: DeerProfileFormValues[Field],
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
            <span style={labelStyle}>Nickname</span>
            <input
              placeholder="Tall 8, Split Brow, Wide Ten"
              value={values.nickname}
              onChange={(event) => updateField("nickname", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Estimated Age</span>
            <input
              placeholder="3.5, mature, unknown"
              value={values.estimatedAge}
              onChange={(event) =>
                updateField("estimatedAge", event.target.value)
              }
              style={inputStyle}
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Sightings" defaultOpen={expanded}>
        <div className="di-form-grid" style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>First Seen</span>
            <input
              type="date"
              value={values.firstSeen}
              onChange={(event) => updateField("firstSeen", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Last Seen</span>
            <input
              type="date"
              value={values.lastSeen}
              onChange={(event) => updateField("lastSeen", event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Notes" defaultOpen={expanded}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea
            placeholder="Antler traits, travel pattern, camera sites, behavior, or history"
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
        <Button type="submit" disabled={!values.nickname.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
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
