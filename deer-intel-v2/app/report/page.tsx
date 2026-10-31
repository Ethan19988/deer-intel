"use client";

import { type CSSProperties } from "react";
import SeasonReportPanel from "@/components/insights/SeasonReportPanel";
import EmptyState from "@/components/ui/EmptyState";
import { ClipboardIcon } from "@/components/ui/FieldIcons";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import { useDeerIntelStore } from "@/lib/deerIntelStore";

// Season report: one printable page per property for a PA deer season
// (Sep 1 – Jan 31). Defaults to the selected property; pick another or print
// every property at once.
export default function SeasonReportPage() {
  const state = useDeerIntelStore();
  const selected =
    state.properties.find((property) => property.id === state.selectedPropertyId) ??
    state.properties[0];

  return (
    <PageShell maxWidth="900px">
      <div className="di-report-hide-print" style={headerWrapStyle}>
        <PageHeader
          eyebrow="Plan the hunt"
          title="Season Report"
          description="Your season on one page: sits, deer, best stands, winds and times, tracked bucks, and what to change next year."
          icon={<ClipboardIcon size={20} />}
        />
      </div>
      {selected ? (
        <SeasonReportPanel propertyId={selected.id} allowPropertyPick />
      ) : (
        <EmptyState
          illustration={<ClipboardIcon size={22} />}
          title="No properties yet"
          description="Add a property and log a few sits — the season report builds itself from your hunt log and cameras."
        />
      )}
    </PageShell>
  );
}

const headerWrapStyle: CSSProperties = {
  marginBottom: "1rem",
};
