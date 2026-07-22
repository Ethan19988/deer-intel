import type { CSSProperties } from "react";
import Button from "@/components/ui/Button";
import type { MapPin } from "@/types/mapPin";

type StandPinConvertListProps = {
  standPins: MapPin[];
  getPropertyName: (propertyId: string) => string;
  onConvert: (pin: MapPin) => void;
  title?: string;
  description?: string;
};

const DEFAULT_TITLE = "Your map stands aren't stand sites yet";
const DEFAULT_DESCRIPTION =
  "Hunts are logged against stand sites, and these map pins haven't been saved as sites. Save one below and the hunt form opens with it selected — the pin stays on the map.";

/**
 * Shown on the Hunt Log when the map has stand-type pins that haven't been
 * promoted into stand sites. Lets the hunter promote a pin into a stand site in
 * one tap so the sit can be logged without re-entering the stand by hand. Used
 * both as a full-screen prompt (no stand sites yet) and inline in the hunt form
 * for a selected property's unconverted pins.
 */
export default function StandPinConvertList({
  standPins,
  getPropertyName,
  onConvert,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: StandPinConvertListProps) {
  return (
    <div style={wrapperStyle}>
      <p style={titleStyle}>{title}</p>
      <p style={descriptionStyle}>{description}</p>
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
