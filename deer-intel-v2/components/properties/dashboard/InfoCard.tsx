import type { CSSProperties } from "react";
import Card from "@/components/ui/Card";

type InfoCardProps = {
  title: string;
  value: string;
  description: string;
};

export default function InfoCard({ title, value, description }: InfoCardProps) {
  return (
    <Card style={cardStyle}>
      <p style={labelStyle}>{title}</p>
      <p style={valueStyle}>{value}</p>
      <p style={descriptionStyle}>{description}</p>
    </Card>
  );
}

const cardStyle: CSSProperties = {
  minHeight: "150px",
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
  fontSize: "1.25rem",
  fontWeight: 800,
};

const descriptionStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "#b8c2b6",
  fontSize: "0.98rem",
  lineHeight: 1.5,
};
