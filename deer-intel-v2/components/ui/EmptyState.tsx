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
  padding: "1rem",
  border: "1px dashed #334533",
  borderRadius: "8px",
  background: "#071007",
  color: "#b8c2b6",
  fontSize: "1rem",
  lineHeight: 1.5,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
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
