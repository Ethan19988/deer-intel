"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import HuntPlannerIntelligencePanel from "@/components/hunts/HuntPlannerIntelligencePanel";
import DashboardSection from "@/components/properties/DashboardSection";
import InfoCard from "@/components/properties/dashboard/InfoCard";
import PropertyDocumentsSection from "@/components/properties/dashboard/PropertyDocumentsSection";
import PropertyIntelligenceSummary from "@/components/properties/dashboard/PropertyIntelligenceSummary";
import PropertyTimeline from "@/components/properties/dashboard/PropertyTimeline";
import RecentActivityList from "@/components/properties/dashboard/RecentActivityList";
import WalkTracksSection from "@/components/properties/dashboard/WalkTracksSection";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import {
  TargetIcon,
} from "@/components/ui/FieldIcons";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import ColdFrontBanner from "@/components/ColdFrontBanner";
import TodayVerdictHero from "@/components/TodayVerdictHero";
import { usePropertyToday } from "@/lib/usePropertyToday";
import Tabs from "@/components/ui/Tabs";
import PropertyPatternReport from "@/components/properties/PropertyPatternReport";
import PropertyInsightsTab from "@/components/insights/PropertyInsightsTab";
import SeasonReportPanel from "@/components/insights/SeasonReportPanel";
import { buildPropertyPatternReport } from "@/lib/propertyPatterns";
import {
  activeCameraCount,
  getRecentActivity,
} from "@/lib/propertyDashboard";
import { getPropertyTimelineEvents } from "@/lib/propertyTimeline";
import { getPropertyIntelligenceCards } from "@/lib/propertyIntelligence";
import { getHuntPlannerIntelligence } from "@/lib/huntPlannerIntelligence";
import { getPropertyWeatherSummary } from "@/lib/weather";
import { updateDeerIntelStore, useDeerIntelStore } from "@/lib/deerIntelStore";
import { dateInputTime } from "@/lib/photos";
import { formatDayWithAgo } from "@/lib/relativeDate";

