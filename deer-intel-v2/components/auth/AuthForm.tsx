"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";

type Mode = "sign-in" | "sign-up" | "reset";

// Submit-button label per mode.
const MODE_LABELS: Record<Mode, string> = {
  "sign-in": "Sign In",
  "sign-up": "Create Account",
  reset: "Send Reset Link",
};

// Only sign-in / sign-up are shown as tabs. "reset" is reached from the
// "Forgot password?" link below the form.
const TAB_LABELS: Partial<Record<Mode, string>> = {
  "sign-in": "Sign In",
  "sign-up": "Sign Up",
};

export default function AuthForm() {
  const { signInWithPassword, signUp, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    if (mode !== "reset" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "sign-in") {
        const result = await signInWithPassword(email, password);
        if (result.error) setError(result.error);
      } else if (mode === "sign-up") {
        const result = await signUp(email, password);
        if (result.error) {
          setError(result.error);
        } else if (result.needsConfirmation) {
          setNotice(
            "Account created. Check your email to confirm it, then sign in.",
          );
        }
      } else {
        const result = await sendPasswordReset(email);
        if (result.error) {
          setError(result.error);
        } else {
          setNotice(
            "If an account exists for that email, we've sent a link to reset your password.",
          );
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={tabRowStyle} role="tablist" aria-label="Account mode">
        {(Object.keys(TAB_LABELS) as Mode[]).map((value) => {
          const isActive = value === mode;

          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => switchMode(value)}
              style={{
                ...tabStyle,
                ...(isActive ? activeTabStyle : null),
              }}
            >
              {TAB_LABELS[value]}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </label>

        {mode !== "reset" ? (
          <label style={labelStyle}>
            <span style={labelTextStyle}>Password</span>
            <input
              type="password"
              autoComplete={
                mode === "sign-up" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              style={inputStyle}
            />
          </label>
        ) : (
          <p style={hintStyle}>
            Enter your account email and we&apos;ll send you a link to set a new
            password.
          </p>
        )}

        {error ? (
          <p style={errorStyle} role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p style={noticeStyle} role="status">
            {notice}
          </p>
        ) : null}

        <Button type="submit" variant="primary" fullWidth disabled={busy}>
          {busy ? "Working…" : MODE_LABELS[mode]}
        </Button>

        {mode === "sign-in" ? (
          <button
            type="button"
            onClick={() => switchMode("reset")}
            style={textButtonStyle}
          >
            Forgot password?
          </button>
        ) : mode === "reset" ? (
          <button
            type="button"
            onClick={() => switchMode("sign-in")}
            style={textButtonStyle}
          >
            ← Back to sign in
          </button>
        ) : null}
      </form>
    </div>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  padding: "1.25rem",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  background: "var(--surface-2)",
};

const tabRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "0.4rem",
};

const tabStyle: CSSProperties = {
  minHeight: "42px",
  padding: "0.5rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 800,
  cursor: "pointer",
};

const activeTabStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent)",
  color: "var(--accent-fg)",
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
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

const textButtonStyle: CSSProperties = {
  justifySelf: "center",
  padding: "0.25rem",
  border: "none",
  background: "none",
  color: "var(--accent-text)",
  fontSize: "0.88rem",
  fontWeight: 700,
  cursor: "pointer",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "var(--danger-text)",
  lineHeight: 1.5,
};

const noticeStyle: CSSProperties = {
  margin: 0,
  color: "var(--success-text)",
  lineHeight: 1.5,
};
