"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type CSSProperties } from "react";
import DashboardCardLink from "@/components/properties/DashboardCardLink";
import DashboardSection from "@/components/properties/DashboardSection";
import CameraSitesSection from "@/components/properties/dashboard/CameraSitesSection";
import DeerProfilesSection from "@/components/properties/dashboard/DeerProfilesSection";
import InfoCard from "@/components/properties/dashboard/InfoCard";
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

const PROPERTY_MODULES: DashboardModule[] = [
  {
    title: "Overview",
    description: "Review property notes, current data coverage, and next steps.",
    icon: "overview",
    href: "#overview",
    badge: "Available",
  },
  {
    title: "Map",
    description: "Open the property map to manage pins, travel routes, and sign.",
    icon: "map",
    href: "/map",
    badge: "Available",
  },
  {
    title: "Cameras",
    description: "Manage standard and cellular camera sites for this property.",
    icon: "cameras",
    href: "#camera-sites",
    badge: "Available",
  },
  {
    title: "Stands",
    description: "Track stand type, winds, access, exit, and notes.",
    icon: "stands",
    href: "#stand-sites",
    badge: "Available",
  },
  {
    title: "Hunt Log",
    description: "Log sits, sightings, conditions, and hunt outcomes.",
    icon: "huntLog",
    href: "/hunt-log",
    badge: "Available",
  },
  {
    title: "Deer History",
    description: "Build deer profiles and movement history over time.",
    icon: "deerHistory",
    href: "#deer-profiles",
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
    href: "#property-modules",
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

      <DashboardSection eyebrow="Next Steps" title="Quick Actions">
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
            href="/map"
            title="Open Map"
            description="Mark sign, stands, bedding, food, water, and access."
            icon={<WorkspaceIcon name="map" />}
            size="large"
            tone="primary"
          />
          <DashboardCardLink
            href="#stand-sites"
            title="Add Stand"
            description="Keep stand spots and wind notes together."
            icon={<WorkspaceIcon name="stands" />}
            size="large"
            tone="primary"
          />
          <DashboardCardLink
            href="/hunt-log"
            title="Log Hunt"
            description="Save what happened on a sit."
            icon={<WorkspaceIcon name="huntLog" />}
            size="large"
            tone="primary"
          />
        </div>
      </DashboardSection>

      <div style={overviewGridStyle}>
        <DashboardSection
          eyebrow="Quick Look"
          title="Property Stats"
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

      <DashboardSection
        id="property-timeline"
        eyebrow="Property History"
        title="Timeline"
      >
        <PropertyTimeline events={timelineEvents} />
      </DashboardSection>

      <DashboardSection
        id="property-modules"
        eyebrow="Property Tools"
        title="Open a Tool"
      >
        <div style={moduleGridStyle}>
          {PROPERTY_MODULES.map((module) => (
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
      </DashboardSection>

      <DeerProfilesSection
        profileValues={deerProfileValues}
        summaries={deerProfileSummaries}
        onProfileValuesChange={setDeerProfileValues}
        onAddProfile={addDeerProfile}
      />

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

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "1rem",
};

const quickActionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: "1rem",
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
