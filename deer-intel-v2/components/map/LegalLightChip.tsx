import type { CSSProperties } from "react";
import type { LegalLightChip as LegalLightChipData } from "@/lib/legalLight";

// "Legal light in 9h 40m" / "Legal end in 32m" / "Legal now · ends 5:32 PM",
// beside the movement-timeline toggle. Read-only, dark and square like the
// other controls on the imagery.
export default function LegalLightChip({ chip }: { chip: LegalLightChipData }) {
  return (
    <span
      className="di-map-legal-chip"
      role="status"
      style={{ ...chipStyle, ...TONE[chip.tone] }}
    >
      <span aria-hidden="true" style={{ ...dotStyle, background: DOT[chip.tone] }} />
      {chip.label}
    </span>
  );
}

const DOT: Record<LegalLightChipData["tone"], string> = {
  dark: "#6b7068",
  legal: "#7d9a4a",
  ending: "#ff6a1a",
};

const TONE: Record<LegalLightChipData["tone"], CSSProperties> = {
  dark: {},
  legal: {},
  ending: { borderColor: "#ff6a1a", color: "#ffb27f" },
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  minHeight: "32px",
  padding: "0 0.65rem",
  border: "1px solid #3a4134",
  borderRadius: "var(--radius-sm)",
  background: "rgba(11, 13, 11, 0.92)",
  color: "#e8e6df",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.68rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const dotStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "999px",
};
