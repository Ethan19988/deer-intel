import type { CSSProperties } from "react";
import type { ParcelOwnerLookupResult } from "@/types/parcel";

type ParcelOwnerInfoCardProps = {
  parcel: ParcelOwnerLookupResult;
  onClose: () => void;
};

export default function ParcelOwnerInfoCard({
  parcel,
  onClose,
}: ParcelOwnerInfoCardProps) {
  return (
    <aside
      style={cardStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div style={headerStyle}>
        <span style={iconStyle}>ON</span>
        <div style={titleWrapStyle}>
          <p style={eyebrowStyle}>Parcel Owner</p>
          <h3 style={titleStyle}>{parcel.ownerName}</h3>
        </div>
        <button
          type="button"
          aria-label="Close parcel owner card"
          style={closeButtonStyle}
          onClick={onClose}
        >
          x
        </button>
      </div>

      <div style={detailsStyle}>
        <InfoLine label="County" value={`${parcel.countyName} County`} />
        <InfoLine label="Parcel ID" value={parcel.parcelId ?? "Not listed"} />
        <InfoLine label="Address" value={parcel.address ?? "Not listed"} />
        <InfoLine label="Acres" value={parcel.acreage ?? "Not listed"} />
        <InfoLine label="Source" value={parcel.providerName} />
      </div>
    </aside>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={infoLabelStyle}>{label}</p>
      <p style={infoValueStyle}>{value}</p>
    </div>
  );
}

const cardStyle: CSSProperties = {
  position: "absolute",
  right: "1rem",
  bottom: "7.4rem",
  zIndex: 1100,
  display: "grid",
  gap: "0.85rem",
  width: "min(380px, calc(100% - 2rem))",
  padding: "0.9rem",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  borderRadius: "8px",
  background: "rgba(17, 23, 17, 0.94)",
  color: "#f1f5ef",
  boxShadow: "0 18px 42px rgba(0, 0, 0, 0.35)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.7rem",
};

const iconStyle: CSSProperties = {
  display: "inline-flex",
  width: "40px",
  height: "40px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid #a7d3ff",
  borderRadius: "999px",
  background: "#1b2328",
  color: "#a7d3ff",
  fontSize: "0.74rem",
  fontWeight: 900,
};

const titleWrapStyle: CSSProperties = {
  minWidth: 0,
  flex: "1 1 auto",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#a7b5a5",
  fontSize: "0.75rem",
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.15rem 0 0",
  overflow: "hidden",
  color: "white",
  fontSize: "1.18rem",
  lineHeight: 1.2,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const closeButtonStyle: CSSProperties = {
  display: "inline-flex",
  width: "34px",
  minHeight: "34px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.08)",
  color: "#f1f5ef",
  cursor: "pointer",
  fontSize: "1rem",
  fontWeight: 900,
  lineHeight: 1,
};

const detailsStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
};

const infoLabelStyle: CSSProperties = {
  margin: 0,
  color: "#8fa18c",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const infoValueStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  color: "#d8e2d6",
  fontSize: "0.94rem",
  lineHeight: 1.45,
};
