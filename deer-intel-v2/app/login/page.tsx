"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type CSSProperties } from "react";
import AuthForm from "@/components/auth/AuthForm";
import { useAuth } from "@/components/auth/AuthProvider";
import AuthHero, { type AuthHeroItem } from "@/components/auth/AuthHero";
import { CameraIcon, CompassIcon, MapIcon } from "@/components/ui/FieldIcons";

// What the sign-in unlocks — sold as three field-flavored promises on the hero.
const FEATURES: AuthHeroItem[] = [
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
        <AuthHero
          eyebrow="Account & Cloud Sync"
          title={
            <>
              Never lose
              <br />a season again.
            </>
          }
          lead="Back up every property, camera, stand, and hunt — and pick up right where the woods left off, on any device."
          items={FEATURES}
        />

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
            ← Back to Today
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
  color: "var(--accent-2-text)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  // Same condensed lettering as the hero headline and the wordmark.
  fontFamily: "var(--font-headline), var(--font-display), system-ui, sans-serif",
  fontSize: "2.4rem",
  fontWeight: 400,
  lineHeight: 1,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
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
