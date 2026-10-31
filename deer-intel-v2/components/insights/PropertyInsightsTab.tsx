"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import PropertyStandTable from "@/components/insights/PropertyStandTable";
import SightingHeatPanel from "@/components/insights/SightingHeatPanel";
import DashboardSection from "@/components/properties/DashboardSection";
import EmptyState from "@/components/ui/EmptyState";
import { MapIcon, StandIcon } from "@/components/ui/FieldIcons";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import type { HeatInput } from "@/lib/sightingHeat";
import { buildPropertyStandStats } from "@/lib/standStats";
import { usePropertyStatsContext } from "@/lib/useInsightStats";

// The property's Insights tab: stand success rates (the full table) and the
// sighting heat map. Reads the store directly so the property page only has to
// drop it in.
export default function PropertyInsightsTab({ propertyId }: { propertyId: string }) {
  const state = useDeerIntelStore();
  const ctx = usePropertyStatsContext(propertyId);

  const input = useMemo<HeatInput>(() => {
    const own = <T extends { propertyId: string }>(items: T[]) =>
      items.filter((item) => item.propertyId === propertyId);
    return {
      stands: own(state.stands),
      pins: own(state.pins),
      hunts: own(state.hunts),
      cameras: own(state.cameras),
      cameraChecks: own(state.cameraChecks),
      photos: own(state.photoRecords),
    };
  }, [propertyId, state]);

  const standStats = useMemo(
    () => buildPropertyStandStats(input.stands, input.hunts, ctx),
    [input, ctx],
  );

  return (
    <div style={stackStyle}>
      <DashboardSection
        id="stand-success"
        eyebrow="Stand success"
        title="What Each Stand Produces"
        icon={<StandIcon size={18} />}
      >
        {standStats.property.overall.sits === 0 ? (
          <EmptyState
            title="No sits logged yet"
            description="Success rates by stand, wind, time of day and rut phase fill in from your hunt log."
          />
        ) : (
          <PropertyStandTable stats={standStats} />
        )}
      </DashboardSection>

      <DashboardSection
        id="sighting-heat"
        eyebrow="Sighting heat"
        title="Where Deer Actually Showed"
        icon={<MapIcon size={18} />}
      >
        <SightingHeatPanel input={input} ctx={ctx} />
      </DashboardSection>

      <p style={footStyle}>
        Full season summary, tracked bucks and next-year notes are on the{" "}
        <Link href="/report" style={linkStyle}>
          Season Report
        </Link>
        .
      </p>
    </div>
  );
}

const stackStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "1.5rem",
};

const footStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.88rem",
};

const linkStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontWeight: 700,
};
