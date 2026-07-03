"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import {
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  getDeerIntelligenceHubSummary,
  type DeerHubItem,
} from "@/lib/deerIntelligenceHub";

export default function AIPage() {
  const state = useDeerIntelStore();
  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const selectedPropertyId = selectedProperty?.id ?? "";
  const propertyCameras = state.cameras.filter(
    (camera) => camera.propertyId === selectedPropertyId,
  );
  const propertyCameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === selectedPropertyId,
  );
  const propertyStands = state.stands.filter(
    (stand) => stand.propertyId === selectedPropertyId,
  );
  const propertyHunts = state.hunts.filter(
    (hunt) => hunt.propertyId === selectedPropertyId,
  );
  const propertyPhotoRecords = state.photoRecords.filter(
    (photo) => photo.propertyId === selectedPropertyId,
  );
  const propertyDeerProfiles = state.deerProfiles.filter(
    (profile) => profile.propertyId === selectedPropertyId,
  );
  const propertyPins = state.pins.filter(
    (pin) => pin.propertyId === selectedPropertyId,
  );
  const hub = selectedProperty
    ? getDeerIntelligenceHubSummary({
        property: selectedProperty,
        cameras: propertyCameras,
        cameraChecks: propertyCameraChecks,
        stands: propertyStands,
        hunts: propertyHunts,
        photoRecords: propertyPhotoRecords,
        deerProfiles: propertyDeerProfiles,
        pins: propertyPins,
      })
    : null;

  function selectProperty(propertyId: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: propertyId,
    }));
  }

  return (
    <PageShell>
      <Card as="section" variant="elevated" style={heroCardStyle}>
        <PageHeader
          eyebrow="Deer Intelligence"
          title="Deer Intelligence Hub"
          description="A simple readout for what matters right now on one property. No charts, no AI calls, just plain hunting information from your saved Deer Intel data."
          meta={
            <>
              <Badge variant="success">Rule Based</Badge>
              <Badge>No AI Calls Yet</Badge>
            </>
          }
        />
      </Card>

      <Section eyebrow="Property" title="Choose Property">
        {state.properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            description="Add a property before Deer Intel can build an intelligence hub."
            action={
              <Link href="/properties" style={primaryLinkStyle}>
                Add Property
              </Link>
            }
          />
        ) : (
          <Card as="div" variant="subtle">
            <label style={fieldStyle}>
              <span style={labelStyle}>Property</span>
              <select
                style={selectStyle}
                value={selectedPropertyId}
                onChange={(event) => selectProperty(event.target.value)}
              >
                {state.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
          </Card>
        )}
      </Section>

      {hub && selectedProperty ? (
        <>
          <Section eyebrow="1" title="What's Happening">
            <Card as="div" variant="subtle">
              <ul style={bulletListStyle}>
                {hub.whatsHappening.map((insight) => (
                  <li key={insight} style={bulletItemStyle}>
                    {insight}
                  </li>
                ))}
              </ul>
            </Card>
          </Section>

          <Section eyebrow="2" title="Best Stand">
            <Card as="article" variant="subtle">
              <div style={simpleHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Recommended Stand</p>
                  <h2 style={cardTitleStyle}>{hub.bestStand.name}</h2>
                </div>
                <Badge variant={hub.bestStand.href ? "success" : "warning"}>
                  One Pick
                </Badge>
              </div>
              <p style={mutedTextStyle}>{hub.bestStand.reason}</p>
              {hub.bestStand.href ? (
                <Link href={hub.bestStand.href} style={primaryLinkStyle}>
                  Open Stand
                </Link>
              ) : null}
            </Card>
          </Section>

          <Section eyebrow="3" title="Recent Buck Activity">
            <Card as="article" variant="subtle">
              <div style={simpleHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Latest Mature Buck</p>
                  <h2 style={cardTitleStyle}>{hub.recentBuckActivity.title}</h2>
                </div>
                <Badge>{hub.recentBuckActivity.date}</Badge>
              </div>
              <div style={detailGridStyle}>
                <HubDetail label="Camera" value={hub.recentBuckActivity.camera} />
                <HubDetail
                  label="Property"
                  value={hub.recentBuckActivity.property}
                />
                <HubDetail label="Date" value={hub.recentBuckActivity.date} />
                <HubDetail label="Time" value={hub.recentBuckActivity.time} />
              </div>
              <p style={mutedTextStyle}>{hub.recentBuckActivity.detail}</p>
              {hub.recentBuckActivity.href ? (
                <Link href={hub.recentBuckActivity.href} style={primaryLinkStyle}>
                  Open Camera
                </Link>
              ) : null}
            </Card>
          </Section>

          <Section eyebrow="4" title="Needs Attention">
            {hub.needsAttention.length === 0 ? (
              <EmptyState description="Nothing urgent stands out right now." />
            ) : (
              <div style={attentionGridStyle}>
                {hub.needsAttention.map((item) => (
                  <AttentionCard key={`${item.title}-${item.detail}`} item={item} />
                ))}
              </div>
            )}
          </Section>

          <Section eyebrow="5" title="Property Snapshot">
            <div style={snapshotGridStyle}>
              <StatCard
                label="Cameras"
                value={hub.snapshot.cameras}
                detail="Camera sites"
              />
              <StatCard
                label="Stands"
                value={hub.snapshot.stands}
                detail="Stand sites"
              />
              <StatCard
                label="Deer Profiles"
                value={hub.snapshot.deerProfiles}
                detail="Tracked deer"
              />
              <StatCard
                label="Hunts"
                value={hub.snapshot.hunts}
                detail="Hunt log entries"
              />
              <StatCard
                label="Photos"
                value={hub.snapshot.photos}
                detail="Photo records"
              />
            </div>
          </Section>

          <div style={footerActionStyle}>
            <Link href={`/properties/${selectedProperty.id}`} style={primaryLinkStyle}>
              Open Property Command Center
            </Link>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}

function AttentionCard({ item }: { item: DeerHubItem }) {
  const content = (
    <>
      <h3 style={attentionTitleStyle}>{item.title}</h3>
      <p style={mutedTextStyle}>{item.detail}</p>
    </>
  );

  if (!item.href) {
    return (
      <Card as="article" variant="subtle">
        {content}
      </Card>
    );
  }

  return (
    <Link href={item.href} style={attentionLinkStyle}>
      {content}
    </Link>
  );
}

function HubDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value}</p>
    </div>
  );
}

const heroCardStyle: CSSProperties = {
  padding: "1.5rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const labelStyle: CSSProperties = {
  color: "#85a984",
  fontSize: "0.85rem",
  fontWeight: 800,
};

const selectStyle: CSSProperties = {
  minHeight: "48px",
  width: "100%",
  padding: "0.75rem",
  border: "1px solid #2b3a2b",
  borderRadius: "8px",
  background: "#070a07",
  color: "white",
};

const bulletListStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  margin: 0,
  paddingLeft: "1.25rem",
};

const bulletItemStyle: CSSProperties = {
  color: "#f1f5ef",
  fontSize: "1.04rem",
  lineHeight: 1.55,
};

const simpleHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
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
  margin: "0.25rem 0 0",
  color: "#f1f5ef",
  fontSize: "1.55rem",
  lineHeight: 1.2,
};

const mutedTextStyle: CSSProperties = {
  margin: "0.7rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.55,
};

const detailGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid #1e2a1e",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "#879486",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#f1f5ef",
  lineHeight: 1.45,
};

const attentionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const attentionTitleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "1.08rem",
  lineHeight: 1.25,
};

const attentionLinkStyle: CSSProperties = {
  display: "block",
  padding: "1.15rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
  color: "white",
  textDecoration: "none",
};

const snapshotGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "1rem",
};

const footerActionStyle: CSSProperties = {
  marginTop: "1.75rem",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  marginTop: "1rem",
  padding: "0.7rem 0.9rem",
  border: "1px solid #3b6843",
  borderRadius: "8px",
  background: "#18351d",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};
