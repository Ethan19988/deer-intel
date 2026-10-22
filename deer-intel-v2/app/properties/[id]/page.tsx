"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import HuntPlannerIntelligencePanel from "@/components/hunts/HuntPlannerIntelligencePanel";
import DashboardCardLink from "@/components/properties/DashboardCardLink";
import DashboardSection from "@/components/properties/DashboardSection";
import InfoCard from "@/components/properties/dashboard/InfoCard";
import PropertyIntelligenceSummary from "@/components/properties/dashboard/PropertyIntelligenceSummary";
import PropertyHeader from "@/components/properties/dashboard/PropertyHeader";
import PropertyTimeline from "@/components/properties/dashboard/PropertyTimeline";
import RecentActivityList from "@/components/properties/dashboard/RecentActivityList";
import WalkTracksSection from "@/components/properties/dashboard/WalkTracksSection";
import WorkspaceIcon, {
  type WorkspaceIconName,
} from "@/components/properties/dashboard/WorkspaceIcon";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import {
  TargetIcon,
} from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import ColdFrontBanner from "@/components/ColdFrontBanner";
import TodayVerdictHero from "@/components/TodayVerdictHero";
import ConditionsStrip from "@/components/ConditionsStrip";
import StandCheckPanel from "@/components/StandCheckPanel";
import StandWindGrid from "@/components/StandWindGrid";
import BuckSlideshow from "@/components/BuckSlideshow";
import CameraPhotoStrip from "@/components/CameraPhotoStrip";
import RutRibbon from "@/components/season/RutRibbon";
import { usePropertyToday } from "@/lib/usePropertyToday";
import Tabs from "@/components/ui/Tabs";
import PropertyPatternReport from "@/components/properties/PropertyPatternReport";
import { buildPropertyPatternReport } from "@/lib/propertyPatterns";
import {
  activeCameraCount,
  getAiConfidence,
  getKnowledgeScore,
  getRecentActivity,
} from "@/lib/propertyDashboard";
import { getPropertyTimelineEvents } from "@/lib/propertyTimeline";
import { getPropertyIntelligenceCards } from "@/lib/propertyIntelligence";
import { getHuntPlannerIntelligence } from "@/lib/huntPlannerIntelligence";
import { getPropertyWeatherSummary } from "@/lib/weather";
import { updateDeerIntelStore, useDeerIntelStore } from "@/lib/deerIntelStore";

type DashboardModule = {
  title: string;
  description: string;
  icon: WorkspaceIconName;
  href: string;
  badge: "Available" | "Coming Soon";
};

