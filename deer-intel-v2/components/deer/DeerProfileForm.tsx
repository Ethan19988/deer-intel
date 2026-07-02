import type { CSSProperties, FormEvent } from "react";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import type { DeerProfileFormValues } from "@/lib/deerProfileFormValues";

type DeerProfileFormProps = {
  values: DeerProfileFormValues;
  onChange: (values: DeerProfileFormValues) => void;
  onSubmit: () => void;
};

export default function DeerProfileForm({
  values,
  onChange,
  onSubmit,
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

      <CollapsibleSection title="Sightings">
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

      <CollapsibleSection title="Notes">
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

      <Button type="submit" disabled={!values.nickname.trim()}>
        Add Deer Profile
      </Button>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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
