import type { CSSProperties } from "react";
import Link from "next/link";
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
  /** At-a-glance counts shown on the card; omitted while editing. */
  stats?: PropertyCardStats;
};

export type PropertyCardStats = {
  cameras: number;
  stands: number;
  sits: number;
  buckPhotos: number;
  /** e.g. "Oct 12", or null when nothing is logged. */
  lastSitLabel: string | null;
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
  stats,
}: PropertyCardProps) {
  return (
    <Card
      as="div"
      id={`property-${property.id}`}
      className={isEditing ? undefined : "di-card-lift"}
      style={cardStyle}
    >
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
          <Link href={`/properties/${property.id}`} style={summaryLinkStyle}>
            <h3 style={nameStyle}>{property.name}</h3>
            <p style={regionStyle}>
              {[property.county, property.acres ? `${property.acres} acres` : ""]
                .filter(Boolean)
                .join(", ") || "Region not set"}
            </p>

            {stats ? (
              <dl style={statsGridStyle}>
                <Stat label="Cameras" value={stats.cameras} />
                <Stat label="Stands" value={stats.stands} />
                <Stat label="Sits" value={stats.sits} />
                <Stat label="Bucks" value={stats.buckPhotos} accent />
              </dl>
            ) : null}

            <p style={lastSitStyle}>
              {stats?.lastSitLabel ? `Last sit ${stats.lastSitLabel}` : "No sits logged yet"}
            </p>
          </Link>

          {property.notes ? <p style={notesStyle}>{property.notes}</p> : null}

          {!formatPropertyCoordinate(property) ? (
            <p style={hintStyle}>
              Set a center point (Edit) so weather and wind use one spot instead
              of an average of your pins.
            </p>
          ) : null}

          <Link
            href={`/properties/${property.id}`}
            className="di-navbtn"
            style={openPropertyButtonStyle}
          >
            Open property
          </Link>

          <div style={quietRowStyle}>
            <button
              type="button"
              onClick={() => onStartEditing(property)}
              style={quietButtonStyle}
            >
              Edit details
            </button>
            <button
              type="button"
              onClick={() => onDelete(property.id)}
              style={{ ...quietButtonStyle, ...dangerTextStyle }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div style={statStyle}>
      <dt style={statLabelStyle}>{label}</dt>
      <dd style={{ ...statValueStyle, ...(accent && value > 0 ? statAccentStyle : null) }}>
        {value}
      </dd>
    </div>
  );
}

const summaryLinkStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  color: "inherit",
  textDecoration: "none",
};

const nameStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.6rem",
  fontWeight: 800,
  lineHeight: 1.1,
};

const regionStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontWeight: 600,
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "0.4rem",
  margin: "0.6rem 0 0",
};

const statStyle: CSSProperties = {
  display: "grid",
  gap: "0.1rem",
  padding: "0.55rem 0.5rem",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  textAlign: "center",
};

const statLabelStyle: CSSProperties = {
  order: 2,
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  fontWeight: 700,
};

const statValueStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.35rem",
  fontWeight: 800,
};

const statAccentStyle: CSSProperties = {
  color: "var(--accent-2)",
};

const lastSitStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.88rem",
};

const hintStyle: CSSProperties = {
  margin: "0.75rem 0 0",
  padding: "0.6rem 0.75rem",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-2-tint)",
  border: "1px solid var(--accent-2-tint-border)",
  color: "var(--text)",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

const quietRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
  marginTop: "0.25rem",
};

const quietButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 0.25rem",
  border: "none",
  background: "transparent",
  color: "var(--text-muted)",
  fontSize: "0.92rem",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerTextStyle: CSSProperties = {
  color: "var(--danger-text, #b3261e)",
};

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
  width: "100%",
  marginTop: "0.9rem",
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#fff",
};






const notesStyle: CSSProperties = {
  margin: "0.75rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.6,
};
