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
  const { signInWithPassword, signUp, signInWithMagicLink, signInWithGitHub } =
    useAuth();

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

  async function handleGitHub() {
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      // On success this redirects the whole page to GitHub, so busy stays true
      // until navigation. Only reached again if there is an error.
      const result = await signInWithGitHub();
      if (result.error) {
        setError(result.error);
        setBusy(false);
      }
    } catch {
      setError("Couldn't start GitHub sign-in. Please try again.");
      setBusy(false);
    }
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
      <button
        type="button"
        onClick={handleGitHub}
        disabled={busy}
        style={{ ...githubButtonStyle, ...(busy ? disabledStyle : null) }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden
        >
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
        Continue with GitHub
      </button>

      <div style={dividerStyle} aria-hidden>
        <span style={dividerLineStyle} />
        <span style={dividerTextStyle}>or use email</span>
        <span style={dividerLineStyle} />
      </div>

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
  border: "1px solid var(--border)",
  borderRadius: "12px",
  background: "var(--surface-2)",
};

const githubButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.55rem",
  minHeight: "48px",
  width: "100%",
  padding: "0.72rem 0.95rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.98rem",
  fontWeight: 850,
  cursor: "pointer",
};

const disabledStyle: CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

const dividerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
};

const dividerLineStyle: CSSProperties = {
  flex: 1,
  height: "1px",
  background: "var(--border)",
};

const dividerTextStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontSize: "0.75rem",
  fontWeight: 800,
  textTransform: "uppercase",
};

const tabRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
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