const INTELLIGENCE_MODULES: DashboardModule[] = [
  {
    title: "Hunt Planner",
    description: "Review the simple property plan before choosing a sit.",
    icon: "huntLog",
    href: "#hunt-planner",
    badge: "Available",
  },
  {
    title: "AI Scout",
    description: "Ask the assistant for a stand pick from this property's saved data.",
    icon: "aiScout",
    href: "/ai",
    badge: "Available",
  },
  {
    title: "Analytics",
    description: "Compare pressure, sightings, camera activity, and stand success.",
    icon: "analytics",
    href: "#intelligence",
    badge: "Coming Soon",
  },
];

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
  // Tonight on this ground: same forecast, verdict and hit list as Today.
  const today = usePropertyToday(params.id);
  // ?tab=plan opens the Plan tab directly.
  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get("tab") === "plan" ? "plan" : "overview",
  );

  useEffect(() => {
    const hash =
      typeof window !== "undefined"
        ? window.location.hash.replace("#", "")
        : "";
    const hashTab: Record<string, string> = {
      "property-timeline": "plan",
      "hunt-planner": "plan",
      intelligence: "plan",
      map: "overview",
      "recent-activity": "overview",
      overview: "overview",
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
  const knowledgeScore = getKnowledgeScore({
    property,
    cameraCount: propertyCameras.length,
    standCount,
    huntCount: propertyHunts.length,
    deerProfileCount,
    pinCount: propertyPins.length,
  });
  const aiConfidence = getAiConfidence(knowledgeScore);
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
        Back to Properties
      </Link>

      <PropertyHeader
        property={property}
        knowledgeScore={knowledgeScore}
        aiConfidence={aiConfidence}
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

      <TodayVerdictHero
        verdict={today.verdict}
        propertyName={property.name}
        photo={today.heroPhoto}
      />

      <ConditionsStrip
        windDirection={today.forecast?.current.windDirection}
        windSpeed={today.forecast?.current.windSpeed}
        temperature={today.forecast?.current.temperature}
        conditions={today.forecast?.current.weather}
        moon={today.moon}
        pressure={today.forecast?.pressure}
      />

      <DashboardCardLink
        href="/map"
        title="Open Property Map"
        description="Layers, pins, wind, access routes, blood trail and offline maps for this property."
        icon={<WorkspaceIcon name="map" />}
        size="compact"
        tone="primary"
      />

      <StandCheckPanel
        check={today.verdict.check}
        wind={today.verdict.wind}
        whenLabel={today.verdict.periodLabel}
      />
      <StandWindGrid
        days={today.forecast?.days ?? []}
        stands={propertyStands}
        activeKey={today.activeSitKey}
      />

      <BuckSlideshow slides={today.hitListSlides} />

      <CameraPhotoStrip photos={today.stripPhotos} allHref="/cameras" />

      <RutRibbon
        phase={today.seasonCtx.phase}
        phaseLabel={today.seasonCtx.phaseLabel}
        daysToPeak={today.seasonCtx.daysToPeak}
      />

      <nav aria-label="On this property" style={shortcutGridStyle}>
        {[
          {
            href: "/cameras",
            label: `Cameras · ${activeCameraCount(propertyCameras)} active`,
            count: propertyCameras.length,
          },
          { href: "/stands", label: "Stands", count: standCount },
          { href: "/hit-list", label: "Bucks", count: deerProfileCount },
          { href: "/hunt-log", label: "Sits logged", count: propertyHunts.length },
          { href: "/map", label: "Map pins", count: propertyPins.length },
          { href: "/map", label: "Saved walks", count: propertyWalkTracks.length },
        ].map((item) => (
          <Link key={item.label} href={item.href} style={shortcutStyle}>
            <span style={shortcutCountStyle}>{item.count}</span>
            <span style={shortcutLabelStyle}>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div style={detailDropdownStackStyle}>
        <CollapsibleSection
          title="Recent Activity"
          description="Pins, hunts and checks saved on this property"
        >
          <RecentActivityList activities={recentActivity} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Saved Walks"
          description="Trails you've recorded on this property"
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
          description="Summaries and advanced tools for this property"
        >
          <PropertyIntelligenceSummary cards={intelligenceCards} />

          <Card as="div" variant="subtle" style={advancedToolsStyle}>
            <h3 style={summaryCardTitleStyle}>Advanced Tools</h3>
            <div style={moduleGridStyle}>
              {INTELLIGENCE_MODULES.map((module) => (
                <DashboardCardLink
                  key={module.title}
                  href={module.href}
                  title={module.title}
                  description={module.description}
                  badge={module.badge}
                  icon={<WorkspaceIcon name={module.icon} />}
                />
              ))}
            </div>
          </Card>
        </CollapsibleSection>
      </div>
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

  const time = Date.parse(date);

  return Number.isNaN(time) ? 0 : time;
}

function formatDateLabel(date: string | undefined) {
  if (!date) return "None yet";

  return date;
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
  fontWeight: 700,
  textDecoration: "none",
};

// Counts that jump to the full Cameras / Stands / Bucks / Hunt Log pages
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

const summaryCardTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "1.15rem",
  lineHeight: 1.25,
};

const detailDropdownStackStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  marginTop: "1.75rem",
};

const advancedToolsStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginTop: "1rem",
};

const moduleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
  gap: "1rem",
};

