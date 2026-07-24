"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import HuntPlannerIntelligencePanel from "@/components/hunts/HuntPlannerIntelligencePanel";
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
import WalkTracksSection from "@/components/properties/dashboard/WalkTracksSection";
import WorkspaceIcon, {
  type WorkspaceIconName,
} from "@/components/properties/dashboard/WorkspaceIcon";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import {
  CalendarIcon,
  CameraIcon,
  ClipboardIcon,
  CompassIcon,
  DeerIcon,
  LeafIcon,
  MapIcon,
  MapPinIcon,
  StandIcon,
  SunIcon,
  TargetIcon,
} from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import Tabs from "@/components/ui/Tabs";
import LiveWeatherPanel from "@/components/weather/LiveWeatherPanel";
import WeatherHistoryPanel from "@/components/weather/WeatherHistoryPanel";
import SeasonRutCard from "@/components/season/SeasonRutCard";
import PipelineCommandCard from "@/components/properties/PipelineCommandCard";
import GenerateHighResButton from "@/components/terrain/GenerateHighResButton";
import PropertyPatternReport from "@/components/properties/PropertyPatternReport";
import { buildPropertyPatternReport } from "@/lib/propertyPatterns";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { hasPropertyCoordinate } from "@/lib/propertyLocation";
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
import { getPropertyInsights } from "@/lib/propertyInsights";
import { getHuntPlannerIntelligence } from "@/lib/huntPlannerIntelligence";
import { getPropertyWeatherSummary } from "@/lib/weather";
import { PIN_LAYER_LOOKUP } from "@/lib/propertyMap";
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

