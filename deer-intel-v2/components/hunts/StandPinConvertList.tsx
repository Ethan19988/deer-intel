import type { CSSProperties } from "react";
import Button from "@/components/ui/Button";
import type { MapPin } from "@/types/mapPin";

type StandPinConvertListProps = {
  standPins: MapPin[];
  getPropertyName: (propertyId: string) => string;
  onConvert: (pin: MapPin) => void;
};

/**
 * Shown on the Hunt Log when there are no stand sites yet but the map has
 * stand-type pins. Lets the hunter promote a pin into a stand site in one tap
 * so the sit can be logged without re-entering the stand by hand.
 */
export default function StandPinConvertList({
  standPins,
  getPropertyName,
  onConvert,
}: StandPinConvertListProps) {
  return (
    <div style={wrapperStyle}>
      <p style={titleStyle}>Your map stands aren&apos;t stand sites yet</p>
      <p style={descriptionStyle}>
        Hunts are logged against stand sites, and these map pins haven&apos;t
        been saved as sites. Save one below and the hunt form opens with it
        selected — the pin stays on the map.
      </p>
      <ul style={listStyle}>
        {standPins.map((pin) => (
          <li key={pin.id} style={rowStyle}>
            <div style={rowTextStyle}>
              <span style={pinNameStyle}>
                {pin.name.trim() || pin.notes.trim() || pin.type}
              </span>
              <span style={pinMetaStyle}>
                {getPropertyName(pin.propertyId)} · {pin.lat.toFixed(4)},{" "}
                {pin.lng.toFixed(4)}
              </span>
            </div>
            <Button type="button" onClick={() => onConvert(pin)}>
              Save as stand site
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const wrapperStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 850,
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: "0.6rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
  padding: "0.75rem 0.9rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
};

const rowTextStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
};

const pinNameStyle: CSSProperties = {
  fontWeight: 700,
};

const pinMetaStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
};
