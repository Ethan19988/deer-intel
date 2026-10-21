"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { SetupItem } from "@/lib/setupChecklist";

// "Finish setting up <property>" — sits at the top of Today until every item
// is done, then disappears on its own. Shows the first few items; the rest are
// one tap away so the card never pushes the verdict far down the screen.
const VISIBLE_COUNT = 3;

export default function SetupChecklist({
  propertyName,
  items,
}: {
  propertyName: string;
  items: SetupItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const shown = expanded ? items : items.slice(0, VISIBLE_COUNT);
  const hidden = items.length - shown.length;

  return (
    <section aria-label={`Finish setting up ${propertyName}`} style={cardStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>Finish setting up {propertyName}</h2>
        <span style={countStyle}>
          {items.length} left
        </span>
      </div>
      <ul style={listStyle}>
        {shown.map((item) => (
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
      {hidden > 0 || expanded ? (
        <button
          type="button"
          style={moreStyle}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      ) : null}
    </section>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  marginBottom: "0.9rem",
  padding: "0.9rem 1rem",
  border: "1px solid var(--border)",
  borderLeft: "4px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.02rem",
  fontWeight: 800,
  color: "var(--text)",
};

const countStyle: CSSProperties = {
  flex: "none",
  color: "var(--text-muted)",
  fontSize: "0.82rem",
  fontWeight: 700,
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

const moreStyle: CSSProperties = {
  justifySelf: "start",
  padding: "0.25rem 0",
  border: "none",
  background: "none",
  color: "var(--accent-text)",
  fontSize: "0.85rem",
  fontWeight: 700,
  cursor: "pointer",
};
