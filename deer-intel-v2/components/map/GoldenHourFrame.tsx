import type { CSSProperties } from "react";
import type { MovementPeriod } from "@/lib/movementPrediction";

// A photographic "frame" laid over the map imagery: a soft corner vignette plus
// a top-edge glow tinted to the property's real time of day (driven by the same
// sunrise/sunset-derived movement period the rest of the map uses). It carries
// the app's signature golden-hour warmth onto the otherwise bare tile canvas —
// cool blue at dawn, neutral at midday, amber at dusk, deep blue after dark.
//
// The layer is purely decorative: it never receives pointer events and sits
// beneath every map control, so the imagery reads a touch warmer without any
// loss of legibility or interactivity.

const VIGNETTE =
  "radial-gradient(135% 115% at 50% 42%, transparent 58%, rgba(6, 10, 16, 0.3) 100%)";

// Each period stacks its own glow/wash layers on top of a shared vignette.
const FRAME_BY_PERIOD: Record<MovementPeriod, string> = {
  dawn: [
    "linear-gradient(180deg, rgba(126, 158, 205, 0.2) 0%, rgba(126, 158, 205, 0.06) 16%, transparent 34%)",
    "linear-gradient(0deg, rgba(255, 176, 112, 0.1) 0%, transparent 22%)",
    "linear-gradient(rgba(70, 96, 140, 0.05), rgba(70, 96, 140, 0.05))",
    VIGNETTE,
  ].join(", "),
  midday: [
    "linear-gradient(180deg, rgba(255, 224, 168, 0.08) 0%, transparent 22%)",
    "radial-gradient(140% 120% at 50% 40%, transparent 62%, rgba(10, 14, 12, 0.2) 100%)",
  ].join(", "),
  dusk: [
    "linear-gradient(180deg, rgba(255, 150, 66, 0.26) 0%, rgba(255, 132, 60, 0.1) 18%, transparent 40%)",
    "linear-gradient(0deg, rgba(255, 120, 50, 0.1) 0%, transparent 26%)",
    "linear-gradient(rgba(255, 150, 80, 0.05), rgba(255, 150, 80, 0.05))",
    VIGNETTE,
  ].join(", "),
  night: [
    "linear-gradient(180deg, rgba(40, 62, 112, 0.34) 0%, rgba(40, 62, 112, 0.1) 24%, transparent 46%)",
    "linear-gradient(rgba(18, 28, 56, 0.2), rgba(18, 28, 56, 0.2))",
    "radial-gradient(130% 112% at 50% 44%, transparent 50%, rgba(2, 6, 14, 0.44) 100%)",
  ].join(", "),
};

export default function GoldenHourFrame({
  period,
}: {
  period: MovementPeriod;
}) {
  return (
    <div
      className="di-golden-frame"
      aria-hidden="true"
      style={{ ...frameStyle, background: FRAME_BY_PERIOD[period] }}
    />
  );
}

const frameStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 450,
  pointerEvents: "none",
  // Gradient swaps between periods aren't animatable, so fade the whole layer in.
  transition: "opacity 900ms ease",
};
