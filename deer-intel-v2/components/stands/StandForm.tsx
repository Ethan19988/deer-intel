import type { CSSProperties, FormEvent } from "react";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import type { StandFormValues } from "@/lib/standFormValues";
import { STAND_TYPES, type StandType } from "@/types/stand";

type StandFormProps = {
  values: StandFormValues;
  onChange: (values: StandFormValues) => void;
  onSubmit: () => void;
};

export default function StandForm({
  values,
  onChange,
  onSubmit,
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

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <CollapsibleSection title="Basic Info" defaultOpen>
        <div className="di-form-grid" style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Stand Name</span>
            <input
              placeholder="North Ridge Stand"
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Stand Type</span>
            <select
              value={values.standType}
              onChange={(event) =>
                updateField("standType", event.target.value as StandType)
              }
              style={inputStyle}
            >
              {STAND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Wind">
        <div className="di-form-grid" style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Best Winds</span>
            <input
              placeholder="NW, W, N"
              value={values.bestWinds}
              onChange={(event) => updateField("bestWinds", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Avoid Winds</span>
            <input
              placeholder="S, SE"
              value={values.avoidWinds}
              onChange={(event) => updateField("avoidWinds", event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Access">
        <label style={fieldStyle}>
          <span style={labelStyle}>Access Route Notes</span>
          <textarea
            placeholder="How to get in without bumping deer"
            value={values.accessRouteNotes}
            onChange={(event) =>
              updateField("accessRouteNotes", event.target.value)
            }
            style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
          />
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Exit">
        <label style={fieldStyle}>
          <span style={labelStyle}>Exit Route Notes</span>
          <textarea
            placeholder="Best way to leave after the sit"
            value={values.exitRouteNotes}
            onChange={(event) =>
              updateField("exitRouteNotes", event.target.value)
            }
            style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
          />
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Notes">
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea
            placeholder="Food, bedding, trails, visibility, safety, or reminders"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
          />
        </label>
      </CollapsibleSection>

      <Button type="submit">Add Stand</Button>
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
