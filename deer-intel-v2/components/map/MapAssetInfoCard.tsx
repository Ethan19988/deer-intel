import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { formatCoordinate } from "@/lib/propertyMap";
import type { MapAsset, MapAssetRoute } from "@/lib/propertyMap";
import { PROPERTY_ASSET_PIN_TYPES, type MapPin, type PinType } from "@/types/mapPin";

type MapAssetInfoCardProps = {
  asset: MapAsset;
  detailRoute: MapAssetRoute;
  editRoute: MapAssetRoute;
  /** The backing pin when the asset is a map pin — enables inline editing. */
  pin?: MapPin;
  propertyName: string;
  onCenter: () => void;
  onClose: () => void;
  onDelete: () => void;
  onSavePin?: (updates: { type: PinType; notes: string }) => void;
};

export default function MapAssetInfoCard({
  asset,
  detailRoute,
  editRoute,
  pin,
  propertyName,
  onCenter,
  onClose,
  onDelete,
  onSavePin,
}: MapAssetInfoCardProps) {
  const [actionMessage, setActionMessage] = useState("");
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [draftType, setDraftType] = useState<PinType>(pin?.type ?? "Stand");
  const [draftNotes, setDraftNotes] = useState(pin?.notes ?? "");

  const canEditPin = Boolean(pin && onSavePin);

  function showUnavailableMessage(message: string | undefined) {
    setActionMessage(message ?? "This action is not available yet");
  }

  function startPinEdit() {
    if (!pin) return;

    setDraftType(pin.type);
    setDraftNotes(pin.notes);
    setActionMessage("");
    setIsEditingPin(true);
  }

  function savePinEdit() {
    onSavePin?.({ type: draftType, notes: draftNotes.trim() });
    setIsEditingPin(false);
    setActionMessage("Pin updated.");
  }

  return (
    <aside
      className="di-map-card"
      style={cardStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div style={headerStyle}>
        <span
          style={{
            ...assetIconStyle,
            background: asset.background,
            borderColor: asset.color,
            color: asset.color,
          }}
        >
          {asset.shortLabel}
        </span>
        <div style={titleWrapStyle}>
          <p style={eyebrowStyle}>{asset.typeLabel}</p>
          <h3 style={titleStyle}>{asset.label}</h3>
        </div>
        <button
          type="button"
          aria-label="Close asset card"
          className="di-map-close-button"
          style={closeButtonStyle}
          onClick={onClose}
        >
          x
        </button>
      </div>

      {isEditingPin && pin ? (
        <div style={detailsStyle}>
          <label style={editFieldStyle}>
            <span style={infoLabelStyle}>Pin Type</span>
            <select
              aria-label="Pin type"
              value={draftType}
              style={editInputStyle}
              onChange={(event) => setDraftType(event.target.value as PinType)}
            >
              {getPinTypeOptions(pin.type).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label style={editFieldStyle}>
            <span style={infoLabelStyle}>Notes</span>
            <textarea
              aria-label="Pin notes"
              value={draftNotes}
              rows={3}
              placeholder="What did you find here?"
              style={{ ...editInputStyle, resize: "vertical" }}
              onChange={(event) => setDraftNotes(event.target.value)}
            />
          </label>
          <div className="di-map-card-actions" style={actionsStyle}>
            <button type="button" style={primaryActionButtonStyle} onClick={savePinEdit}>
              Save
            </button>
            <button
              type="button"
              style={secondaryActionStyle}
              onClick={() => setIsEditingPin(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={detailsStyle}>
            <InfoLine label="Property" value={propertyName} />
            <InfoLine label="Notes" value={asset.description || "No notes yet."} />
            <InfoLine
              label="GPS"
              value={`${formatCoordinate(asset.lat)}, ${formatCoordinate(asset.lng)}`}
            />
            {pin ? (
              <InfoLine label="Placed" value={formatPlacedDate(pin.createdAt)} />
            ) : null}
          </div>

          <div className="di-map-card-actions" style={actionsStyle}>
            {detailRoute.href ? (
              <Link href={detailRoute.href} style={primaryActionStyle}>
                View Details
              </Link>
            ) : canEditPin ? null : (
              <button
                type="button"
                style={placeholderActionStyle}
                onClick={() =>
                  showUnavailableMessage(detailRoute.unavailableMessage)
                }
              >
                View Details
              </button>
            )}

            {canEditPin ? (
              <button
                type="button"
                style={primaryActionButtonStyle}
                onClick={startPinEdit}
              >
                Edit
              </button>
            ) : editRoute.href ? (
              <Link href={editRoute.href} style={secondaryActionStyle}>
                Edit
              </Link>
            ) : (
              <button
                type="button"
                style={placeholderActionStyle}
                onClick={() => showUnavailableMessage(editRoute.unavailableMessage)}
              >
                Edit
              </button>
            )}

            <button type="button" style={secondaryActionStyle} onClick={onCenter}>
              Center on Map
            </button>
            <button type="button" style={dangerActionStyle} onClick={onDelete}>
              Delete
            </button>
          </div>
        </>
      )}

      {actionMessage ? <p style={actionMessageStyle}>{actionMessage}</p> : null}
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

// The Pin Box only places the property-asset types, but older pins (and
// search-saved ones) can carry other types — keep the pin's current type
// selectable so editing never silently changes it.
function getPinTypeOptions(currentType: PinType): PinType[] {
  const options: PinType[] = [...PROPERTY_ASSET_PIN_TYPES];

  if (!options.includes(currentType)) options.unshift(currentType);

  return options;
}

function formatPlacedDate(createdAt: string) {
  const timestamp = Date.parse(createdAt);

  if (Number.isNaN(timestamp)) return "Unknown";

  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

const assetIconStyle: CSSProperties = {
  display: "inline-flex",
  width: "40px",
  height: "40px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid",
  borderRadius: "999px",
  fontSize: "0.76rem",
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

const editFieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const editInputStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "0.6rem 0.7rem",
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.08)",
  color: "#f1f5ef",
  fontSize: "0.94rem",
};

const actionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.55rem",
};

const baseActionStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.65rem 0.75rem",
  borderRadius: "8px",
  color: "white",
  fontSize: "0.9rem",
  fontWeight: 850,
  lineHeight: 1,
  textAlign: "center",
  textDecoration: "none",
};

const primaryActionStyle: CSSProperties = {
  ...baseActionStyle,
  border: "1px solid #3b6843",
  background: "#18351d",
};

const primaryActionButtonStyle: CSSProperties = {
  ...primaryActionStyle,
  cursor: "pointer",
};

const secondaryActionStyle: CSSProperties = {
  ...baseActionStyle,
  border: "1px solid rgba(255, 255, 255, 0.22)",
  background: "rgba(255, 255, 255, 0.1)",
  cursor: "pointer",
};

const dangerActionStyle: CSSProperties = {
  ...baseActionStyle,
  border: "1px solid #7f3131",
  background: "#451818",
  color: "#ffd5d5",
  cursor: "pointer",
};

const placeholderActionStyle: CSSProperties = {
  ...baseActionStyle,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(255, 255, 255, 0.05)",
  color: "#c9d3c7",
  cursor: "pointer",
};

const actionMessageStyle: CSSProperties = {
  margin: 0,
  padding: "0.55rem 0.65rem",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.06)",
  color: "#d8e2d6",
  fontSize: "0.85rem",
  fontWeight: 700,
  lineHeight: 1.35,
};
