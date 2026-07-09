import type { CSSProperties } from "react";
import Card from "@/components/ui/Card";

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
    <Card style={scoreCardStyle}>
      <p style={labelStyle}>{title}</p>
      <p style={valueStyle}>{value}</p>
      <p style={descriptionStyle}>{description}</p>
    </Card>
  );
}

const scoreCardStyle: CSSProperties = {
  minHeight: "150px",
  background: "var(--surface-2)",
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const valueStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "var(--text)",
  fontSize: "2.2rem",
  fontWeight: 800,
  lineHeight: 1.1,
};

const descriptionStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.98rem",
  lineHeight: 1.5,
};
