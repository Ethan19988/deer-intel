"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

type CollapsibleSectionVariant = "default" | "bare";

type CollapsibleSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: CollapsibleSectionVariant;
  style?: CSSProperties;
};

export default function CollapsibleSection({
  title,
  description,
  children,
  defaultOpen = false,
  variant = "default",
  style,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      className={`di-collapsible-section di-collapsible-${variant}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...style,
      }}
    >
      <summary className="di-collapsible-summary" style={summaryStyle}>
        <span style={summaryTextStyle}>
          <span style={titleStyle}>{title}</span>
          {description ? (
            <span style={descriptionStyle}>{description}</span>
          ) : null}
        </span>
        <span
          aria-label={isOpen ? "Collapse section" : "Expand section"}
          style={indicatorStyle}
        >
          {isOpen ? "-" : "+"}
        </span>
      </summary>
      <div className="di-collapsible-content" style={contentStyle}>
        {children}
      </div>
    </details>
  );
}

const baseStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
};

const variantStyles: Record<CollapsibleSectionVariant, CSSProperties> = {
  default: {
    padding: "0.85rem",
  },
  bare: {
    padding: 0,
    border: 0,
    background: "transparent",
  },
};

const summaryStyle: CSSProperties = {
  display: "flex",
  minHeight: "50px",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  color: "var(--text)",
  cursor: "pointer",
  listStyle: "none",
};

const summaryTextStyle: CSSProperties = {
  display: "grid",
  minWidth: 0,
  gap: "0.2rem",
};

const titleStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 850,
  lineHeight: 1.25,
};

const descriptionStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.88rem",
  lineHeight: 1.4,
};

const indicatorStyle: CSSProperties = {
  display: "inline-flex",
  width: "36px",
  minHeight: "36px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text-muted)",
  fontSize: "1.1rem",
  fontWeight: 900,
  lineHeight: 1,
};

const contentStyle: CSSProperties = {
  marginTop: "0.85rem",
  paddingTop: "0.85rem",
  borderTop: "1px solid var(--border)",
};
