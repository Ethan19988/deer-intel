import type { CSSProperties, ReactNode } from "react";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
};

export default function Section({
  id,
  eyebrow,
  title,
  action,
  children,
  style,
}: SectionProps) {
  return (
    <section id={id} className="di-section" style={{ ...sectionStyle, ...style }}>
      <div className="di-section-header" style={headerStyle}>
        <div style={headerTextStyle}>
          {eyebrow ? <p style={eyebrowStyle}>{eyebrow}</p> : null}
          <h2 style={titleStyle}>{title}</h2>
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

const headerTextStyle: CSSProperties = {
  minWidth: 0,
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
  margin: "0.2rem 0 0",
  fontSize: "1.35rem",
  lineHeight: 1.2,
};
