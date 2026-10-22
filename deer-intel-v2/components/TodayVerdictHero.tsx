"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getDisplayPhotoUrl } from "@/lib/photoCrop";
import type { TodayVerdict, VerdictChip } from "@/lib/todayVerdict";

export type HeroPhoto = {
  imageId: string;
  /** Short caption, e.g. "Big 8 on Inside Laurel". */
  caption: string;
  dateLabel: string;
};

type TodayVerdictHeroProps = {
  verdict: TodayVerdict;
  propertyName: string;
  photo: HeroPhoto | null;
  /** Rendered photo URL, for previews/tests; normally loaded from the store. */
  photoUrlOverride?: string | null;
};

/** Display URL for a stored photo (just the picture if it's an app screenshot). */
function useStoredPhotoUrl(imageId: string | undefined): string | null {
  const [state, setState] = useState<{ id: string; url: string | null }>({
    id: "",
    url: null,
  });

  useEffect(() => {
    if (!imageId) return;
    let active = true;

    // Same cropped, cached URL the rest of the app uses; not revoked here.
    getDisplayPhotoUrl(imageId).then((url) => {
      if (active) setState({ id: imageId, url });
    });

    return () => {
      active = false;
    };
  }, [imageId]);

  return imageId && state.id === imageId ? state.url : null;
}

const CHIP_TONE: Record<VerdictChip["tone"], CSSProperties> = {
  good: {
    background: "rgba(120, 196, 132, 0.22)",
    borderColor: "rgba(150, 215, 160, 0.55)",
    color: "#dff3e2",
  },
  warn: {
    background: "rgba(240, 176, 80, 0.22)",
    borderColor: "rgba(245, 192, 110, 0.6)",
    color: "#fbe7c4",
  },
  info: {
    background: "rgba(243, 237, 217, 0.14)",
    borderColor: "rgba(243, 237, 217, 0.4)",
    color: "#f3edd9",
  },
};

