import type { CSSProperties } from "react";
import Card from "./Card";

type StatCardProps = {
  label: string;
  value: number | string;
  detail: string;
};

export default function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <Card>
      <p style={labelStyle}>{label}</p>
      <p style={valueStyle}>{value}</p>
      <p style={detailStyle}>{detail}</p>
    </Card>
  );
}

const labelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const valueStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "var(--accent-2)",
  fontSize: "2rem",
  fontWeight: 800,
  lineHeight: 1,
};

const detailStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.98rem",
  lineHeight: 1.5,
};
