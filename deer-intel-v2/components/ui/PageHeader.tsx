import type { CSSProperties, ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  action?: ReactNode;
  /** Optional line-icon shown in a tinted badge left of the title block. */
  icon?: ReactNode;
};

// Tactical page header: flat on the page (no hero box), a mono eyebrow, a big
// Bebas title and the page's one real action on the right — the same header on
// every screen, in every theme.
export default function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  action,
  icon,
}: PageHeaderProps) {
  return (
    <header className="di-page-header" style={headerStyle}>
      <div className="di-page-header-text" style={textStyle}>
        <div style={topRowStyle}>
          {icon ? (
            <span style={iconBadgeStyle} aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div style={{ minWidth: 0 }}>
            {eyebrow ? <p style={eyebrowStyle}>{eyebrow}</p> : null}
            <h1 className="di-page-title" style={titleStyle}>{title}</h1>
          </div>
        </div>
        {meta ? <div style={metaStyle}>{meta}</div> : null}
        {description ? <p style={descriptionStyle}>{description}</p> : null}
      </div>
      {action ? <div className="di-page-header-action">{action}</div> : null}
    </header>
  );
}

const headerStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "0.85rem 1rem",
  padding: "0.25rem 0 1rem",
  marginBottom: "0.25rem",
  borderBottom: "1px solid var(--border)",
};

const textStyle: CSSProperties = {
  flex: "1 1 260px",
  minWidth: 0,
};

const topRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

const iconBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.75rem",
  height: "2.75rem",
  flex: "none",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-strong)",
  color: "var(--accent-2)",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.7rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  color: "var(--text)",
  fontSize: "2.75rem",
  lineHeight: 0.95,
  overflowWrap: "anywhere",
};

const metaStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginTop: "0.6rem",
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.75rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const descriptionStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "0.6rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.98rem",
  lineHeight: 1.55,
};
