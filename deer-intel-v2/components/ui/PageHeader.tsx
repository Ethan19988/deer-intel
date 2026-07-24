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
          <div>
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
  flex: "1 1 420px",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const textStyle: CSSProperties = {
  flex: "1 1 420px",
};

const topRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.85rem",
};

const iconBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3rem",
  height: "3rem",
  flex: "none",
  borderRadius: "14px",
  background: "var(--accent-tint)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  fontSize: "2.1rem",
  lineHeight: 1.1,
};

const metaStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginTop: "0.85rem",
  color: "var(--text-muted)",
  fontWeight: 700,
};

const descriptionStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "0.85rem 0 0",
  color: "var(--text-muted)",
  fontSize: "1.02rem",
  lineHeight: 1.6,
};
