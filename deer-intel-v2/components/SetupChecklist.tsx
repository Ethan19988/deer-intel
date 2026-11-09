"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { SetupItem } from "@/lib/setupChecklist";

// "Finish setting up <property>": a one-line pill under the Today hero until
// every item is done, then it disappears on its own. Tapping it opens the full
// list, so setup never pushes the stand call down the screen.
export default function SetupChecklist({
  propertyName,
  items,
}: {
  propertyName: string;
  items: SetupItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const listId = "setup-checklist-items";
  const steps = `${items.length} ${items.length === 1 ? "step" : "steps"}`;

  return (
    <section aria-label={`Finish setting up ${propertyName}`} style={wrapStyle}>
      <button
        type="button"
        style={pillStyle}
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((open) => !open)}
      >
        <span style={pillDotStyle} aria-hidden="true" />
        <span style={pillTextStyle}>
          Finish setting up <span style={pillCountStyle}>· {steps}</span>
        </span>
        <span
          aria-hidden="true"
          style={{ ...chevronStyle, ...(expanded ? chevronOpenStyle : null) }}
        >
          ›
        </span>
      </button>
      {expanded ? (
        <div style={cardStyle}>
          <h2 style={titleStyle}>Finish setting up {propertyName}</h2>
          <ul id={listId} style={listStyle}>
            {items.map((item) => (
              <li key={item.id} style={rowStyle}>
                <span style={dotStyle} aria-hidden="true" />
                <div style={textWrapStyle}>
                  <p style={labelStyle}>{item.label}</p>
                  <p style={detailStyle}>{item.detail}</p>
                </div>
                <Link href={item.href} className="di-navbtn" style={actionStyle}>
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
};

const pillStyle: CSSProperties = {
  justifySelf: "start",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  minHeight: "40px",
  maxWidth: "100%",
  padding: "0.35rem 0.85rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.88rem",
  fontWeight: 600,
  cursor: "pointer",
};

const pillDotStyle: CSSProperties = {
  flex: "none",
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "var(--accent)",
};

const pillTextStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const pillCountStyle: CSSProperties = {
  color: "var(--text-muted)",
};

const chevronStyle: CSSProperties = {
  flex: "none",
  color: "var(--text-muted)",
  fontSize: "1.1rem",
  lineHeight: 1,
  transition: "transform 150ms ease",
};

const chevronOpenStyle: CSSProperties = {
  transform: "rotate(90deg)",
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  padding: "0.9rem 1rem",
  border: "1px solid var(--border)",
  borderLeft: "4px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.02rem",
  fontWeight: 800,
  color: "var(--text)",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.7rem",
};

const dotStyle: CSSProperties = {
  flex: "none",
  width: "0.9rem",
  height: "0.9rem",
  borderRadius: "999px",
  border: "2px solid var(--text-muted)",
};

const textWrapStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.92rem",
  fontWeight: 700,
  color: "var(--text)",
};

const detailStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.8rem",
  color: "var(--text-muted)",
  lineHeight: 1.35,
};

const actionStyle: CSSProperties = {
  flex: "none",
  minHeight: "36px",
  display: "inline-flex",
  alignItems: "center",
  padding: "0.35rem 0.75rem",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent)",
  color: "white",
  fontSize: "0.82rem",
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

