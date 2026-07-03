"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import DashboardCardLink from "@/components/properties/DashboardCardLink";
import DashboardSection from "@/components/properties/DashboardSection";
import CameraSitesSection from "@/components/properties/dashboard/CameraSitesSection";
import DeerProfilesSection from "@/components/properties/dashboard/DeerProfilesSection";
import InfoCard from "@/components/properties/dashboard/InfoCard";
import PropertyIntelligenceSummary from "@/components/properties/dashboard/PropertyIntelligenceSummary";
import PropertyHeader from "@/components/properties/dashboard/PropertyHeader";
import PropertyTimeline from "@/components/properties/dashboard/PropertyTimeline";
import RecentActivityList from "@/components/properties/dashboard/RecentActivityList";
import StatCard from "@/components/properties/dashboard/StatCard";
import StandSitesSection from "@/components/properties/dashboard/StandSitesSection";
import WorkspaceIcon, {
  type WorkspaceIconName,
} from "@/components/properties/dashboard/WorkspaceIcon";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import {
  createCameraFromValues,
  cameraToFormValues,
  EMPTY_CAMERA_FORM_VALUES,
} from "@/lib/cameraFormValues";
import {
  createStandFromValues,
  EMPTY_STAND_FORM_VALUES,
} from "@/lib/standFormValues";
import {
  createDeerProfileFromValues,
  EMPTY_DEER_PROFILE_FORM_VALUES,
} from "@/lib/deerProfileFormValues";
import { getDeerProfileSummaries } from "@/lib/deerProfiles";
import {
  activeCameraCount,
  getAiConfidence,
  getKnowledgeScore,
  getRecentActivity,
} from "@/lib/propertyDashboard";
import { getPropertyTimelineEvents } from "@/lib/propertyTimeline";
import { getPropertyIntelligenceCards } from "@/lib/propertyIntelligence";
import { getPropertyWeatherSummary } from "@/lib/weather";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import type { Camera } from "@/types/camera";

type DashboardModule = {
  title: string;
  description: string;
  icon: WorkspaceIconName;
  href: string;
  badge: "Available" | "Coming Soon";
};

type CommandTab = {
  href: string;
  label: string;
  primary?: boolean;
};

const COMMAND_TABS: CommandTab[] = [
  { href: "#overview", label: "Overview" },
  { href: "#map", label: "Map", primary: true },
  { href: "#camera-sites", label: "Cameras" },
  { href: "#stand-sites", label: "Stands" },
  { href: "#deer-profiles", label: "Deer" },
  { href: "#property-timeline", label: "Timeline" },
  { href: "#hunt-planner", label: "Hunt Planner" },
  { href: "#intelligence", label: "Intelligence" },
];

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
    description: "Prepare recommendations from weather, wind, cameras, and hunts.",
    icon: "aiScout",
    href: "/ai",
    badge: "Coming Soon",
  },
  {
    title: "Analytics",
    description: "Compare pressure, sightings, camera activity, and stand success.",
    icon: "analytics",
    href: "#intelligence",
    badge: "Coming Soon",
  },
];

const CONDITION_CARDS = [
  {
    title: "Wind",
    value: "Coming Soon",
    description: "Direction, speed, and stand suitability.",
  },
  {
    title: "Moon",
    value: "Coming Soon",
    description: "Moon phase and movement context.",
  },
  {
    title: "Daylight",
    value: "Coming Soon",
    description: "Sunrise, sunset, and legal shooting light.",
  },
];

