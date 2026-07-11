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
          <Link href="/settings" style={linkStyle}>
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
          <Link href="/settings" style={linkStyle}>
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
          <Link href="/login" style={linkStyle}>
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
      <div style={shellStyle}>
        <div style={headerStyle}>
          <p style={eyebrowStyle}>Deer Intel</p>
          <h1 style={titleStyle}>🦌 Reset Your Password</h1>
          <p style={subtitleStyle}>
            Choose a new password for your account.
          </p>
        </div>

        {renderBody()}

        <Link href="/login" style={backLinkStyle}>
          ← Back to Login
        </Link>
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
  background: "var(--bg)",
  color: "var(--text)",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: "440px",
  display: "grid",
  gap: "1.25rem",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.7rem",
  lineHeight: 1.15,
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
  borderRadius: "12px",
  background: "var(--surface-2)",
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
  borderRadius: "8px",
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
