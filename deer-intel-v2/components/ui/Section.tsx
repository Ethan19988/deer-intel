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
    <section id={id} style={{ ...sectionStyle, ...style }}>
      <div style={headerStyle}>
        <div>
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
  marginBottom: "1rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.45rem",
  lineHeight: 1.2,
};
