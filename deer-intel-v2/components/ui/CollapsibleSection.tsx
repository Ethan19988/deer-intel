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
        <span style={indicatorStyle}>{isOpen ? "Close" : "Open"}</span>
      </summary>
      <div className="di-collapsible-content" style={contentStyle}>
        {children}
      </div>
    </details>
  );
}

const baseStyle: CSSProperties = {
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
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
  minHeight: "48px",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  color: "#f1f5ef",
  cursor: "pointer",
  listStyle: "none",
};

const summaryTextStyle: CSSProperties = {
  display: "grid",
  minWidth: 0,
  gap: "0.2rem",
};

const titleStyle: CSSProperties = {
  color: "#f1f5ef",
  fontSize: "1rem",
  fontWeight: 850,
  lineHeight: 1.25,
};

const descriptionStyle: CSSProperties = {
  color: "#aebaaa",
  fontSize: "0.88rem",
  lineHeight: 1.4,
};

const indicatorStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "36px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.4rem 0.65rem",
  border: "1px solid #2b3a2b",
  borderRadius: "999px",
  background: "#101710",
  color: "#dce9da",
  fontSize: "0.78rem",
  fontWeight: 850,
};

const contentStyle: CSSProperties = {
  marginTop: "0.85rem",
  paddingTop: "0.85rem",
  borderTop: "1px solid #1e2a1e",
};
