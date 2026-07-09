import type { CSSProperties } from "react";
import RelationshipCard from "@/components/relationships/RelationshipCard";
import EmptyState from "@/components/ui/EmptyState";
import type { RelationshipGroupData } from "@/lib/relationships";

type RelationshipGroupProps = {
  group: RelationshipGroupData;
};

export default function RelationshipGroup({ group }: RelationshipGroupProps) {
  return (
    <section style={groupStyle}>
      <h3 style={groupTitleStyle}>{group.title}</h3>
      {group.relationships.length === 0 ? (
        <EmptyState description={group.emptyDescription} />
      ) : (
        <div style={relationshipGridStyle}>
          {group.relationships.map((relationship) => (
            <RelationshipCard
              key={relationship.id}
              relationship={relationship}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const groupStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const groupTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.95rem",
  lineHeight: 1.25,
};

const relationshipGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};
