import type { CSSProperties, ReactNode } from "react";
import Wordmark from "@/components/ui/Wordmark";

export type AuthHeroItem = { icon: ReactNode; title: string; note: string };

// The dark brand panel beside the sign-in and password-reset forms: the
// DEER INTEL lockup, a condensed headline, and three short promises over faint
// topo contour lines — the same forest-and-rust look as the app icon.
export default function AuthHero({
  eyebrow,
  title,
  lead,
  items,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: string;
  items: AuthHeroItem[];
}) {
  return (
    <section className="di-login-showcase" style={showcaseStyle} aria-hidden="true">
      <div style={brandStyle} className="di-login-brand">
        <Wordmark height={34} />
      </div>

      <div style={pitchStyle}>
        <p style={eyebrowStyle}>{eyebrow}</p>
        <h2 className="di-login-headline" style={titleStyle}>
          {title}
        </h2>
        <p style={leadStyle}>{lead}</p>
      </div>

      <ul className="di-login-features" style={listStyle}>
        {items.map((item) => (
          <li key={item.title} style={rowStyle}>
            <span style={iconStyle}>{item.icon}</span>
            <span>
              <span style={itemTitleStyle}>{item.title}</span>
              <span style={itemNoteStyle}>{item.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Fixed colours: this panel is always the dark brand surface, whatever the
// app theme, like the app icon and the map controls.
const CREAM = "#F3EEE4";
const RUST = "#D9894D";

const showcaseStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: "1.75rem",
  padding: "clamp(1.75rem, 3.5vw, 2.75rem)",
  backgroundColor: "#132117",
  backgroundImage:
    "linear-gradient(170deg, rgba(19, 33, 23, 0.55) 0%, rgba(19, 33, 23, 0.9) 70%), url(/login-topo.svg), linear-gradient(160deg, #2E4D34 0%, #16271A 60%, #0F1A11 100%)",
  backgroundSize: "cover, cover, cover",
  backgroundPosition: "center",
  color: CREAM,
};

const brandStyle: CSSProperties = {
  color: CREAM,
  // The Wordmark's buck uses this.
  ["--di-brand-accent" as string]: RUST,
};

const pitchStyle: CSSProperties = {
  marginTop: "auto",
  display: "grid",
  gap: "0.7rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: RUST,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-headline), var(--font-display), system-ui, sans-serif",
  fontWeight: 400,
  fontSize: "clamp(2.6rem, 4.4vw, 3.6rem)",
  lineHeight: 0.95,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  color: CREAM,
};

const leadStyle: CSSProperties = {
  margin: 0,
  maxWidth: "36ch",
  fontSize: "0.98rem",
  lineHeight: 1.55,
  color: "rgba(243, 238, 228, 0.78)",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: "1.25rem 0 0",
  borderTop: "1px solid rgba(243, 238, 228, 0.16)",
  display: "grid",
  gap: "0.95rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.85rem",
};

const iconStyle: CSSProperties = {
  display: "inline-flex",
  flex: "none",
  color: RUST,
};

const itemTitleStyle: CSSProperties = {
  display: "block",
  fontWeight: 700,
  fontSize: "0.93rem",
  color: CREAM,
};

const itemNoteStyle: CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  color: "rgba(243, 238, 228, 0.6)",
};
