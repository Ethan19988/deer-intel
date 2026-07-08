import type { CSSProperties } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
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
    <Card as="div" style={cardStyle}>
      {isEditing ? (
        <>
          <div className="di-property-card-header" style={cardHeaderStyle}>
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
          <div className="di-property-card-header" style={cardHeaderStyle}>
            <div>
              <p style={cardEyebrowStyle}>Property</p>
              <h3 style={cardTitleStyle}>{property.name}</h3>
            </div>

            <div className="di-property-actions" style={buttonRowStyle}>
              <Link
                href={`/properties/${property.id}`}
                className="di-property-open"
                style={openPropertyButtonStyle}
              >
                Open Property
              </Link>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onStartEditing(property)}
                style={smallButtonStyle}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => onDelete(property.id)}
                style={smallButtonStyle}
              >
                Delete
              </Button>
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
    </Card>
  );
}

const cardStyle: CSSProperties = {
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
  fontSize: "1.35rem",
  lineHeight: 1.25,
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.7rem 0.9rem",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#1b1b1b",
  color: "white",
  fontSize: "0.95rem",
  fontWeight: "bold",
  cursor: "pointer",
  textDecoration: "none",
};

const openPropertyButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  border: "1px solid #3b6843",
  background: "#18351d",
};

const smallButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.7rem 0.9rem",
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