export default function PropertyWorkspacePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const state = useDeerIntelStore();
  const property = state.properties.find((item) => item.id === params.id);
  const propertyCameras = state.cameras.filter(
    (camera) => camera.propertyId === params.id,
  );
  const propertyStands = state.stands.filter(
    (stand) => stand.propertyId === params.id,
  );
  const propertyPins = state.pins.filter((pin) => pin.propertyId === params.id);
  const propertyHunts = state.hunts.filter(
    (hunt) => hunt.propertyId === params.id,
  );
  const propertyCameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === params.id,
  );
  const propertyPhotoRecords = state.photoRecords.filter(
    (photo) => photo.propertyId === params.id,
  );
  const patternReport = buildPropertyPatternReport(
    propertyHunts,
    propertyCameraChecks,
    propertyCameras,
    propertyPhotoRecords,
  );
  const propertyDeerProfiles = state.deerProfiles.filter(
    (profile) => profile.propertyId === params.id,
  );
  const propertyWalkTracks = state.walkTracks.filter(
    (track) => track.propertyId === params.id,
  );
  const propertyDocuments = state.documents.filter(
    (document) => document.propertyId === params.id,
  );
  // Tonight on this ground: same forecast, verdict and hit list as Today.
  const today = usePropertyToday(params.id);
  // ?tab=plan / insights / report opens that tab directly.
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab === "plan" || tab === "insights" || tab === "report" ? tab : "overview";
  });

  useEffect(() => {
    const hash =
      typeof window !== "undefined"
        ? window.location.hash.replace("#", "")
        : "";
    const hashTab: Record<string, string> = {
      "property-timeline": "plan",
      "hunt-planner": "plan",
      intelligence: "plan",
      "stand-success": "insights",
      "sighting-heat": "insights",
      "season-report": "report",
      map: "overview",
      "recent-activity": "overview",
      overview: "overview",
      "saved-walks": "overview",
      documents: "overview",
    };

    if (hash && hashTab[hash]) setActiveTab(hashTab[hash]);
  }, []);

  useEffect(() => {
    if (!property || state.selectedPropertyId === property.id) return;

    updateDeerIntelStore((currentState) =>
      currentState.selectedPropertyId === property.id
        ? currentState
        : {
            ...currentState,
            selectedPropertyId: property.id,
          },
    );
  }, [property, state.selectedPropertyId]);

  if (!property) {
    return (
      <PageShell maxWidth="680px">
        <Card as="section" variant="elevated" style={notFoundCardStyle}>
          <p style={eyebrowStyle}>Property Intelligence</p>
          <h1 style={pageTitleStyle}>Property not found</h1>
          <p style={mutedTextStyle}>
            This property may have been deleted or is not saved in this browser
            yet.
          </p>
          <Link href="/properties" style={primaryLinkStyle} className="di-navbtn">
            Back to Properties
          </Link>
        </Card>
      </PageShell>
    );
  }

  const propertyId = property.id;
  const standCount = propertyStands.length;
  const deerProfileCount = propertyDeerProfiles.length;
  const recentActivity = getRecentActivity({
    pins: propertyPins,
    hunts: propertyHunts,
  });
  const timelineEvents = getPropertyTimelineEvents({
    state,
    propertyId,
  });
  const weatherSummary = getPropertyWeatherSummary({
    hunts: propertyHunts,
    cameraChecks: propertyCameraChecks,
  });
  const intelligenceCards = getPropertyIntelligenceCards({
    cameras: propertyCameras,
    cameraChecks: propertyCameraChecks,
    hunts: propertyHunts,
    photoRecords: propertyPhotoRecords,
    pins: propertyPins,
    stands: propertyStands,
  });
  const huntPlannerIntelligence = getHuntPlannerIntelligence({
    property,
    stands: propertyStands,
    cameras: propertyCameras,
    cameraChecks: propertyCameraChecks,
    deerProfiles: propertyDeerProfiles,
    hunts: propertyHunts,
    photoRecords: propertyPhotoRecords,
    pins: propertyPins,
  });
  const latestHunt = getLatestByDate(propertyHunts, (hunt) => hunt.date);
  const latestCameraCheck = getLatestByDate(
    propertyCameraChecks,
    (check) => check.date,
  );

  const headerEyebrow =
    [property.county, property.acres ? `${property.acres} acres` : ""]
      .filter(Boolean)
      .join(" · ") || "Property";

  // Today shows whichever property is selected, so pin it to this one first.
  function selectThisProperty() {
    updateDeerIntelStore((currentState) =>
      currentState.selectedPropertyId === propertyId
        ? currentState
        : { ...currentState, selectedPropertyId: propertyId },
    );
  }

  // The "Saved walks" count opens the collapsible below instead of the map.
  function openSavedWalks() {
    const section = document.getElementById("saved-walks");
    if (!(section instanceof HTMLDetailsElement)) return;

    section.open = true;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteWalkTrack(trackId: string) {
    if (!window.confirm("Delete this saved walk?")) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      walkTracks: currentState.walkTracks.filter(
        (track) => track.id !== trackId,
      ),
    }));
  }

  return (
    <PageShell>
      <Link href="/properties" style={backTextLinkStyle}>
        ‹ Properties
      </Link>

      <PageHeader
        eyebrow={headerEyebrow}
        title={property.name}
        description={property.notes || undefined}
        action={
          <>
            <Link href="/ai" className="di-link-btn">
              AI Scout
            </Link>
            <Link href="/map" className="di-link-btn">
              Map
            </Link>
            <Link
              href={`/hunt-log?propertyId=${encodeURIComponent(propertyId)}`}
              className="di-link-btn di-link-btn--primary"
            >
              Log sit
            </Link>
          </>
        }
      />

      <Tabs
        activeId={activeTab}
        onChange={setActiveTab}
        items={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <div style={tabPanelStyle}>
      <ColdFrontBanner
        propertyName={property.name}
        pressure={today.forecast?.pressure}
      />

      {/* The sit call only; wind fit, conditions, hit list and rut phase
          live on Today so they aren't repeated here. */}
      <TodayVerdictHero
        verdict={today.verdict}
        propertyName={property.name}
        photo={today.heroPhoto}
        forecastAsOf={today.forecastAsOf}
      />

      <Link href="/" onClick={selectThisProperty} style={todayLinkStyle}>
        Full conditions on Today ›
      </Link>

      <nav aria-label="On this property" style={shortcutGridStyle}>
        {[
          {
            href: "/cameras",
            label: `Cameras · ${activeCameraCount(propertyCameras)} active`,
            count: propertyCameras.length,
          },
          { href: "/stands", label: "Stands", count: standCount },
          { href: "/hit-list", label: "Hit List", count: deerProfileCount },
          { href: "/hunt-log", label: "Sits logged", count: propertyHunts.length },
          { href: "/map", label: "Map pins", count: propertyPins.length },
        ].map((item) => (
          <Link key={item.label} href={item.href} style={shortcutStyle}>
            <span style={shortcutCountStyle}>{item.count}</span>
            <span style={shortcutLabelStyle}>{item.label}</span>
          </Link>
        ))}
        <a
          href="#saved-walks"
          onClick={(event) => {
            event.preventDefault();
            openSavedWalks();
          }}
          style={shortcutStyle}
        >
          <span style={shortcutCountStyle}>{propertyWalkTracks.length}</span>
          <span style={shortcutLabelStyle}>Saved walks</span>
        </a>
      </nav>

      <div style={detailDropdownStackStyle}>
        <CollapsibleSection
          title="Recent Activity"
          description="Pins, hunts and checks saved on this property"
        >
          <RecentActivityList activities={recentActivity} />
        </CollapsibleSection>

        <CollapsibleSection
          id="saved-walks"
          title="Saved Walks"
          description="Trails you've recorded on this property"
          style={anchorOffsetStyle}
        >
          <WalkTracksSection
            tracks={propertyWalkTracks}
            onDelete={deleteWalkTrack}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="What Produces Deer Here"
          description="Patterns from your logged hunts and sightings"
        >
          <PropertyPatternReport report={patternReport} />
        </CollapsibleSection>

        <CollapsibleSection
          id="documents"
          title="Documents"
          description={
            propertyDocuments.length > 0
              ? `${propertyDocuments.length} saved on this device`
              : "Leases, maps and permits for this property"
          }
        >
          <PropertyDocumentsSection documents={propertyDocuments} />
        </CollapsibleSection>
      </div>
              </div>
            ),
          },
          {
            id: "plan",
            label: "Plan",
            content: (
              <div style={tabPanelStyle}>
      <DashboardSection
        id="hunt-planner"
        eyebrow="Hunt Planner"
        title="Property Hunt Plan"
        icon={<TargetIcon size={18} />}
      >
        <div style={cardGridStyle}>
          <InfoCard
            title="Weather"
            value={weatherSummary.value}
            description={weatherCardDescription(weatherSummary)}
          />
          <InfoCard
            title="Last Hunt"
            value={formatDateLabel(latestHunt?.date)}
            description={
              latestHunt
                ? `${latestHunt.standName || "Stand"} / ${
                    latestHunt.windDirection || "Wind not saved"
                  }`
                : "No hunts logged for this property yet."
            }
          />
          <InfoCard
            title="Recent Camera Activity"
            value={formatDateLabel(latestCameraCheck?.date)}
            description={
              latestCameraCheck
                ? "Latest camera check saved for this property."
                : "No camera checks saved for this property yet."
            }
          />
        </div>

        <div style={plannerIntelligenceWrapStyle}>
          <HuntPlannerIntelligencePanel summary={huntPlannerIntelligence} />
        </div>
      </DashboardSection>

      <div style={detailDropdownStackStyle}>
        <CollapsibleSection
          title="Timeline"
          description="This property's history, newest first"
        >
          <PropertyTimeline events={timelineEvents} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Property Intelligence"
          description="What the saved data says about this property"
        >
          <PropertyIntelligenceSummary cards={intelligenceCards} />
        </CollapsibleSection>
      </div>
              </div>
            ),
          },
          {
            id: "insights",
            label: "Insights",
            content: (
              <div style={tabPanelStyle}>
                <PropertyInsightsTab propertyId={propertyId} />
              </div>
            ),
          },
          {
            id: "report",
            label: "Report",
            content: (
              <div style={tabPanelStyle} id="season-report">
                <SeasonReportPanel propertyId={propertyId} />
              </div>
            ),
          },
        ]}
      />
    </PageShell>
  );
}

