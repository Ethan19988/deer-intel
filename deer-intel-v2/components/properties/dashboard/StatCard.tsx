import type { CSSProperties } from "react";

type StatCardProps = {
  label: string;
  value: number;
  detail: string;
};

export default function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <article style={cardStyle}>
      <p style={labelStyle}>{label}</p>
      <p style={valueStyle}>{value}</p>
      <p style={detailStyle}>{detail}</p>
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
  margin: "0.35rem 0 0",
  color: "#f1f5ef",
  fontSize: "2rem",
  fontWeight: 800,
  lineHeight: 1,
};

const detailStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.5,
};
