import type { CSSProperties } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { Camera } from "@/types/camera";

type CameraCardProps = {
  camera: Camera;
  onEdit: (camera: Camera) => void;
};

export default function CameraCard({ camera, onEdit }: CameraCardProps) {
  const hasCoordinates =
    camera.latitude !== undefined && camera.longitude !== undefined;

  return (
    <Card style={cardStyle}>
      <div style={cardHeaderStyle}>
        <div>
          <p style={eyebrowStyle}>{camera.cameraType} Camera Site</p>
          <h3 style={titleStyle}>{camera.name}</h3>
          <p style={subTextStyle}>
            {[camera.manufacturer, camera.model].filter(Boolean).join(" ") ||
              "Manufacturer and model not set"}
          </p>
        </div>

        <div style={headerActionsStyle}>
          <Badge variant={camera.status === "Active" ? "success" : "warning"}>
            {camera.status}
          </Badge>
          <Link
            href={`/properties/${camera.propertyId}/assets/${camera.id}`}
            style={openSiteLinkStyle}
          >
            Open Site
          </Link>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onEdit(camera)}
            style={secondaryButtonStyle}
          >
            Edit
          </Button>
        </div>
      </div>

      <div style={detailsGridStyle}>
        <CameraDetail label="Last Checked" value={camera.lastChecked} />
        <CameraDetail label="Battery" value={formatPercent(camera.batteryPercent)} />
        <CameraDetail label="SD Card" value={formatPercent(camera.sdCardPercent)} />
        <CameraDetail
          label="GPS"
          value={
            hasCoordinates
              ? `${camera.latitude}, ${camera.longitude}`
              : "Not set"
          }
        />
      </div>

      {camera.cameraType === "Cellular" ? (
        <div style={detailsGridStyle}>
          <CameraDetail
            label="Signal"
            value={formatPercent(camera.signalStrength)}
          />
          <CameraDetail label="Carrier" value={camera.carrier} />
          <CameraDetail
            label="Last Transmission"
            value={camera.lastTransmission}
          />
        </div>
      ) : null}

      <div style={notesBlockStyle}>
        <p style={detailLabelStyle}>Location Notes</p>
        <p style={detailValueStyle}>
          {camera.locationNotes || "No location notes yet."}
        </p>
      </div>

      <div style={notesBlockStyle}>
        <p style={detailLabelStyle}>Notes</p>
        <p style={detailValueStyle}>{camera.notes || "No notes yet."}</p>
      </div>
    </Card>
  );
}

function CameraDetail({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value || "Not set"}</p>
    </div>
  );
}

function formatPercent(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) return "";
  if (trimmedValue.endsWith("%")) return trimmedValue;
  if (!Number.isNaN(Number(trimmedValue))) return `${trimmedValue}%`;

  return trimmedValue;
}

const cardStyle: CSSProperties = {
  background: "var(--surface-2)",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.25rem",
  lineHeight: 1.25,
};

const subTextStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "var(--text-faint)",
  lineHeight: 1.4,
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: "36px",
  padding: "0.5rem 0.65rem",
  fontSize: "0.85rem",
};

const openSiteLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "36px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.5rem 0.65rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontSize: "0.85rem",
  fontWeight: 700,
  textDecoration: "none",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const notesBlockStyle: CSSProperties = {
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};
