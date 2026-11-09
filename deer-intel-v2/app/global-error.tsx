"use client";

import { useEffect, type CSSProperties } from "react";

// Last-resort crash screen for errors in the root layout itself. It replaces
// the whole document, so globals.css, fonts and theme tokens may not be there:
// everything is inline, in the dark field palette (same values as the dark
// tokens in app/globals.css). Plain <a> on purpose — a full reload is the
// point when the app shell is broken.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={bodyStyle}>
        <main style={cardStyle}>
          <p style={titleStyle}>Something went wrong</p>
          <p style={textStyle}>
            Deer Intel hit an error. Your saved data is safe. Try again, or
            reload the app.
          </p>
          <div style={actionsStyle}>
            <button type="button" onClick={() => reset()} style={primaryStyle}>
              Retry
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={secondaryStyle}>
              Today
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

const bodyStyle: CSSProperties = {
  margin: 0,
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  boxSizing: "border-box",
  background: "#0b0d0b",
  color: "#e8e6df",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Arial, sans-serif",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "480px",
  padding: "1.75rem 1.25rem",
  border: "1px dashed #3a4134",
  borderRadius: "4px",
  background: "#121511",
  textAlign: "center",
  boxSizing: "border-box",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "\"Arial Narrow\", Arial, sans-serif",
  fontSize: "1.6rem",
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  lineHeight: 1.1,
};

const textStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  color: "#a3a89c",
  lineHeight: 1.5,
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "0.6rem",
  marginTop: "1.1rem",
};

const buttonBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "46px",
  padding: "0.72rem 1.1rem",
  borderRadius: "3px",
  fontFamily: "\"Arial Narrow\", Arial, sans-serif",
  fontSize: "1.05rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textDecoration: "none",
  cursor: "pointer",
  boxSizing: "border-box",
};

const primaryStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: "1px solid #ff6a1a",
  background: "#ff6a1a",
  color: "#0b0d0b",
};

const secondaryStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: "1px solid #3a4134",
  background: "transparent",
  color: "#e8e6df",
};