// The Today hero: the one call for the next sit, set over the newest buck on
// your own cameras. Everything else on the page supports this answer.
export default function TodayVerdictHero({
  verdict,
  propertyName,
  photo,
  photoUrlOverride,
}: TodayVerdictHeroProps) {
  const storedUrl = useStoredPhotoUrl(
    photoUrlOverride === undefined ? photo?.imageId : undefined,
  );
  const photoUrl = photoUrlOverride ?? storedUrl;
  const daylight = verdict.daylight;

  return (
    <section
      aria-label={`Next sit at ${propertyName}`}
      style={{
        ...heroStyle,
        ...(photoUrl
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(14, 20, 12, 0.35) 0%, rgba(14, 20, 12, 0.55) 45%, rgba(14, 20, 12, 0.92) 100%), url("${photoUrl}")`,
            }
          : null),
      }}
    >
      <p style={contextStyle}>
        <span>{verdict.periodLabel}</span>
        <span style={contextPropertyStyle}>{propertyName}</span>
      </p>

      <h1 style={headlineStyle}>{verdict.headline}</h1>
      <p style={detailStyle}>{verdict.detail}</p>

      {verdict.chips.length > 0 ? (
        <ul style={chipListStyle}>
          {verdict.chips.map((chip) => (
            <li key={chip.label} style={{ ...chipStyle, ...CHIP_TONE[chip.tone] }}>
              {chip.label}
            </li>
          ))}
        </ul>
      ) : null}

      {daylight ? (
        <div style={lightWrapStyle}>
          <div style={lightLabelRowStyle}>
            <span style={lightLeftStyle}>{daylight.label}</span>
            <span style={lightRightStyle}>Last light {daylight.lastLightLabel}</span>
          </div>
          <div
            role="meter"
            aria-label="Daylight used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(daylight.progress * 100)}
            style={trackStyle}
          >
            <span
              style={{
                ...markerStyle,
                left: `${daylight.progress * 100}%`,
                ...(daylight.isDark ? markerDarkStyle : null),
              }}
            />
          </div>
          <div style={lightScaleStyle}>
            <span>{daylight.sunriseLabel}</span>
            <span>{daylight.lastLightLabel}</span>
          </div>
        </div>
      ) : null}

      {photo && photoUrl ? (
        <p style={creditStyle}>
          {photo.caption}, {photo.dateLabel}
        </p>
      ) : null}
    </section>
  );
}

const heroStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  alignContent: "end",
  gap: "0.55rem",
  minHeight: "min(68vh, 520px)",
  padding: "clamp(1.1rem, 4vw, 1.75rem)",
  paddingTop: "4.5rem",
  borderRadius: "var(--radius)",
  overflow: "hidden",
  color: "#f6f0dc",
  // A fixed dark forest base: the hero text is light in every theme, so the
  // no-photo fallback can't follow the (light) theme surface tokens.
  backgroundColor: "#10130f",
  // Faint terrain contours, matching the property hero band.
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='300' viewBox='0 0 600 300'%3E%3Cg fill='none' stroke='%231f251c' stroke-width='1'%3E%3Cpath d='M-10 230C90 150 210 120 330 135S540 190 610 240'/%3E%3Cpath d='M40 240C120 185 220 165 325 172S500 215 560 250'/%3E%3Cpath d='M100 250C160 215 230 205 320 210S440 232 490 258'/%3E%3Cpath d='M-10 80C100 40 230 30 340 55S520 80 610 50'/%3E%3Cpath d='M-10 115C110 75 240 68 350 88S530 108 610 84'/%3E%3C/g%3E%3C/svg%3E\")",
  backgroundSize: "cover",
  backgroundPosition: "center 30%",
  border: "1px solid #23281f",
  boxShadow: "none",
};

const contextStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
  margin: 0,
  color: "rgba(246, 240, 220, 0.82)",
  fontSize: "0.95rem",
  fontWeight: 600,
};

const contextPropertyStyle: CSSProperties = {
  color: "#f4b866",
  fontWeight: 700,
};

const headlineStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "clamp(2.6rem, 12vw, 3.9rem)",
  fontWeight: 400,
  lineHeight: 0.98,
  letterSpacing: "0.02em",
  textWrap: "balance",
  textShadow: "0 2px 24px rgba(0, 0, 0, 0.45)",
};

const detailStyle: CSSProperties = {
  margin: 0,
  maxWidth: "34ch",
  color: "rgba(246, 240, 220, 0.9)",
  fontSize: "1.05rem",
  lineHeight: 1.45,
};

const chipListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.4rem",
  margin: "0.2rem 0 0",
  padding: 0,
  listStyle: "none",
};

const chipStyle: CSSProperties = {
  padding: "0.35rem 0.7rem",
  border: "1px solid",
  borderRadius: "var(--radius-sm)",
  fontSize: "0.85rem",
  fontWeight: 700,
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
};

const lightWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  marginTop: "0.75rem",
};

const lightLabelRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const lightLeftStyle: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 800,
};

const lightRightStyle: CSSProperties = {
  color: "rgba(246, 240, 220, 0.78)",
  fontSize: "0.85rem",
  fontWeight: 600,
};

// Dawn amber through pale midday to dusk orange, ending in the half hour of
// last light after sunset.
const trackStyle: CSSProperties = {
  position: "relative",
  height: "8px",
  borderRadius: "999px",
  background:
    "linear-gradient(90deg, #e79a4c 0%, #f3d79a 14%, #eef0d8 45%, #f3d79a 78%, #e0732f 93%, #4b3a5a 100%)",
  boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.15)",
};

const markerStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  width: "18px",
  height: "18px",
  borderRadius: "50%",
  background: "#fff",
  border: "3px solid var(--accent)",
  transform: "translate(-50%, -50%)",
  boxShadow: "0 0 0 4px rgba(255, 255, 255, 0.25)",
};

const markerDarkStyle: CSSProperties = {
  background: "#39414f",
  borderColor: "#f6f0dc",
};

const lightScaleStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  color: "rgba(246, 240, 220, 0.65)",
  fontSize: "0.75rem",
  fontWeight: 600,
};

const creditStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "rgba(246, 240, 220, 0.6)",
  fontSize: "0.75rem",
};
