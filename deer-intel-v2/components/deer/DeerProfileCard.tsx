import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import EmptyState from "@/components/ui/EmptyState";
import type { DeerProfileIntelligence } from "@/lib/deerProfileIntelligence";
import type { DeerProfileSummary } from "@/lib/deerProfiles";
import type { DeerTravelIntelligence } from "@/lib/deerTravelIntelligence";

type DeerProfileCardProps = {
  summary: DeerProfileSummary;
  intelligence: DeerProfileIntelligence;
  travel: DeerTravelIntelligence;
};

export default function DeerProfileCard({
  summary,
  intelligence,
  travel,
}: DeerProfileCardProps) {
  return (
    <Card as="article" variant="subtle" style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Deer Profile</p>
          <h3 style={titleStyle}>{summary.profile.nickname}</h3>
        </div>
        <Badge>{summary.profile.estimatedAge || "Age unknown"}</Badge>
      </div>

      <div style={detailsGridStyle}>
        <ProfileDetail label="First Seen" value={summary.firstSeen} />
        <ProfileDetail label="Last Seen" value={summary.lastSeen} />
        <ProfileDetail label="Photos" value={String(summary.photoCount)} />
        <ProfileDetail label="Sightings" value={String(summary.sightingCount)} />
      </div>

      {summary.profile.notes ? (
        <div style={notesStyle}>
          <ProfileDetail label="Notes" value={summary.profile.notes} />
        </div>
      ) : null}

      <div style={intelligenceWrapStyle}>
        <CollapsibleSection
          title="Intelligence"
          description="Patterns from linked photos and notes"
          defaultOpen={intelligence.hasSightings}
          variant="bare"
        >
          <DeerProfileIntelligencePanel intelligence={intelligence} />
        </CollapsibleSection>
      </div>

      <div style={intelligenceWrapStyle}>
        <CollapsibleSection
          title="Travel"
          description="How this deer moves, learned from your photos"
          defaultOpen={travel.hasData}
          variant="bare"
        >
          <DeerTravelPanel travel={travel} />
        </CollapsibleSection>
      </div>
    </Card>
  );
}

function DeerTravelPanel({ travel }: { travel: DeerTravelIntelligence }) {
  return (
    <div style={intelligenceStackStyle}>
      {!travel.hasData ? (
        <EmptyState
          title="No travel data yet"
          description="Set each camera site's facing direction, then import photos of this buck — the AI reads which way he's moving and the winds he moves on."
        />
      ) : null}

      <div style={detailsGridStyle}>
        <ProfileDetail
          label="Direction of Travel"
          value={`${travel.heading.title}. ${travel.heading.detail}`}
        />
        <ProfileDetail
          label="Winds He Moves On"
          value={`${travel.wind.title}. ${travel.wind.detail}`}
        />
        <ProfileDetail
          label="When He Moves"
          value={`${travel.timeOfDay.title}. ${travel.timeOfDay.detail}`}
        />
        <ProfileDetail
          label="Route"
          value={`${travel.route.title}. ${travel.route.detail}`}
        />
      </div>

      {travel.legs.length > 0 ? (
        <div style={notesMentionWrapStyle}>
          <p style={detailLabelStyle}>Camera-to-Camera Moves</p>
          <div style={notesMentionListStyle}>
            {travel.legs.slice(0, 6).map((leg) => (
              <div key={leg.key} style={noteMentionStyle}>
                <p style={mentionSourceStyle}>{leg.label}</p>
                <p style={detailValueStyle}>{leg.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DeerProfileIntelligencePanel({
  intelligence,
}: {
  intelligence: DeerProfileIntelligence;
}) {
  return (
    <div style={intelligenceStackStyle}>
      {!intelligence.hasSightings ? (
        <EmptyState
          title="No sightings yet"
          description="Link photo records or add first seen and last seen dates to start this deer's history."
        />
      ) : null}

      {!intelligence.hasLinkedPhotoRecords ? (
        <EmptyState
          title="No photo records linked yet"
          description="Add photo records to a camera check, then link them to this deer profile."
        />
      ) : null}

      {!intelligence.hasPatternData ? (
        <EmptyState
          title="No pattern data yet"
          description="More linked photos, camera sites, and notes will help Deer Intel find useful patterns."
        />
      ) : null}

      <div style={detailsGridStyle}>
        <ProfileDetail
          label="Most Recent Sighting"
          value={`${intelligence.mostRecentSighting.title}. ${intelligence.mostRecentSighting.detail}`}
        />
        <ProfileDetail
          label="Camera Sites"
          value={
            intelligence.associatedCameraSites.length > 0
              ? intelligence.associatedCameraSites.join(", ")
              : "None linked yet"
          }
        />
        <ProfileDetail
          label="Properties"
          value={
            intelligence.associatedProperties.length > 0
              ? intelligence.associatedProperties.join(", ")
              : "Not set"
          }
        />
        <ProfileDetail
          label="Common Time"
          value={`${intelligence.commonTimeOfDay.title}. ${intelligence.commonTimeOfDay.detail}`}
        />
        <ProfileDetail
          label="Common Area"
          value={`${intelligence.commonArea.title}. ${intelligence.commonArea.detail}`}
        />
        <ProfileDetail
          label="Maturity / Status"
          value={`${intelligence.maturityStatus.title}. ${intelligence.maturityStatus.detail}`}
        />
      </div>

      {intelligence.notesMentioningDeer.length > 0 ? (
        <div style={notesMentionWrapStyle}>
          <p style={detailLabelStyle}>Notes Mentioning This Deer</p>
          <div style={notesMentionListStyle}>
            {intelligence.notesMentioningDeer.map((mention) => (
              <div
                key={`${mention.source}-${mention.detail}`}
                style={noteMentionStyle}
              >
                <p style={mentionSourceStyle}>{mention.source}</p>
                <p style={detailValueStyle}>{mention.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value || "Not set"}</p>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--surface-2)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.25rem",
  lineHeight: 1.25,
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const notesStyle: CSSProperties = {
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const intelligenceWrapStyle: CSSProperties = {
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const intelligenceStackStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const notesMentionWrapStyle: CSSProperties = {
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const notesMentionListStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
  marginTop: "0.65rem",
};

const noteMentionStyle: CSSProperties = {
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
};

const mentionSourceStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.76rem",
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};
