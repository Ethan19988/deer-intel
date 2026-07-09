import type { CSSProperties, ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  action?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  action,
}: PageHeaderProps) {
  return (
    <header className="di-page-header" style={headerStyle}>
      <div className="di-page-header-text" style={textStyle}>
        {eyebrow ? <p style={eyebrowStyle}>{eyebrow}</p> : null}
        <h1 className="di-page-title" style={titleStyle}>{title}</h1>
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

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
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
