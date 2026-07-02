"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import StandCard from "@/components/stands/StandCard";
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

export default function StandsPage() {
  const state = useDeerIntelStore();
  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const selectedPropertyId = selectedProperty?.id ?? "";
  const propertyStands = state.stands.filter(
    (stand) => stand.propertyId === selectedPropertyId,
  );
  const propertyHunts = state.hunts.filter(
    (hunt) => hunt.propertyId === selectedPropertyId,
  );
  const huntedStandIds = new Set(
    propertyHunts.map((hunt) => hunt.standId).filter(Boolean),
  );
  const huntedStandCount = propertyStands.filter((stand) =>
    huntedStandIds.has(stand.id),
  ).length;
  const standsWithWindNotes = propertyStands.filter(
    (stand) => stand.bestWinds.trim() || stand.avoidWinds.trim(),
  ).length;

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
          eyebrow="Stand Sites"
          title="Stands"
          description="Review stand sites by property, check wind notes, and jump into stand workspaces or hunt logging."
          meta={
            <>
              <Badge variant="success">Property Based</Badge>
              <Badge>{propertyStands.length} shown</Badge>
            </>
          }
          action={
            selectedProperty ? (
              <Link
                href={`/properties/${selectedProperty.id}#stand-sites`}
                style={primaryLinkStyle}
              >
                Add Stand
              </Link>
            ) : null
          }
        />
      </Card>

      <Section eyebrow="Property" title="Active Property">
        {state.properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            description="Add a property before saving stand sites."
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

      <Section eyebrow="Stand Summary" title="What This Property Shows">
        <div style={statGridStyle}>
          <StatCard
            label="Stand Sites"
            value={propertyStands.length}
            detail="Saved stand locations"
          />
          <StatCard
            label="Hunted Stands"
            value={huntedStandCount}
            detail={`${propertyHunts.length} hunts logged`}
          />
          <StatCard
            label="Wind Notes"
            value={standsWithWindNotes}
            detail="Stands with wind guidance"
          />
        </div>
      </Section>

      <Section eyebrow="Next Steps" title="Quick Actions">
        <div style={actionGridStyle}>
          <ActionCard
            href={selectedProperty ? `/properties/${selectedProperty.id}` : "/properties"}
            title="Open Property"
            description="Use the property command center to add stands and review relationships."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/hunt-log"
            title="Log Hunt"
            description="Save hunt history tied to a property and stand."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/map"
            title="Open Map"
            description="Review stand pins, camera sites, trails, and other property assets."
          />
        </div>
      </Section>

      <Section eyebrow="Saved Stand Sites" title="Stand List">
        {propertyStands.length === 0 ? (
          <EmptyState
            title="No stands for this property"
            description="Open the property command center and add stand type, wind notes, access, exit, and notes."
            action={
              <Link
                href={
                  selectedProperty
                    ? `/properties/${selectedProperty.id}#stand-sites`
                    : "/properties"
                }
                style={primaryLinkStyle}
              >
                Add Stand
              </Link>
            }
          />
        ) : (
          <div style={listStyle}>
            {propertyStands.map((stand) => (
              <StandCard key={stand.id} stand={stand} />
            ))}
          </div>
        )}
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

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "1rem",
};

const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
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
