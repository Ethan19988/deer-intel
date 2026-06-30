import type { CSSProperties } from "react";
import Link from "next/link";
import type { Property } from "@/types/property";
import PropertyForm, { type PropertyFormValues } from "./PropertyForm";

type PropertyCardProps = {
  property: Property;
  isEditing: boolean;
  editValues: PropertyFormValues;
  onEditValuesChange: (values: PropertyFormValues) => void;
  onStartEditing: (property: Property) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (propertyId: string) => void;
};

export default function PropertyCard({
  property,
  isEditing,
  editValues,
  onEditValuesChange,
  onStartEditing,
  onSave,
  onCancel,
  onDelete,
}: PropertyCardProps) {
  return (
    <div style={cardStyle}>
      {isEditing ? (
        <>
          <div style={cardHeaderStyle}>
            <div>
              <p style={cardEyebrowStyle}>Editing</p>
              <h3 style={cardTitleStyle}>{property.name}</h3>
            </div>
          </div>

          <PropertyForm
            values={editValues}
            submitLabel="Save Changes"
            onChange={onEditValuesChange}
            onSubmit={onSave}
            onCancel={onCancel}
          />
        </>
      ) : (
        <>
          <div style={cardHeaderStyle}>
            <div>
              <p style={cardEyebrowStyle}>Property</p>
              <h3 style={cardTitleStyle}>{property.name}</h3>
            </div>

            <div style={buttonRowStyle}>
              <Link
                href={`/properties/${property.id}`}
                style={openPropertyButtonStyle}
              >
                Open Property
              </Link>
              <button
                onClick={() => onStartEditing(property)}
                style={secondaryButtonStyle}
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(property.id)}
                style={dangerButtonStyle}
              >
                Delete
              </button>
            </div>
          </div>

          <div style={detailsGridStyle}>
            <div>
              <p style={detailLabelStyle}>County / Region</p>
              <p style={detailValueStyle}>{property.county}</p>
            </div>

            <div>
              <p style={detailLabelStyle}>Acres</p>
              <p style={detailValueStyle}>{property.acres}</p>
            </div>
          </div>

          <p style={notesStyle}>{property.notes}</p>
        </>
      )}
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid #243224",
  borderRadius: "8px",
  padding: "1.15rem",
  background: "#0d120d",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const cardEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const cardTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.25rem",
  lineHeight: 1.25,
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "0.55rem 0.85rem",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#1b1b1b",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  textDecoration: "none",
};

const openPropertyButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  border: "1px solid #3b6843",
  background: "#18351d",
};

const dangerButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  border: "1px solid #7f2f2f",
  color: "#ffb4b4",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid #1e2a1e",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "#879486",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#f1f5ef",
  lineHeight: 1.4,
};

const notesStyle: CSSProperties = {
  margin: "1rem 0 0",
  paddingTop: "1rem",
  borderTop: "1px solid #1e2a1e",
  color: "#c7d0c5",
  lineHeight: 1.6,
};
