import type { CSSProperties, ReactNode } from "react";

type EmptyStateProps = {
  title?: string;
  description: string;
  action?: ReactNode;
  /**
   * Optional line-icon illustration (e.g. a FieldIcons glyph). When provided,
   * the empty state centers and shows the icon in a soft badge above the copy —
   * turning a first-run dead-end into a friendly invitation. Small inline
   * empties can keep omitting it and render as a plain note, exactly as before.
   */
  illustration?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  action,
  illustration,
}: EmptyStateProps) {
  const illustrated = Boolean(illustration);

  return (
    <div
      className="di-empty-state"
      style={{
        ...emptyStateStyle,
        ...(illustrated ? illustratedStyle : null),
      }}
    >
      {illustration ? (
        <span style={illustrationStyle} aria-hidden="true">
          {illustration}
        </span>
      ) : null}
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

const illustratedStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  textAlign: "center",
  gap: "0.5rem",
  padding: "2rem 1.4rem",
};

const illustrationStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3.4rem",
  height: "3.4rem",
  marginBottom: "0.15rem",
  borderRadius: "16px",
  background: "var(--accent-tint)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
  boxShadow: "0 8px 20px -14px rgba(36, 29, 16, 0.6)",
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
