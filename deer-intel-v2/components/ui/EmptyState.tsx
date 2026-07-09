import type { CSSProperties, ReactNode } from "react";

type EmptyStateProps = {
  title?: string;
  description: string;
  action?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="di-empty-state" style={emptyStateStyle}>
      {title ? <p style={titleStyle}>{title}</p> : null}
      <p style={{ ...descriptionStyle, ...(title ? titledDescriptionStyle : null) }}>
        {description}
      </p>
      {action ? <div style={actionStyle}>{action}</div> : null}
    </div>
  );
}

const emptyStateStyle: CSSProperties = {
  margin: "1rem 0 0",
  padding: "1.25rem",
  border: "1px dashed rgba(60, 48, 24, 0.35)",
  borderRadius: "var(--radius)",
  color: "var(--camo-fg-muted)",
  backgroundColor: "var(--camo-ink)",
  backgroundImage:
    "linear-gradient(rgba(233, 226, 206, 0.62), rgba(233, 226, 206, 0.72)), var(--camo)",
  backgroundSize: "cover",
  backgroundPosition: "center",
  fontSize: "1rem",
  lineHeight: 1.5,
  textShadow: "0 1px 0 rgba(255, 255, 255, 0.35)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--camo-fg)",
  fontWeight: 850,
};

const descriptionStyle: CSSProperties = {
  margin: 0,
};

const titledDescriptionStyle: CSSProperties = {
  marginTop: "0.35rem",
};

const actionStyle: CSSProperties = {
  marginTop: "1rem",
};
