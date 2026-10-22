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

// Tactical empty state: a flat panel with a dashed edge and faint terrain
// contours, the icon in a squared outline, a Bebas title and one clear action.
// Built on theme tokens so it reads in the light and red Night themes too.
const emptyStateStyle: CSSProperties = {
  margin: "1rem 0 0",
  padding: "1.1rem 1.15rem",
  border: "1px dashed var(--border-strong)",
  borderRadius: "var(--radius)",
  color: "var(--text-muted)",
  background: "var(--surface)",
  fontSize: "0.98rem",
  lineHeight: 1.5,
};

const illustratedStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  textAlign: "center",
  gap: "0.45rem",
  padding: "2rem 1.25rem 1.6rem",
  backgroundImage: "var(--contours, none)",
  backgroundSize: "cover",
  backgroundPosition: "center",
};

const illustrationStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3.25rem",
  height: "3.25rem",
  marginBottom: "0.35rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  color: "var(--accent-2)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1.6rem",
  fontWeight: 400,
  letterSpacing: "0.03em",
  lineHeight: 1,
  textTransform: "uppercase",
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  maxWidth: "34rem",
};

const titledDescriptionStyle: CSSProperties = {
  marginTop: "0.2rem",
};

const actionStyle: CSSProperties = {
  marginTop: "0.9rem",
};
