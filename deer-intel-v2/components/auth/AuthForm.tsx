"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";

type Mode = "sign-in" | "sign-up" | "magic-link";

const MODE_LABELS: Record<Mode, string> = {
  "sign-in": "Sign In",
  "sign-up": "Create Account",
  "magic-link": "Email Me a Link",
};

export default function AuthForm() {
  const { signInWithPassword, signUp, signInWithMagicLink } = useAuth();

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

    if (mode !== "magic-link" && password.length < 6) {
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
        const result = await signInWithMagicLink(email);
        if (result.error) {
          setError(result.error);
        } else {
          setNotice("Check your email for a sign-in link.");
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
        {(Object.keys(MODE_LABELS) as Mode[]).map((value) => {
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
              {value === "sign-in"
                ? "Sign In"
                : value === "sign-up"
                  ? "Sign Up"
                  : "Magic Link"}
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

        {mode !== "magic-link" ? (
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
            We&apos;ll email you a one-tap link — no password needed.
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
      </form>
    </div>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  padding: "1.25rem",
  border: "1px solid #243224",
  borderRadius: "12px",
  background: "#0a0f0a",
};

const tabRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "0.4rem",
};

const tabStyle: CSSProperties = {
  minHeight: "42px",
  padding: "0.5rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
  color: "#c6d5c5",
  fontSize: "0.9rem",
  fontWeight: 800,
  cursor: "pointer",
};

const activeTabStyle: CSSProperties = {
  borderColor: "#3b6843",
  background: "#18351d",
  color: "#c6f0c6",
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
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 800,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  minHeight: "46px",
  padding: "0.65rem 0.75rem",
  border: "1px solid #2b3a2b",
  borderRadius: "8px",
  background: "#070a07",
  color: "#f1f5ef",
  fontSize: "1rem",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "#b8c2b6",
  lineHeight: 1.5,
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "#ffb4b4",
  lineHeight: 1.5,
};

const noticeStyle: CSSProperties = {
  margin: 0,
  color: "#c6f0c6",
  lineHeight: 1.5,
};