const INTELLIGENCE_MODULES: DashboardModule[] = [
  {
    title: "Hunt Planner",
    description: "Review the simple property plan before choosing a sit.",
    icon: "huntLog",
    href: "#hunt-planner",
    badge: "Available",
  },
  {
    title: "Deer Intelligence Hub",
    description: "Open the simple property readout for stands, bucks, and needs.",
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
  // Food pins on this property feed the high-res read's bed-to-feed routes (and
  // therefore the road crossings on them). Both "Food" and "Food Source" pins
  // resolve to the food layer, so match on that rather than a single label.
  const propertyFood = propertyPins
    .filter((pin) => PIN_LAYER_LOOKUP[pin.type] === "food")
    .map((pin) => ({ lat: pin.lat, lng: pin.lng }));
  const weatherPoint = resolvePropertyWeatherPoint(
    property,
    state.cameras.filter((camera) => camera.propertyId === params.id),
    state.pins.filter((pin) => pin.propertyId === params.id),
  );
  const propertyHunts = state.hunts.filter(
    (hunt) => hunt.propertyId === params.id,
  );
  const propertyCameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === params.id,
  );
  const patternReport = buildPropertyPatternReport(
    propertyHunts,
    propertyCameraChecks,
    propertyCameras,
  );
  const propertyPhotoRecords = state.photoRecords.filter(
    (photo) => photo.propertyId === params.id,
  );
  const propertyDeerProfiles = state.deerProfiles.filter(
    (profile) => profile.propertyId === params.id,
  );
  const propertyWalkTracks = state.walkTracks.filter(
    (track) => track.propertyId === params.id,
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

  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (editCameraIdParam) {
      setActiveTab("cameras");
      return;
    }

    const hash =
      typeof window !== "undefined"
        ? window.location.hash.replace("#", "")
        : "";
    const hashTab: Record<string, string> = {
      "camera-sites": "cameras",
      "stand-sites": "stands",
      "deer-profiles": "deer",
      "property-timeline": "plan",
      "hunt-planner": "plan",
      intelligence: "plan",
      map: "overview",
      "recent-activity": "overview",
      overview: "overview",
    };

    if (hash && hashTab[hash]) setActiveTab(hashTab[hash]);
  }, [editCameraIdParam]);

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
  const keyInsights = getPropertyInsights({
    activePropertyName: property.name,
    cameraCheckCount: propertyCameraChecks.length,
    cameraCount: propertyCameras.length,
    deerProfileCount: deerProfileCount,
    huntCount: propertyHunts.length,
    lastHuntDate: latestHunt ? formatDateLabel(latestHunt.date) : null,
    pinCount: propertyPins.length,
    standCount: standCount,
  });
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

  function deleteWalkTrack(trackId: string) {
    if (!window.confirm("Delete this saved walk?")) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      walkTracks: currentState.walkTracks.filter(
        (track) => track.id !== trackId,
      ),
    }));
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

      <Tabs
        activeId={activeTab}
        onChange={setActiveTab}
        items={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <div style={tabPanelStyle}>
      <DashboardSection eyebrow="Command Center" title="Quick Actions" icon={<CompassIcon size={18} />}>
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
        icon={<MapIcon size={18} />}
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
                icon={<CameraIcon size={18} />}
                tone="green"
              />
              <StatCard
                label="Stands"
                value={standCount}
                detail="Saved stand sites"
                icon={<StandIcon size={18} />}
                tone="green"
              />
              <StatCard
                label="Assets"
                value={propertyPins.length}
                detail="Saved map pins"
                icon={<MapPinIcon size={18} />}
                tone="neutral"
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
          icon={<ClipboardIcon size={18} />}
          style={panelSectionStyle}
        >
          <div style={statGridStyle}>
            <StatCard
              label="Camera Sites"
              value={propertyCameras.length}
              detail={`${activeCameraCount(propertyCameras)} active`}
              icon={<CameraIcon size={18} />}
              tone="green"
            />
            <StatCard
              label="Stands"
              value={standCount}
              detail="Saved stand sites"
              icon={<StandIcon size={18} />}
              tone="green"
            />
            <StatCard
              label="Hunts"
              value={propertyHunts.length}
              detail="Saved hunt notes"
              icon={<ClipboardIcon size={18} />}
              tone="neutral"
            />
            <StatCard
              label="Deer Profiles"
              value={deerProfileCount}
              detail="Saved deer history"
              icon={<DeerIcon size={18} />}
              tone="blaze"
            />
            <StatCard
              label="Walks"
              value={propertyWalkTracks.length}
              detail="Recorded trails"
              icon={<CompassIcon size={18} />}
              tone="neutral"
            />
          </div>
        </DashboardSection>

        <DashboardSection
          id="recent-activity"
          eyebrow="Field History"
          title="Recent Activity"
          icon={<CalendarIcon size={18} />}
          style={panelSectionStyle}
        >
          <RecentActivityList activities={recentActivity} />
        </DashboardSection>
      </div>

      <DashboardSection
        id="key-insights"
        eyebrow="Brief"
        title="Key Insights"
        icon={<TargetIcon size={18} />}
      >
        <div style={insightListStyle}>
          {keyInsights.map((insight) => (
            <Card
              key={insight.title}
              as="article"
              variant="subtle"
              style={insightCardStyle}
            >
              <div>
                <p style={insightTitleStyle}>{insight.title}</p>
                <p style={insightDetailStyle}>{insight.detail}</p>
              </div>
              <Badge>{insight.badge}</Badge>
            </Card>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        id="walks"
        eyebrow="Field History"
        title="Saved Walks"
        icon={<MapPinIcon size={18} />}
      >
        <WalkTracksSection
          tracks={propertyWalkTracks}
          onDelete={deleteWalkTrack}
        />
      </DashboardSection>

      <DashboardSection eyebrow="Season" title="Where the Season Stands" icon={<LeafIcon size={18} />}>
        <SeasonRutCard
          latitude={
            hasPropertyCoordinate(property) ? property.latitude : undefined
          }
        />
      </DashboardSection>

      <DashboardSection eyebrow="Patterns" title="What Produces Deer Here" icon={<DeerIcon size={18} />}>
        <PropertyPatternReport report={patternReport} />
      </DashboardSection>

      <DashboardSection eyebrow="Conditions" title="Today's Conditions" icon={<SunIcon size={18} />}>
        <LiveWeatherPanel
          point={weatherPoint}
          emptyHint={`Add a saved location, map pins, or a camera to ${property.name} to load live weather.`}
        />
      </DashboardSection>

      <DashboardSection eyebrow="Conditions" title="Recent Weather" icon={<CalendarIcon size={18} />}>
        <WeatherHistoryPanel
          point={weatherPoint}
          emptyHint={`Add a saved location, map pins, or a camera to ${property.name} to load weather history.`}
        />
      </DashboardSection>

      <DashboardSection eyebrow="Terrain" title="High-Res Terrain (LiDAR)" icon={<MapIcon size={18} />}>
        <PipelineCommandCard
          propertyName={property.name}
          center={weatherPoint}
          extraCoords={[
            ...propertyPins.map((pin) => ({ lat: pin.lat, lng: pin.lng })),
            ...propertyCameras
              .filter(
                (camera) =>
                  typeof camera.latitude === "number" &&
                  typeof camera.longitude === "number",
              )
              .map((camera) => ({
                lat: camera.latitude as number,
                lng: camera.longitude as number,
              })),
          ]}
        />
        <div style={{ marginTop: 12 }}>
          <GenerateHighResButton
            property={{
              id: property.id,
              name: property.name,
              huntArea: property.huntArea,
              food: propertyFood,
            }}
          />
        </div>
      </DashboardSection>
              </div>
            ),
          },
          {
            id: "cameras",
            label: "Cameras",
            badge: propertyCameras.length,
            content: (
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
            ),
          },
          {
            id: "stands",
            label: "Stands",
            badge: standCount,
            content: (
      <StandSitesSection
        stands={propertyStands}
        standValues={standValues}
        onStandValuesChange={setStandValues}
        onAddStand={addStand}
      />
            ),
          },
          {
            id: "deer",
            label: "Deer",
            badge: deerProfileCount,
            content: (
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
            ),
          },
          {
            id: "plan",
            label: "Plan",
            content: (
              <div style={tabPanelStyle}>
      <DashboardSection
        id="property-timeline"
        eyebrow="Property History"
        title="Timeline"
        icon={<CalendarIcon size={18} />}
      >
        <PropertyTimeline events={timelineEvents} />
      </DashboardSection>

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

      <DashboardSection
        id="intelligence"
        eyebrow="Intelligence"
        title="Property Intelligence"
        icon={<CompassIcon size={18} />}
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

const tabPanelStyle: CSSProperties = {
  display: "grid",
  gap: "1.5rem",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  marginTop: "1.25rem",
  padding: "0.7rem 1rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontWeight: 700,
  textDecoration: "none",
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "1rem",
};

const plannerIntelligenceWrapStyle: CSSProperties = {
  marginTop: "1rem",
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
  color: "var(--text)",
  fontSize: "1.15rem",
  lineHeight: 1.25,
};

const mapSummaryTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
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

const insightListStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const insightCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const insightTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 850,
  lineHeight: 1.3,
};

const insightDetailStyle: CSSProperties = {
  margin: "0.45rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.45,
};
