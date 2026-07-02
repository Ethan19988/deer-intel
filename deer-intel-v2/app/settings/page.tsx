"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import ActionCard from "@/components/ui/ActionCard";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import { useDeerIntelStore } from "@/lib/deerIntelStore";

export default function SettingsPage() {
  const state = useDeerIntelStore();
  const totalRecords =
    state.properties.length +
    state.cameras.length +
    state.cameraChecks.length +
    state.stands.length +
    state.pins.length +
    state.hunts.length +
    state.photoRecords.length +
    state.deerProfiles.length;
  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];

  return (
    <PageShell>
      <Card as="section" variant="elevated" style={heroCardStyle}>
        <PageHeader
          eyebrow="Settings"
          title="Deer Intel Settings"
          description="Review how Deer Intel is storing data right now and jump to the sections that help keep the app organized."
          meta={
            <>
              <Badge variant="success">Local Persistence</Badge>
              <Badge>{totalRecords} saved records</Badge>
            </>
          }
        />
      </Card>

      <Section eyebrow="Storage" title="Current Data Setup">
        <div style={settingsGridStyle}>
          <Card as="article" variant="subtle">
            <p style={eyebrowStyle}>Storage Mode</p>
            <h2 style={cardTitleStyle}>This Browser</h2>
            <p style={mutedTextStyle}>
              Deer Intel is currently saved in local browser storage. No account,
              database, or cloud sync is connected yet.
            </p>
          </Card>
          <Card as="article" variant="subtle">
            <p style={eyebrowStyle}>Active Property</p>
            <h2 style={cardTitleStyle}>{selectedProperty?.name ?? "None yet"}</h2>
            <p style={mutedTextStyle}>
              The active property controls map assets, camera views, stand lists,
              and intelligence summaries.
            </p>
          </Card>
        </div>
      </Section>

      <Section eyebrow="Saved Data" title="Local Record Counts">
        <div style={statGridStyle}>
          <StatCard
            label="Properties"
            value={state.properties.length}
            detail="Hunting properties"
          />
          <StatCard
            label="Camera Sites"
            value={state.cameras.length}
            detail={`${state.cameraChecks.length} checks saved`}
          />
          <StatCard
            label="Stands"
            value={state.stands.length}
            detail="Stand workspaces"
          />
          <StatCard
            label="Hunts"
            value={state.hunts.length}
            detail="Hunt log entries"
          />
          <StatCard
            label="Photo Records"
            value={state.photoRecords.length}
            detail="Camera history"
          />
          <StatCard
            label="Deer Profiles"
            value={state.deerProfiles.length}
            detail="Tracked deer"
          />
        </div>
      </Section>

      <Section eyebrow="Navigation" title="Keep Building Your Data">
        <div style={actionGridStyle}>
          <ActionCard
            href="/properties"
            title="Properties"
            description="Add or open a property command center."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/cameras"
            title="Cameras"
            description="Review camera sites for the active property."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/stands"
            title="Stands"
            description="Review stand sites and wind notes."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/hunt-log"
            title="Hunt Log"
            description="Add field history tied to properties and stands."
          />
          <ActionCard
            href="/ai"
            title="Intelligence"
            description="Review local recommendations and property patterns."
          />
          <ActionCard
            href="/map"
            title="Map"
            description="Open the property map and saved assets."
          />
        </div>
      </Section>

      <Section eyebrow="Future Settings" title="Not Connected Yet">
        <Card as="div" variant="subtle">
          <p style={mutedTextStyle}>
            Accounts, cloud sync, database backup, real AI calls, paid map
            layers, and export/import tools are intentionally not connected yet.
            This keeps the current Deer Intel foundation simple and reliable.
          </p>
          <Link href="/" style={primaryLinkStyle}>
            Back to Dashboard
          </Link>
        </Card>
      </Section>
    </PageShell>
  );
}

const heroCardStyle: CSSProperties = {
  padding: "1.5rem",
};

const settingsGridStyle: CSSProperties = {
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
  lineHeight: 1.6,
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
