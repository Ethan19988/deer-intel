"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import AuthForm from "@/components/auth/AuthForm";
import { useAuth } from "@/components/auth/AuthProvider";
import HeroScene from "@/components/ui/HeroScene";
import {
  CameraIcon,
  CompassIcon,
  DeerIcon,
  MapIcon,
} from "@/components/ui/FieldIcons";

// What the sign-in unlocks — sold as three field-flavored promises on the hero.
const FEATURES: { icon: ReactNode; title: string; note: string }[] = [
  {
    icon: <CameraIcon size={18} />,
    title: "Trail cameras & photos",
    note: "Organized by site and season",
  },
  {
    icon: <MapIcon size={18} />,
    title: "Maps that work offline",
    note: "Your ground, even with no signal",
  },
  {
    icon: <CompassIcon size={18} />,
    title: "Wind, weather & moon intel",
    note: "Dialed in for every sit",
  },
];

export default function LoginPage() {
  const { configured, status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-in") router.replace("/");
  }, [status, router]);

  return (
    <main style={pageStyle}>
      <div className="di-login-shell" style={shellStyle}>
        {/* ---- Golden-hour showcase ---- */}
        <section
          className="di-login-showcase di-camo"
          style={showcaseStyle}
          aria-hidden="true"
        >
          <span className="di-login-sun" />

          <div style={brandRowStyle}>
            <span style={brandBadgeStyle}>
              <DeerIcon size={26} />
            </span>
            <span style={brandWordmarkStyle}>Deer Intel</span>
          </div>

          <div style={pitchStyle}>
            <p style={heroEyebrowStyle}>Account &amp; Cloud Sync</p>
            <h2 style={heroTitleStyle}>
              Never lose
              <br />a season again.
            </h2>
            <p style={heroLeadStyle}>
              Back up every property, camera, stand, and hunt — and pick up
              right where the woods left off, on any device.
            </p>
          </div>

          <ul className="di-login-features" style={featureListStyle}>
            {FEATURES.map((feature) => (
              <li key={feature.title} style={featureRowStyle}>
                <span style={featureIconStyle}>{feature.icon}</span>
                <span>
                  <span style={featureTitleStyle}>{feature.title}</span>
                  <span style={featureNoteStyle}>{feature.note}</span>
                </span>
              </li>
            ))}
          </ul>

          <HeroScene style={heroSceneStyle} />
        </section>

        {/* ---- Sign-in panel ---- */}
        <section style={formPanelStyle}>
          <div style={formHeaderStyle}>
            <p style={eyebrowStyle}>Welcome to the stand</p>
            <h1 style={titleStyle}>
              {status === "signed-in" ? "You're all set" : "Sign in to sync"}
            </h1>
            <p style={subtitleStyle}>
              Sign in to keep your properties, cameras, stands, hunts, and deer
              profiles in sync across your devices.
            </p>
          </div>

          {!configured ? (
            <div style={infoCardStyle}>
              <p style={infoTitleStyle}>Cloud sync isn&apos;t set up yet</p>
              <p style={mutedStyle}>
                Deer Intel is running in local-only mode. Accounts and cloud
                sync turn on once Supabase environment variables are configured.
                Until then, your data lives safely in this browser and you can
                back it up from Settings.
              </p>
              <Link href="/settings" style={linkStyle} className="di-navbtn">
                Go to Settings
              </Link>
            </div>
          ) : status === "loading" ? (
            <div style={infoCardStyle}>
              <p style={mutedStyle}>Checking your session…</p>
            </div>
          ) : status === "signed-in" ? (
            <div style={infoCardStyle}>
              <p style={infoTitleStyle}>Signed in as {user?.email}</p>
              <Link href="/settings" style={linkStyle} className="di-navbtn">
                Go to Settings
              </Link>
            </div>
          ) : (
            <AuthForm />
          )}

          <Link href="/" style={backLinkStyle}>
            ← Back to Dashboard
          </Link>
        </section>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "clamp(1rem, 5vw, 3rem)",
  background:
    "radial-gradient(1100px 620px at 12% -8%, var(--accent-tint), transparent 62%), var(--bg)",
  color: "var(--text)",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: "980px",
  display: "grid",
  overflow: "hidden",
  borderRadius: "24px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "0 40px 80px -40px rgba(28, 22, 10, 0.55)",
};

