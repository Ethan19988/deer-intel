import type { CSSProperties, ReactNode } from "react";
import PageHeader from "@/components/ui/PageHeader";

type AssetHeaderProps = {
  assetType: string;
  name: string;
  propertyName: string;
  description: string;
  status?: string;
  children?: ReactNode;
  /** Optional line-icon shown in a tinted badge beside the name. */
  icon?: ReactNode;
};

// An asset page (camera site, stand) uses the same flat tactical header as
// every other screen: asset type as the eyebrow, the name as the title, the
// property and status as mono meta, then the key facts in a bordered strip.
export default function AssetHeader({
  assetType,
  name,
  propertyName,
  description,
  status,
  children,
  icon,
}: AssetHeaderProps) {
  const meta = [propertyName, status].filter(Boolean).join(" · ");

  return (
    <section id="asset-overview" style={wrapStyle}>
      <PageHeader
        eyebrow={assetType}
        title={name}
        icon={icon}
        meta={meta || undefined}
        description={description}
      />

      {children ? <div style={detailsStyle}>{children}</div> : null}
    </section>
  );
}

const wrapStyle: CSSProperties = {
  marginTop: "1rem",
};

const detailsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  padding: "1rem 1.15rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
};
