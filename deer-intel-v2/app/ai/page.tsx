"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import PropertyIntelligenceSummary from "@/components/properties/dashboard/PropertyIntelligenceSummary";
import ActionCard from "@/components/ui/ActionCard";
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
import { getHuntPlannerSummary } from "@/lib/huntPlanner";
import { getPropertyIntelligenceCards } from "@/lib/propertyIntelligence";

export default function AIPage() {
  const state = useDeerIntelStore();
  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const selectedPropertyId = selectedProperty?.id ?? "";
  const cameras = state.cameras.filter(
    (camera) => camera.propertyId === selectedPropertyId,
  );
  const cameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === selectedPropertyId,
  );
  const stands = state.stands.filter(
    (stand) => stand.propertyId === selectedPropertyId,
  );
  const hunts = state.hunts.filter((hunt) => hunt.propertyId === selectedPropertyId);
  const photoRecords = state.photoRecords.filter(
    (photo) => photo.propertyId === selectedPropertyId,
  );
  const pins = state.pins.filter((pin) => pin.propertyId === selectedPropertyId);
  const planner = getHuntPlannerSummary(state);
  const cards = selectedProperty
    ? getPropertyIntelligenceCards({
        cameras,
        cameraChecks,
        hunts,
        photoRecords,
        pins,
        stands,
      })
    : [];

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
          eyebrow="Intelligence"
          title="AI Scout"
          description="A simple intelligence overview powered by your saved Deer Intel data. Real AI recommendations can come later; this page stays useful today without accounts or paid APIs."
          meta={
            <>
              <Badge variant="warning">No AI Calls Yet</Badge>
              <Badge variant="success">Uses Local Data</Badge>
            </>
          }
        />
      </Card>

      <Section eyebrow="Property" title="Intelligence Scope">
        {state.properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            description="Add a property before building intelligence summaries."
            action={
              <Link href="/properties" style={primaryLinkStyle}>
                Add Property
              </Link>
            }
          />
        ) : (
          <Card as="div" variant="subtle">
            <label style={fieldStyle}>
              <span style={labelStyle}>Choose Property</span>
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

      <Section eyebrow="Hunt Planner" title="Simple Recommendation">
        <div style={plannerGridStyle}>
          <Card as="article" variant="subtle">
            <p style={eyebrowStyle}>Recommended Property</p>
            <h2 style={cardTitleStyle}>
              {planner.recommendedProperty.property?.name ?? "No property yet"}
            </h2>
            <p style={mutedTextStyle}>{planner.recommendedProperty.reason}</p>
            <div style={badgeRowStyle}>
              <Badge>{planner.recommendedProperty.scoreLabel}</Badge>
            </div>
          </Card>
          <Card as="article" variant="subtle">
            <p style={eyebrowStyle}>Last Hunt</p>
            <h2 style={cardTitleStyle}>{planner.lastHunt.propertyName}</h2>
            <p style={mutedTextStyle}>{planner.lastHunt.detail}</p>
            <div style={badgeRowStyle}>
              <Badge>{planner.lastHunt.hunt ? "Saved Hunt" : "No Hunts"}</Badge>
            </div>
          </Card>
        </div>
      </Section>

      <Section eyebrow="Data Readiness" title="What Deer Intel Knows">
        <div style={statGridStyle}>
          <StatCard label="Camera Sites" value={cameras.length} detail="Property cameras" />
          <StatCard label="Stands" value={stands.length} detail="Stand options" />
          <StatCard label="Hunts" value={hunts.length} detail="Field history" />
          <StatCard
            label="Photo Records"
            value={photoRecords.length}
            detail="Camera photo history"
          />
        </div>
      </Section>

      <Section eyebrow="Property Intelligence" title="Current Patterns">
        {selectedProperty ? (
          <PropertyIntelligenceSummary cards={cards} />
        ) : (
          <EmptyState description="Choose or add a property to see intelligence cards." />
        )}
      </Section>

      <Section eyebrow="Next Steps" title="Improve Recommendations">
        <div style={actionGridStyle}>
          <ActionCard
            href={selectedProperty ? `/properties/${selectedProperty.id}` : "/properties"}
            title="Open Property"
            description="Add cameras, stands, deer profiles, and notes for this property."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/hunt-log"
            title="Log Hunt"
            description="Hunt history is the strongest signal for future recommendations."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/map"
            title="Open Map"
            description="Map assets help connect bedding, food, water, sign, stands, and cameras."
          />
        </div>
      </Section>
    </PageShell>
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

const plannerGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "1rem",
};

const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
  margin: "0.5rem 0 0",
  fontSize: "1.4rem",
  lineHeight: 1.2,
};

const mutedTextStyle: CSSProperties = {
  margin: "0.65rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.55,
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  marginTop: "1rem",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.7rem 0.9rem",
  border: "1px solid #3b6843",
  borderRadius: "8px",
  background: "#18351d",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};