function weatherCardDescription({
  description,
  recordCount,
  latestDateLabel,
  sourceLabel,
}: {
  description: string;
  recordCount: number;
  latestDateLabel: string;
  sourceLabel: string;
}) {
  if (recordCount === 0) return `${description} ${sourceLabel}.`;

  const recordText =
    recordCount === 1 ? "1 weather record" : `${recordCount} weather records`;

  return `${description}. Latest: ${latestDateLabel}. ${recordText} saved. ${sourceLabel}.`;
}

function getLatestByDate<Item>(
  items: Item[],
  getDate: (item: Item) => string | undefined,
) {
  return [...items].sort(
    (left, right) => dateTime(getDate(right)) - dateTime(getDate(left)),
  )[0];
}

function dateTime(date: string | undefined) {
  if (!date) return 0;

  // Local midnight for a bare "YYYY-MM-DD" (Date.parse would read it as UTC).
  const time = dateInputTime(date);

  return Number.isNaN(time) ? 0 : time;
}

function formatDateLabel(date: string | undefined) {
  return formatDayWithAgo(date);
}

const notFoundCardStyle: CSSProperties = {
  marginTop: "1rem",
  padding: "1.5rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const pageTitleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  fontSize: "2.35rem",
  lineHeight: 1.1,
};

const mutedTextStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "0.85rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

const backTextLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textDecoration: "none",
};

const todayLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifySelf: "start",
  color: "var(--accent-text)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.8rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textDecoration: "none",
};

// Keep the opened section clear of the top edge when scrolled to.
const anchorOffsetStyle: CSSProperties = {
  scrollMarginTop: "1rem",
};

// Counts that jump to the full Cameras / Stands / Hit List / Hunt Log pages
// (this property stays selected), instead of duplicating them here.
const shortcutGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.5rem",
};

const shortcutStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "0.1rem",
  minHeight: "64px",
  padding: "0.6rem 0.4rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  textDecoration: "none",
};

const shortcutCountStyle: CSSProperties = {
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.4rem",
  fontWeight: 800,
  lineHeight: 1.1,
};

const shortcutLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.75rem",
  fontWeight: 700,
  textAlign: "center",
};

const tabPanelStyle: CSSProperties = {
  display: "grid",
  // Constrain the column so section content (grids/widgets) can't size this to
  // its max-content and push the whole page wider than the viewport on mobile.
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "1.5rem",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  marginTop: "1.25rem",
  padding: "0.7rem 1rem",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent)",
  color: "white",
  fontWeight: 700,
  textDecoration: "none",
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
  gap: "1rem",
};

const plannerIntelligenceWrapStyle: CSSProperties = {
  marginTop: "1rem",
};

const detailDropdownStackStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  marginTop: "1.75rem",
};

