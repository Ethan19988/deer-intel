import type { CSSProperties } from "react";

type InfoCardProps = {
  title: string;
  value: string;
  description: string;
};

export default function InfoCard({ title, value, description }: InfoCardProps) {
  return (
    <article style={cardStyle}>
      <p style={labelStyle}>{title}</p>
      <p style={valueStyle}>{value}</p>
      <p style={descriptionStyle}>{description}</p>
    </article>
  );
}

const cardStyle: CSSProperties = {
  padding: "1rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "#879486",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const valueStyle: CSSProperties = {
  margin: "0.45rem 0 0",
  color: "#f1f5ef",
  fontSize: "1.15rem",
  fontWeight: 800,
};

const descriptionStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.5,
};
