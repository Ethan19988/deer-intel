import type { CSSProperties, FormEvent } from "react";
import Button from "@/components/ui/Button";
import type { Property } from "@/types/property";

export type PropertyFormValues = Pick<
  Property,
  "name" | "county" | "acres" | "notes"
>;

type PropertyFormProps = {
  values: PropertyFormValues;
  submitLabel: string;
  onChange: (values: PropertyFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
};

export default function PropertyForm({
  values,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: PropertyFormProps) {
  function updateField(field: keyof PropertyFormValues, value: string) {
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
          <span style={labelStyle}>Property Name</span>
          <input
            placeholder="Finley Run"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>County / Region</span>
          <input
            placeholder="Northern PA"
            value={values.county}
            onChange={(event) => updateField("county", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Acres</span>
          <input
            placeholder="Unknown"
            value={values.acres}
            onChange={(event) => updateField("acres", event.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={fieldStyle}>
        <span style={labelStyle}>Notes</span>
        <textarea
          placeholder="Access, deer movement, cover, food, wind, and observations"
          value={values.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          style={{ ...inputStyle, minHeight: "110px", resize: "vertical" }}
        />
      </label>

      <div style={buttonRowStyle}>
        <Button type="submit">
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
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
  fontSize: "0.85rem",
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

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};
