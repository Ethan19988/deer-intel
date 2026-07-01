import type { CSSProperties, FormEvent } from "react";
import Button from "@/components/ui/Button";
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
      <div style={formGridStyle}>
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

      <div style={formGridStyle}>
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

      <label style={fieldStyle}>
        <span style={labelStyle}>Exit Route Notes</span>
        <textarea
          placeholder="Best way to leave after the sit"
          value={values.exitRouteNotes}
          onChange={(event) => updateField("exitRouteNotes", event.target.value)}
          style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
        />
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>Notes</span>
        <textarea
          placeholder="Food, bedding, trails, visibility, safety, or reminders"
          value={values.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
        />
      </label>

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
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
