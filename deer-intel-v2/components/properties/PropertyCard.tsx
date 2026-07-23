import type { CSSProperties } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { MapPinIcon } from "@/components/ui/FieldIcons";
import { formatPropertyCoordinate } from "@/lib/propertyLocation";
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
            <div style={leadStyle}>
              <span style={iconBadgeStyle} aria-hidden="true">
                <MapPinIcon size={20} />
              </span>
              <div>
                <p style={cardEyebrowStyle}>Editing</p>
                <h3 style={cardTitleStyle}>{property.name}</h3>
              </div>
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
            <div style={leadStyle}>
              <span style={iconBadgeStyle} aria-hidden="true">
                <MapPinIcon size={20} />
              </span>
              <div>
                <p style={cardEyebrowStyle}>Property</p>
                <h3 style={cardTitleStyle}>{property.name}</h3>
              </div>
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
            <div style={detailTileStyle}>
              <p style={detailLabelStyle}>County / Region</p>
              <p style={detailValueStyle}>{property.county || "Not set"}</p>
            </div>

            <div style={detailTileStyle}>
              <p style={detailLabelStyle}>Acres</p>
              <p style={detailValueStyle}>{property.acres || "Not set"}</p>
            </div>

            <div style={detailTileStyle}>
              <p style={detailLabelStyle}>Center (GPS)</p>
              <p style={detailValueStyle}>
                {formatPropertyCoordinate(property) || "Not set"}
              </p>
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

const leadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.7rem",
  minWidth: 0,
};

const iconBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.5rem",
  height: "2.5rem",
  flex: "none",
  borderRadius: "12px",
  background: "var(--accent-tint)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
};

const cardEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
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
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "0.95rem",
  fontWeight: "bold",
  cursor: "pointer",
  textDecoration: "none",
};

const openPropertyButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
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
  borderTop: "1px solid var(--border)",
};

const detailTileStyle: CSSProperties = {
  padding: "0.6rem 0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface)",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.7rem",
  fontWeight: 800,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text)",
  lineHeight: 1.4,
  fontWeight: 700,
};

const notesStyle: CSSProperties = {
  margin: "1rem 0 0",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
  color: "var(--text-muted)",
  lineHeight: 1.6,
};
