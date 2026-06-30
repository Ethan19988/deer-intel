"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type CSSProperties } from "react";
import DashboardCardLink from "@/components/properties/DashboardCardLink";
import DashboardSection from "@/components/properties/DashboardSection";
import CameraSitesSection from "@/components/properties/dashboard/CameraSitesSection";
import InfoCard from "@/components/properties/dashboard/InfoCard";
import PropertyHeader from "@/components/properties/dashboard/PropertyHeader";
import RecentActivityList from "@/components/properties/dashboard/RecentActivityList";
import StatCard from "@/components/properties/dashboard/StatCard";
import WorkspaceIcon, {
  type WorkspaceIconName,
} from "@/components/properties/dashboard/WorkspaceIcon";
import {
  createCameraFromValues,
  cameraToFormValues,
  EMPTY_CAMERA_FORM_VALUES,
} from "@/lib/cameraFormValues";
import {
  activeCameraCount,
  getAiConfidence,
  getKnowledgeScore,
  getRecentActivity,
} from "@/lib/propertyDashboard";
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
    description: "Track stand locations, wind rules, and access details.",
    icon: "stands",
    href: "/stands",
    badge: "Coming Soon",
  },
  {
    title: "Hunt Log",
    description: "Log sits, sightings, conditions, and hunt outcomes.",
    icon: "huntLog",
    href: "/hunt-log",
    badge: "Coming Soon",
  },
  {
    title: "Deer History",
    description: "Build deer profiles and movement history over time.",
    icon: "deerHistory",
    href: "#recent-activity",
    badge: "Coming Soon",
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
    title: "Weather",
    value: "Coming Soon",
    description: "Temperature, precipitation, and pressure trends.",
  },
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
  const propertyPins = state.pins.filter((pin) => pin.propertyId === params.id);
  const propertyHunts = state.hunts.filter(
    (hunt) => hunt.propertyId === params.id,
  );
  const [cameraValues, setCameraValues] = useState(EMPTY_CAMERA_FORM_VALUES);
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [editCameraValues, setEditCameraValues] = useState(
    EMPTY_CAMERA_FORM_VALUES,
  );

  if (!property) {
    return (
      <main style={pageStyle}>
        <div style={contentStyle}>
          <section style={notFoundCardStyle}>
            <p style={eyebrowStyle}>Property Intelligence</p>
            <h1 style={pageTitleStyle}>Property not found</h1>
            <p style={mutedTextStyle}>
              This property may have been deleted or is not saved in this
              browser yet.
            </p>
            <Link href="/properties" style={primaryLinkStyle}>
              Back to Properties
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const propertyId = property.id;
  const standCount = propertyPins.filter((pin) => pin.type === "Treestand").length;
  const deerProfileCount = 0;
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

  return (
    <main style={pageStyle}>
      <div style={contentStyle}>
        <Link href="/properties" style={backTextLinkStyle}>
          Back to Properties
        </Link>

        <PropertyHeader
          property={property}
          knowledgeScore={knowledgeScore}
          aiConfidence={aiConfidence}
        />

        <DashboardSection eyebrow="Conditions" title="Today's Conditions">
          <div style={cardGridStyle}>
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

        <DashboardSection eyebrow="Data Snapshot" title="Quick Stats">
          <div style={cardGridStyle}>
            <StatCard
              label="Camera Sites"
              value={propertyCameras.length}
              detail={`${activeCameraCount(propertyCameras)} active`}
            />
            <StatCard
              label="Stands"
              value={standCount}
              detail="Tracked from treestand map pins"
            />
            <StatCard
              label="Hunts"
              value={propertyHunts.length}
              detail="Saved hunt log entries"
            />
            <StatCard
              label="Deer Profiles"
              value={deerProfileCount}
              detail="Profile system coming soon"
            />
          </div>
        </DashboardSection>

        <DashboardSection
          id="recent-activity"
          eyebrow="Timeline"
          title="Recent Activity"
        >
          <RecentActivityList activities={recentActivity} />
        </DashboardSection>

        <DashboardSection eyebrow="Workflows" title="Quick Actions">
          <div style={cardGridStyle}>
            <DashboardCardLink
              href="#camera-sites"
              title="Add Camera Site"
              description="Add a standard or cellular trail camera to this property."
              icon={<WorkspaceIcon name="cameras" />}
            />
            <DashboardCardLink
              href="/stands"
              title="Add Stand"
              description="Start capturing stand locations and wind rules."
              icon={<WorkspaceIcon name="stands" />}
            />
            <DashboardCardLink
              href="/hunt-log"
              title="Log Hunt"
              description="Record hunt conditions, sightings, and results."
              icon={<WorkspaceIcon name="huntLog" />}
            />
            <DashboardCardLink
              href="/map"
              title="Open Map"
              description="Manage property pins, access, bedding, food, and sign."
              icon={<WorkspaceIcon name="map" />}
            />
          </div>
        </DashboardSection>

        <DashboardSection
          id="property-modules"
          eyebrow="Navigation"
          title="Property Modules"
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
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "2rem",
  background: "#050806",
  color: "white",
};

const contentStyle: CSSProperties = {
  width: "100%",
  maxWidth: "1180px",
  margin: "0 auto",
};

const notFoundCardStyle: CSSProperties = {
  maxWidth: "680px",
  marginTop: "1rem",
  padding: "1.5rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
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

const moduleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "1rem",
};
