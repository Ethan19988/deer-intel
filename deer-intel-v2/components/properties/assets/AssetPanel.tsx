import type { CSSProperties, ReactNode } from "react";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

type AssetPanelProps = {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export default function AssetPanel({
  id,
  title,
  description,
  children,
  defaultOpen = true,
}: AssetPanelProps) {
  return (
    <Card as="section" id={id} style={panelStyle}>
      <CollapsibleSection
        title={title}
        description={description}
        defaultOpen={defaultOpen}
        variant="bare"
      >
        {children}
      </CollapsibleSection>
    </Card>
  );
}

const panelStyle: CSSProperties = {
  minHeight: "220px",
};