export default function PropertyWorkspacePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const editCameraIdParam = searchParams.get("editCameraId");
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
  const propertyDeerProfiles = state.deerProfiles.filter(
    (profile) => profile.propertyId === params.id,
  );
  const [cameraValues, setCameraValues] = useState(EMPTY_CAMERA_FORM_VALUES);
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [editCameraValues, setEditCameraValues] = useState(
    EMPTY_CAMERA_FORM_VALUES,
  );
  const [standValues, setStandValues] = useState(EMPTY_STAND_FORM_VALUES);
  const [deerProfileValues, setDeerProfileValues] = useState(
    EMPTY_DEER_PROFILE_FORM_VALUES,
  );

  useEffect(() => {
    if (!editCameraIdParam || editingCameraId === editCameraIdParam) return;

    const cameraToEdit = state.cameras.find(
      (camera) =>
        camera.id === editCameraIdParam && camera.propertyId === params.id,
    );

    if (!cameraToEdit) return;

    let didCancel = false;

    queueMicrotask(() => {
      if (didCancel) return;

      setEditingCameraId(cameraToEdit.id);
      setEditCameraValues(cameraToFormValues(cameraToEdit));
    });

    return () => {
      didCancel = true;
    };
  }, [editCameraIdParam, editingCameraId, params.id, state.cameras]);

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
          <Link href="/properties" style={primaryLinkStyle}>
            Back to Properties
          </Link>
        </Card>
      </PageShell>
    );
  }

  const propertyId = property.id;
  const standCount = propertyStands.length;
  const deerProfileCount = propertyDeerProfiles.length;
  const deerProfileSummaries = getDeerProfileSummaries({
    profiles: propertyDeerProfiles,
    photoRecords: propertyPhotoRecords,
  });
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
    cameras: propertyCameras,
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
  const latestHunt = getLatestByDate(propertyHunts, (hunt) => hunt.date);
  const latestCameraCheck = getLatestByDate(
    propertyCameraChecks,
    (check) => check.date,
  );
  const firstCamera = propertyCameras[0];
  const addPhotoHref = firstCamera
    ? `/properties/${propertyId}/assets/${firstCamera.id}#photos`
    : "#camera-sites";

  function addCamera() {
    const newCamera = createCameraFromValues({
      id: createDeerIntelId("camera"),
      propertyId,
      values: cameraValues,
    });

    if (!newCamera) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      cameras: [...currentState.cameras, newCamera],
    }));
    setCameraValues(EMPTY_CAMERA_FORM_VALUES);
  }

  function startEditingCamera(camera: Camera) {
    setEditingCameraId(camera.id);
    setEditCameraValues(cameraToFormValues(camera));
  }

  function cancelEditingCamera() {
    setEditingCameraId(null);
    setEditCameraValues(EMPTY_CAMERA_FORM_VALUES);
  }

  function saveEditedCamera() {
    if (editingCameraId === null) return;

    const updatedCamera = createCameraFromValues({
      id: editingCameraId,
      propertyId,
      values: editCameraValues,
    });

    if (!updatedCamera) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      cameras: currentState.cameras.map((camera) =>
        camera.id === editingCameraId ? updatedCamera : camera,
      ),
    }));
    cancelEditingCamera();
  }

  function addStand() {
    const newStand = createStandFromValues({
      id: createDeerIntelId("stand"),
      propertyId,
      values: standValues,
    });

    if (!newStand) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      stands: [...currentState.stands, newStand],
    }));
    setStandValues(EMPTY_STAND_FORM_VALUES);
  }

  function addDeerProfile() {
    const newProfile = createDeerProfileFromValues({
      id: createDeerIntelId("deer-profile"),
      propertyId,
      values: deerProfileValues,
    });

    if (!newProfile) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      deerProfiles: [...currentState.deerProfiles, newProfile],
    }));
    setDeerProfileValues(EMPTY_DEER_PROFILE_FORM_VALUES);
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

      <CommandTabs tabs={COMMAND_TABS} />

      <DashboardSection eyebrow="Command Center" title="Quick Actions">
        <div style={quickActionGridStyle}>
          <DashboardCardLink
            href="#camera-sites"
            title="Add Camera Site"
            description="Add a trail camera to this property."
            icon={<WorkspaceIcon name="cameras" />}
            size="large"
            tone="primary"
          />
          <DashboardCardLink
            href="#stand-sites"
            title="Add Stand"
            description="Save a stand site, wind notes, and access notes."
            icon={<WorkspaceIcon name="stands" />}
            size="large"
            tone="primary"
          />
          <DashboardCardLink
            href="/map"
            title="Add Asset"
            description="Open the map to add sign, bedding, food, water, trails, parking, or gates."
            icon={<WorkspaceIcon name="map" />}
            size="large"
            tone="primary"
          />
          <DashboardCardLink
            href={`/hunt-log?propertyId=${propertyId}`}
            title="Add Hunt Log"
            description="Log a sit for this property."
            icon={<WorkspaceIcon name="huntLog" />}
            size="large"
            tone="primary"
          />
          <DashboardCardLink
            href={addPhotoHref}
            title="Add Photo Record"
            description={
              firstCamera
                ? "Attach a photo record to a camera check."
                : "Add a camera site first, then add photo records."
            }
            icon={<WorkspaceIcon name="deerHistory" />}
            size="large"
            tone="primary"
          />
        </div>
      </DashboardSection>

      <DashboardSection
        id="map"
        eyebrow="Primary Workspace"
        title="Map"
      >
        <div style={mapCommandGridStyle}>
          <DashboardCardLink
            href="/map"
            title="Open Property Map"
            description="Scout this property, place assets, check camera sites, and review stands."
            icon={<WorkspaceIcon name="map" />}
            size="large"
            tone="primary"
          />
          <Card as="div" variant="subtle" style={mapSummaryCardStyle}>
            <h3 style={summaryCardTitleStyle}>Mapped Summary</h3>
            <div style={statGridStyle}>
              <StatCard
                label="Camera Sites"
                value={propertyCameras.length}
                detail={`${activeCameraCount(propertyCameras)} active`}
              />
              <StatCard
                label="Stands"
                value={standCount}
                detail="Saved stand sites"
              />
              <StatCard
                label="Assets"
                value={propertyPins.length}
                detail="Saved map pins"
              />
            </div>
            <p style={mapSummaryTextStyle}>
              Opening the map from here keeps the active property set to{" "}
              {property.name}.
            </p>
          </Card>
        </div>
      </DashboardSection>

      <div style={overviewGridStyle}>
        <DashboardSection
          eyebrow="Overview"
          title="Property Summary"
          style={panelSectionStyle}
        >
          <div style={statGridStyle}>
            <StatCard
              label="Camera Sites"
              value={propertyCameras.length}
              detail={`${activeCameraCount(propertyCameras)} active`}
            />
            <StatCard
              label="Stands"
              value={standCount}
              detail="Saved stand sites"
            />
            <StatCard
              label="Hunts"
              value={propertyHunts.length}
              detail="Saved hunt notes"
            />
            <StatCard
              label="Deer Profiles"
              value={deerProfileCount}
              detail="Saved deer history"
            />
          </div>
        </DashboardSection>

        <DashboardSection
          id="recent-activity"
          eyebrow="Field History"
          title="Recent Activity"
          style={panelSectionStyle}
        >
          <RecentActivityList activities={recentActivity} />
        </DashboardSection>
      </div>

      <DashboardSection eyebrow="Conditions" title="Today's Conditions">
        <div style={cardGridStyle}>
          <InfoCard
            title="Weather"
            value={weatherSummary.value}
            description={weatherCardDescription(weatherSummary)}
          />
          {CONDITION_CARDS.map((condition) => (
            <InfoCard
              key={condition.title}
              title={condition.title}
              value={condition.value}
              description={condition.description}
            />
          ))}
        </div>
      </DashboardSection>

      <CameraSitesSection
        cameras={propertyCameras}
        cameraValues={cameraValues}
        editCameraValues={editCameraValues}
        editingCameraId={editingCameraId}
        onCameraValuesChange={setCameraValues}
        onEditCameraValuesChange={setEditCameraValues}
        onAddCamera={addCamera}
        onStartEditingCamera={startEditingCamera}
        onSaveEditedCamera={saveEditedCamera}
        onCancelEditingCamera={cancelEditingCamera}
      />

      <StandSitesSection
        stands={propertyStands}
        standValues={standValues}
        onStandValuesChange={setStandValues}
        onAddStand={addStand}
      />

      <DeerProfilesSection
        profileValues={deerProfileValues}
        summaries={deerProfileSummaries}
        propertyName={property.name}
        cameras={propertyCameras}
        photoRecords={propertyPhotoRecords}
        cameraChecks={propertyCameraChecks}
        hunts={propertyHunts}
        pins={propertyPins}
        onProfileValuesChange={setDeerProfileValues}
        onAddProfile={addDeerProfile}
      />

      <DashboardSection
        id="property-timeline"
        eyebrow="Property History"
        title="Timeline"
      >
        <PropertyTimeline events={timelineEvents} />
      </DashboardSection>

      <DashboardSection
        id="hunt-planner"
        eyebrow="Hunt Planner"
        title="Property Hunt Plan"
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
      </DashboardSection>

      <DashboardSection
        id="intelligence"
        eyebrow="Intelligence"
        title="Property Intelligence"
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
      </DashboardSection>
    </PageShell>
  );
}

