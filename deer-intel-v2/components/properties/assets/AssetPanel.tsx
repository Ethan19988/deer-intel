import type { CSSProperties, ReactNode } from "react";
import Card from "@/components/ui/Card";

type AssetPanelProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export default function AssetPanel({
  title,
  description,
  children,
}: AssetPanelProps) {
  return (
    <Card as="section" style={panelStyle}>
      <h2 style={titleStyle}>{title}</h2>
      {description ? <p style={descriptionStyle}>{description}</p> : null}
      <div style={contentStyle}>{children}</div>
    </Card>
  );
}

const panelStyle: CSSProperties = {
  minHeight: "220px",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "1.35rem",
  lineHeight: 1.2,
};

const descriptionStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.5,
};

const contentStyle: CSSProperties = {
  marginTop: "1rem",
};
