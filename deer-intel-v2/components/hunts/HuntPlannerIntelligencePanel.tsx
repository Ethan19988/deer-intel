import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import type {
  HuntPlannerIntelligence,
  HuntPlannerItem,
} from "@/lib/huntPlannerIntelligence";

type HuntPlannerIntelligencePanelProps = {
  summary: HuntPlannerIntelligence;
};

export default function HuntPlannerIntelligencePanel({
  summary,
}: HuntPlannerIntelligencePanelProps) {
  return (
    <div style={panelStyle}>
      <div style={emptyStateGridStyle}>
        {!summary.hasStands ? (
          <EmptyState
            title="No stands yet"
            description="Add stand sites before Deer Intel can recommend where to hunt."
          />
        ) : null}
        {!summary.hasCameraActivity ? (
          <EmptyState
            title="No camera activity yet"
            description="Save camera checks or photo records to bring recent movement into the hunt plan."
          />
        ) : null}
        {!summary.hasHuntHistory ? (
          <EmptyState
            title="No hunt history yet"
            description="Log hunts to help Deer Intel understand pressure and stand results."
          />
        ) : null}
        {!summary.hasWindData ? (
          <EmptyState
            title="No wind data recorded yet"
            description="Add best wind notes to stands so the plan can favor better sits."
          />
        ) : null}
      </div>

      <div style={candidateGridStyle}>
        {summary.bestStandCandidates.length > 0 ? (
          summary.bestStandCandidates.map((candidate) => (
            <PlannerCard key={candidate.id} item={candidate}>
              <div style={reasonListStyle}>
                {candidate.reasons.slice(0, 4).map((reason) => (
                  <span key={reason} style={reasonPillStyle}>
                    {reason}
                  </span>
                ))}
              </div>
            </PlannerCard>
          ))
        ) : (
          <EmptyState
            title="No stand candidates yet"
            description="Add stands, wind notes, hunts, or camera activity to build candidate recommendations."
          />
        )}
      </div>

      <div style={listGridStyle}>
        <PlannerList
          title="Stands Not Hunted Recently"
          emptyDescription="No low-pressure stand opportunities found yet."
          items={summary.standsNotHuntedRecently}
        />
        <PlannerList
          title="Recent Camera Activity"
          emptyDescription="No recent deer activity has been saved from camera checks yet."
          items={summary.standsWithRecentCameraActivity}
        />
        <PlannerList
          title="Good Wind Notes"
          emptyDescription="No stands have best wind notes yet."
          items={summary.standsWithGoodWindNotes}
        />
        <PlannerList
          title="Recent Buck Activity"
          emptyDescription="No buck activity has been saved yet."
          items={summary.recentBuckAreas}
        />
        <PlannerList
          title="Needs More Scouting"
          emptyDescription="No obvious scouting gaps right now."
          items={summary.areasNeedingMoreScouting}
        />
      </div>
    </div>
  );
}

function PlannerList({
  title,
  emptyDescription,
  items,
}: {
  title: string;
  emptyDescription: string;
  items: HuntPlannerItem[];
}) {
  return (
    <Card as="section" variant="subtle">
      <h3 style={sectionTitleStyle}>{title}</h3>
      {items.length === 0 ? (
        <p style={mutedTextStyle}>{emptyDescription}</p>
      ) : (
        <div style={itemListStyle}>
          {items.map((item) => (
            <PlannerItemLink key={item.id} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}

function PlannerCard({
  item,
  children,
}: {
  item: HuntPlannerItem;
  children?: ReactNode;
}) {
  return (
    <Card as="article" variant="subtle">
      <div style={cardHeaderStyle}>
        <p style={eyebrowStyle}>Best Stand Candidate</p>
        {item.badge ? <Badge variant="success">{item.badge}</Badge> : null}
      </div>
      <h3 style={cardTitleStyle}>{item.title}</h3>
      <p style={mutedTextStyle}>{item.detail}</p>
      {children}
      {item.href ? (
        <Link href={item.href} style={openLinkStyle}>
          Open Stand
        </Link>
      ) : null}
    </Card>
  );
}

function PlannerItemLink({ item }: { item: HuntPlannerItem }) {
  const content = (
    <>
      <span style={itemHeaderStyle}>
        <span style={itemTitleStyle}>{item.title}</span>
        {item.badge ? <Badge>{item.badge}</Badge> : null}
      </span>
      <span style={itemDetailStyle}>{item.detail}</span>
    </>
  );

  if (!item.href) {
    return <div style={itemStyle}>{content}</div>;
  }

  return (
    <Link href={item.href} style={itemLinkStyle}>
      {content}
    </Link>
  );
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const emptyStateGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const candidateGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: "1rem",
};

const listGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "1rem",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "1.08rem",
  lineHeight: 1.25,
};

const itemListStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
  marginTop: "1rem",
};

const itemStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  minHeight: "58px",
  padding: "0.8rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#070a07",
};

const itemLinkStyle: CSSProperties = {
  ...itemStyle,
  color: "white",
  textDecoration: "none",
};

const itemHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const itemTitleStyle: CSSProperties = {
  color: "#f1f5ef",
  fontWeight: 850,
};

const itemDetailStyle: CSSProperties = {
  color: "#b8c2b6",
  lineHeight: 1.45,
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const cardTitleStyle: CSSProperties = {
  margin: "0.8rem 0 0",
  color: "#f1f5ef",
  fontSize: "1.35rem",
  lineHeight: 1.2,
};

const mutedTextStyle: CSSProperties = {
  margin: "0.65rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.5,
};

const reasonListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
  marginTop: "1rem",
};

const reasonPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.35rem 0.55rem",
  border: "1px solid #2d402d",
  borderRadius: "8px",
  background: "#101a10",
  color: "#c6d5c5",
  fontSize: "0.8rem",
  fontWeight: 800,
};

const openLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  marginTop: "1rem",
  color: "#a7d1a6",
  fontWeight: 850,
  textDecoration: "none",
};