// ---- Showcase (imagery panel; overlay colors are fixed & photo-safe, matching
// the map-control / photo-overlay convention rather than theme tokens) ----
const showcaseStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: "1.75rem",
  padding: "clamp(1.75rem, 3.5vw, 2.75rem)",
  backgroundImage:
    "linear-gradient(158deg, rgba(18, 28, 14, 0.9) 0%, rgba(28, 42, 20, 0.66) 44%, rgba(150, 84, 30, 0.5) 100%), var(--camo)",
  backgroundSize: "cover",
  backgroundPosition: "center",
  color: "#f3edd9",
  isolation: "isolate",
};

const brandRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.7rem",
};

const brandBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3rem",
  height: "3rem",
  flex: "none",
  borderRadius: "15px",
  background: "rgba(243, 237, 217, 0.15)",
  border: "1px solid rgba(243, 237, 217, 0.35)",
  color: "#f6efd6",
  backdropFilter: "blur(2px)",
};

const brandWordmarkStyle: CSSProperties = {
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.2rem",
  fontWeight: 800,
  letterSpacing: "0.01em",
};

const pitchStyle: CSSProperties = {
  marginTop: "auto",
  display: "grid",
  gap: "0.85rem",
};

const heroEyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.75rem",
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(243, 237, 217, 0.78)",
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "clamp(2.1rem, 3.4vw, 2.9rem)",
  lineHeight: 1.04,
  fontWeight: 850,
  letterSpacing: "-0.02em",
  color: "#f6f0dc",
  textShadow: "0 2px 18px rgba(12, 18, 8, 0.45)",
};

const heroLeadStyle: CSSProperties = {
  margin: 0,
  maxWidth: "34ch",
  fontSize: "1rem",
  lineHeight: 1.55,
  color: "rgba(243, 237, 217, 0.9)",
};

const featureListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: "1.25rem 0 0",
  borderTop: "1px solid rgba(243, 237, 217, 0.2)",
  display: "grid",
  gap: "0.9rem",
};

const featureRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.8rem",
};

const featureIconStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.1rem",
  height: "2.1rem",
  flex: "none",
  borderRadius: "10px",
  background: "rgba(243, 237, 217, 0.14)",
  border: "1px solid rgba(243, 237, 217, 0.26)",
  color: "#f6efd6",
};

const featureTitleStyle: CSSProperties = {
  display: "block",
  fontWeight: 800,
  fontSize: "0.95rem",
  color: "#f4eeda",
};

const featureNoteStyle: CSSProperties = {
  display: "block",
  fontSize: "0.82rem",
  color: "rgba(243, 237, 217, 0.72)",
};

const heroSceneStyle: CSSProperties = {
  position: "absolute",
  right: "-10px",
  bottom: "-8px",
  width: "230px",
  height: "auto",
  opacity: 0.55,
  zIndex: -1,
  pointerEvents: "none",
};

// ---- Sign-in panel (app chrome; pure tokens) ----
const formPanelStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: "1.25rem",
  padding: "clamp(1.75rem, 3.5vw, 2.75rem)",
  background: "var(--surface)",
};

const formHeaderStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.85rem",
  lineHeight: 1.1,
  fontWeight: 850,
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const infoCardStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "1.25rem",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  background: "var(--surface-2)",
};

const infoTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
  fontWeight: 850,
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const linkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.6rem 0.9rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
  justifySelf: "start",
};

const backLinkStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontWeight: 700,
  textDecoration: "none",
  justifySelf: "center",
};
