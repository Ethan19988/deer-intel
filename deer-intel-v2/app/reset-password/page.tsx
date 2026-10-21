"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import AuthHero, { type AuthHeroItem } from "@/components/auth/AuthHero";
import { CompassIcon, LeafIcon, MoonIcon } from "@/components/ui/FieldIcons";

// Quiet reassurances for the reset hero — a calmer pitch than the login's
// feature sell, since the hunter is already an account holder.
const ASSURANCES: AuthHeroItem[] = [
  {
    icon: <LeafIcon size={18} />,
    title: "Your data is untouched",
    note: "Properties, cameras, and hunts stay put",
  },
  {
    icon: <CompassIcon size={18} />,
    title: "Back in sync in seconds",
    note: "Every device picks up the new password",
  },
  {
    icon: <MoonIcon size={18} />,
    title: "One quiet step",
    note: "Set it, and you're back to the woods",
  },
];

export default function ResetPasswordPage() {
  const { configured, status, updatePassword } = useAuth();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // After a successful update, send the (now signed-in) user to Settings.
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => router.replace("/settings"), 1800);
    return () => clearTimeout(timer);
  }, [done, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function renderBody() {
    if (!configured) {
      return (
        <div style={infoCardStyle}>
          <p style={infoTitleStyle}>Cloud sync isn&apos;t set up yet</p>
          <p style={mutedStyle}>
            Password resets are handled by the cloud account system, which is
            turned off in local-only mode.
          </p>
          <Link href="/settings" style={linkStyle} className="di-navbtn">
            Go to Settings
          </Link>
        </div>
      );
    }

    if (status === "loading") {
      return (
        <div style={infoCardStyle}>
          <p style={mutedStyle}>Verifying your reset link…</p>
        </div>
      );
    }

    if (done) {
      return (
        <div style={infoCardStyle}>
          <p style={infoTitleStyle}>Password updated</p>
          <p style={mutedStyle}>
            Your password has been changed. Taking you to Settings…
          </p>
          <Link href="/settings" style={linkStyle} className="di-navbtn">
            Go to Settings
          </Link>
        </div>
      );
    }

    if (status !== "signed-in") {
      return (
        <div style={infoCardStyle}>
          <p style={infoTitleStyle}>This reset link isn&apos;t active</p>
          <p style={mutedStyle}>
            Your password reset link may have expired or already been used. Head
            back to the login page and request a new one.
          </p>
          <Link href="/login" style={linkStyle} className="di-navbtn">
            Back to Login
          </Link>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} style={cardStyle}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Re-enter your new password"
            style={inputStyle}
          />
        </label>

        {error ? (
          <p style={errorStyle} role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" fullWidth disabled={busy}>
          {busy ? "Working…" : "Update Password"}
        </Button>
      </form>
    );
  }

  return (
    <main style={pageStyle}>
      <div className="di-login-shell" style={shellStyle}>
        <AuthHero
          eyebrow="Account Recovery"
          title={
            <>
              A fresh key
              <br />to your season.
            </>
          }
          lead="Set a new password and step right back into your properties, cameras, stands, and hunt log — nothing lost along the way."
          items={ASSURANCES}
        />

        {/* ---- Reset panel ---- */}
        <section style={formPanelStyle}>
          <div style={formHeaderStyle}>
            <p style={eyebrowStyle}>Reset your password</p>
            <h1 style={titleStyle}>Set a new password</h1>
            <p style={subtitleStyle}>
              Choose a new password for your account.
            </p>
          </div>

          {renderBody()}

          <Link href="/login" style={backLinkStyle}>
            ← Back to Login
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
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "0 40px 80px -40px rgba(28, 22, 10, 0.55)",
};















// ---- Reset panel (app chrome; pure tokens) ----
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

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
  padding: "1.25rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
};

const infoCardStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "1.25rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
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

const labelStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const labelTextStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  minHeight: "46px",
  padding: "0.65rem 0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "var(--danger-text)",
  lineHeight: 1.5,
};

const linkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.6rem 0.9rem",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
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