function CommandTabs({ tabs }: { tabs: CommandTab[] }) {
  return (
    <nav aria-label="Property command center" style={commandTabsStyle}>
      {tabs.map((tab) => (
        <a
          key={tab.href}
          href={tab.href}
          style={{
            ...commandTabStyle,
            ...(tab.primary ? primaryCommandTabStyle : null),
          }}
        >
          {tab.label}
        </a>
      ))}
    </nav>
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
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
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
  color: "#b8c2b6",
  lineHeight: 1.6,
};

const backTextLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  color: "#c6d5c5",
  fontWeight: 700,
  textDecoration: "none",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  marginTop: "1.25rem",
  padding: "0.7rem 1rem",
  border: "1px solid #3b6843",
  borderRadius: "8px",
  background: "#18351d",
  color: "white",
  fontWeight: 700,
  textDecoration: "none",
};

const commandTabsStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  display: "flex",
  gap: "0.55rem",
  marginTop: "1rem",
  padding: "0.55rem",
  overflowX: "auto",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "rgba(5, 8, 6, 0.94)",
  backdropFilter: "blur(10px)",
};

const commandTabStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "48px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.7rem 0.9rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
  color: "#f1f5ef",
  fontSize: "0.94rem",
  fontWeight: 850,
  textDecoration: "none",
};

const primaryCommandTabStyle: CSSProperties = {
  borderColor: "#3b6843",
  background: "#18351d",
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "1rem",
};

const quickActionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "1rem",
};

const mapCommandGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
  alignItems: "stretch",
};

const mapSummaryCardStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const summaryCardTitleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "1.15rem",
  lineHeight: 1.25,
};

const mapSummaryTextStyle: CSSProperties = {
  margin: 0,
  color: "#b8c2b6",
  lineHeight: 1.5,
};

const advancedToolsStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginTop: "1rem",
};

const overviewGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1.25rem",
  alignItems: "start",
};

const panelSectionStyle: CSSProperties = {
  marginTop: "1.75rem",
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "1rem",
};

const moduleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "1rem",
};
