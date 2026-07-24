import type { CSSProperties, ReactNode } from "react";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  /** Optional line-icon shown in a tinted badge left of the heading. */
  icon?: ReactNode;
};

export default function Section({
  id,
  eyebrow,
  title,
  action,
  children,
  style,
  icon,
}: SectionProps) {
  return (
    <section id={id} className="di-section" style={{ ...sectionStyle, ...style }}>
      <div className="di-section-header" style={headerStyle}>
        <div style={headerTextRowStyle}>
          {icon ? (
            <span style={iconBadgeStyle} aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div style={headerTextStyle}>
            {eyebrow ? <p style={eyebrowStyle}>{eyebrow}</p> : null}
            <h2 style={titleStyle}>{title}</h2>
          </div>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

const sectionStyle: CSSProperties = {
  marginTop: "1.75rem",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
  marginBottom: "1rem",
};

const headerTextRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.7rem",
  minWidth: 0,
};

const iconBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.2rem",
  height: "2.2rem",
  flex: "none",
  borderRadius: "10px",
  background: "var(--accent-2-tint)",
  border: "1px solid var(--accent-2-tint-border)",
  color: "var(--accent-2-text)",
};

const headerTextStyle: CSSProperties = {
  minWidth: 0,
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
  margin: "0.2rem 0 0",
  fontSize: "1.35rem",
  lineHeight: 1.2,
};
