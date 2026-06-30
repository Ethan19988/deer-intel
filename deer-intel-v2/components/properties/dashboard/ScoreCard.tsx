import type { CSSProperties } from "react";

type ScoreCardProps = {
  title: string;
  value: string;
  description: string;
};

export default function ScoreCard({
  title,
  value,
  description,
}: ScoreCardProps) {
  return (
    <article style={scoreCardStyle}>
      <p style={labelStyle}>{title}</p>
      <p style={valueStyle}>{value}</p>
      <p style={descriptionStyle}>{description}</p>
    </article>
  );
}

const scoreCardStyle: CSSProperties = {
  padding: "1rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "#879486",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const valueStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "#f1f5ef",
  fontSize: "2rem",
  fontWeight: 800,
  lineHeight: 1.1,
};

const descriptionStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.5,
};
