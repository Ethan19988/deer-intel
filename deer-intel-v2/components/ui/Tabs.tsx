"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  badge?: string | number;
  content: ReactNode;
};

type TabsProps = {
  items: TabItem[];
  initialId?: string;
  /** Controlled active tab. When set, the parent owns the state. */
  activeId?: string;
  onChange?: (id: string) => void;
};

// A lightweight segmented tab control so a page can lead with its primary view
// and tuck secondary content (summaries, intelligence) behind a click. Works
// uncontrolled, or controlled via activeId/onChange for deep-linking.
export default function Tabs({
  items,
  initialId,
  activeId,
  onChange,
}: TabsProps) {
  const [internalId, setInternalId] = useState(initialId ?? items[0]?.id);
  const currentId = activeId ?? internalId;
  const activeItem = items.find((item) => item.id === currentId) ?? items[0];

  function selectTab(id: string) {
    if (activeId === undefined) setInternalId(id);
    onChange?.(id);
  }

  if (!activeItem) return null;

  return (
    <div style={wrapStyle}>
      <div role="tablist" aria-label="View" style={tablistStyle}>
        {items.map((item) => {
          const isActive = item.id === activeItem.id;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(item.id)}
              style={{ ...tabStyle, ...(isActive ? activeTabStyle : null) }}
            >
              {item.label}
              {item.badge !== undefined && item.badge !== "" ? (
                <span
                  style={{
                    ...countStyle,
                    ...(isActive ? activeCountStyle : null),
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{activeItem.content}</div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "1.15rem",
};

const tablistStyle: CSSProperties = {
  display: "inline-flex",
  gap: "0.25rem",
  padding: "0.28rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface-2)",
  width: "fit-content",
  maxWidth: "100%",
  overflowX: "auto",
};

const tabStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  minHeight: "38px",
  padding: "0.4rem 0.9rem",
  border: "1px solid transparent",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "var(--text-muted)",
  fontSize: "0.95rem",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const activeTabStyle: CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "var(--shadow-sm)",
};

const countStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "1.3rem",
  padding: "0 0.35rem",
  borderRadius: "999px",
  background: "var(--surface-3)",
  color: "var(--text-muted)",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const activeCountStyle: CSSProperties = {
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};
