import type { CSSProperties } from "react";
import type { Camera } from "@/types/camera";

type CameraCardProps = {
  camera: Camera;
  onEdit: (camera: Camera) => void;
};

export default function CameraCard({ camera, onEdit }: CameraCardProps) {
  const hasCoordinates =
    camera.latitude !== undefined && camera.longitude !== undefined;

  return (
    <article style={cardStyle}>
      <div style={cardHeaderStyle}>
        <div>
          <p style={eyebrowStyle}>{camera.cameraType} Camera</p>
          <h3 style={titleStyle}>{camera.name}</h3>
          <p style={subTextStyle}>
            {[camera.manufacturer, camera.model].filter(Boolean).join(" ") ||
              "Manufacturer and model not set"}
          </p>
        </div>

        <div style={headerActionsStyle}>
          <span
            style={
              camera.status === "Active"
                ? activeStatusStyle
                : inactiveStatusStyle
            }
          >
            {camera.status}
          </span>
          <button onClick={() => onEdit(camera)} style={secondaryButtonStyle}>
            Edit
          </button>
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
    </article>
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
  padding: "1rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
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
  color: "#85a984",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.15rem",
  lineHeight: 1.25,
};

const subTextStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "#879486",
  lineHeight: 1.4,
};

const statusStyle: CSSProperties = {
  flexShrink: 0,
  padding: "0.35rem 0.6rem",
  borderRadius: "8px",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const activeStatusStyle: CSSProperties = {
  ...statusStyle,
  border: "1px solid #3b6843",
  background: "#18351d",
  color: "#c6f0c6",
};

const inactiveStatusStyle: CSSProperties = {
  ...statusStyle,
  border: "1px solid #514c31",
  background: "#272411",
  color: "#eee1a8",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "0.35rem 0.6rem",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#1b1b1b",
  color: "white",
  fontSize: "0.78rem",
  fontWeight: "bold",
  cursor: "pointer",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid #1e2a1e",
};

const notesBlockStyle: CSSProperties = {
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
  color: "#c7d0c5",
  lineHeight: 1.5,
};
