"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import AddCameraCard from "@/components/cameras/AddCameraCard";
import CameraCard from "@/components/cameras/CameraCard";
import EditCameraCard from "@/components/cameras/EditCameraCard";
import CameraIntelligenceSection from "@/components/cameras/CameraIntelligenceSection";
import EmptyState from "@/components/ui/EmptyState";
import {
  CameraIcon,
  ClipboardIcon,
  DeerIcon,
  ImageIcon,
  PlusIcon,
} from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import Tabs from "@/components/ui/Tabs";
import {
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { getCameraIntelligenceSummary } from "@/lib/cameraIntelligence";
import { photoRecordTime } from "@/lib/photos";
import type { Camera } from "@/types/camera";

// Chasing behavior seen on a photo this recent flags the rut-watch banner.
const RUT_WATCH_DAYS = 7;

export default function CamerasPage() {
  const [editingId, setEditingId] = useState<string | null>(null);

  // /cameras?edit=<id> (e.g. from a camera's own page) opens its editor.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingId(id);
    requestAnimationFrame(() =>
      document.getElementById(`camera-${id}`)?.scrollIntoView({ block: "start" }),
    );
  }, []);
  const state = useDeerIntelStore();
  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const selectedPropertyId = selectedProperty?.id ?? "";
  const propertyCameras = state.cameras.filter(
    (camera) => camera.propertyId === selectedPropertyId,
  );
  const activeCameraCount = propertyCameras.filter(
    (camera) => camera.status === "Active",
  ).length;
  const propertyChecks = state.cameraChecks.filter(
    (check) => check.propertyId === selectedPropertyId,
  );
  const propertyPhotos = state.photoRecords.filter(
    (photo) => photo.propertyId === selectedPropertyId,
  );
  const latestCheck = [...propertyChecks].sort(
    (left, right) => dateTime(right.date) - dateTime(left.date),
  )[0];
  const cameraIntelligence = getCameraIntelligenceSummary({
    cameras: propertyCameras,
    cameraChecks: propertyChecks,
    photoRecords: propertyPhotos,
  });
  // Fresh chasing behavior on a photo means the rut is on — say so up top.
  const rutPhoto = propertyPhotos.find(
    (photo) =>
      /chasing/i.test(photo.notes) &&
      Date.now() - photoRecordTime(photo) <= RUT_WATCH_DAYS * 86_400_000,
  );
  const rutCameraName = rutPhoto
    ? propertyCameras.find((camera) => camera.id === rutPhoto.cameraSiteId)
        ?.name ?? "a camera site"
    : "";


  function editCamera(camera: Camera) {
    setEditingId(camera.id);
  }

  if (state.properties.length === 0) {
    return (
      <PageShell>
        <header className="di-section-hero" style={headerStyle}>
          <div style={headerLeadStyle}>
            <span style={headerIconStyle} aria-hidden="true">
              <CameraIcon size={24} />
            </span>
            <div style={headerTitleWrapStyle}>
              <p style={eyebrowStyle}>Cameras</p>
              <h1 style={titleStyle}>Cameras</h1>
            </div>
          </div>
        </header>
        <EmptyState
          illustration={<CameraIcon size={30} />}
          title="No properties yet"
          description="Add a property before setting camera sites."
          action={
            <Link href="/properties" style={primaryLinkStyle} className="di-navbtn">
              Add Property
            </Link>
          }
        />
      </PageShell>
    );
  }

  const sitesTab = (
    <div style={listStyle}>
      <AddCameraCard
        key={selectedPropertyId}
        propertyId={selectedPropertyId}
        propertyName={selectedProperty?.name ?? "this property"}
        defaultOpen={propertyCameras.length === 0}
      />
      {propertyCameras.length === 0 ? (
        <EmptyState
          illustration={<CameraIcon size={30} />}
          title="No camera sites for this property"
          description="Add your first camera site above with its name, type, status, GPS, battery, card, and notes."
        />
      ) : (
        <>
          {rutPhoto ? (
            <div style={rutBannerStyle}>
              <span style={rutIconStyle} aria-hidden="true">
                <DeerIcon size={20} />
              </span>
              <span>
                <b>Rut watch:</b> chasing caught on {rutCameraName} — bucks are
                on their feet, get in a stand.
              </span>
            </div>
          ) : null}

          <Section
            eyebrow="On this property"
            title="Camera Sites"
            icon={<CameraIcon size={18} />}
            style={sectionStyle}
          >
            <div style={cardGridStyle}>
              {propertyCameras.map((camera) => (
                camera.id === editingId ? (
                  <EditCameraCard
                    key={camera.id}
                    camera={camera}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <CameraCard
                    key={camera.id}
                    camera={camera}
                    onEdit={editCamera}
                    photoRecords={propertyPhotos.filter(
                      (photo) => photo.cameraSiteId === camera.id,
                    )}
                  />
                )
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );

  const activityTab = (
    <div style={activityStyle}>
      <div style={statGridStyle}>
        <StatCard
          label="Camera Sites"
          value={propertyCameras.length}
          detail={`${activeCameraCount} active`}
          icon={<CameraIcon size={18} />}
          tone="green"
        />
        <StatCard
          label="Camera Checks"
          value={propertyChecks.length}
          detail={`Latest: ${latestCheck?.date || "none yet"}`}
          icon={<ClipboardIcon size={18} />}
          tone="green"
        />
        <StatCard
          label="Photo Records"
          value={propertyPhotos.length}
          detail="Saved photo history"
          icon={<ImageIcon size={18} />}
          tone="neutral"
        />
      </div>
      <CameraIntelligenceSection
        propertyId={selectedPropertyId}
        propertyName={selectedProperty?.name ?? "This property"}
        summary={cameraIntelligence}
      />
    </div>
  );

  return (
    <PageShell>
      <header className="di-section-hero" style={headerStyle}>
        <div style={headerLeadStyle}>
          <span style={headerIconStyle} aria-hidden="true">
            <CameraIcon size={24} />
          </span>
          <div style={headerTitleWrapStyle}>
            <p style={eyebrowStyle}>Cameras</p>
            <h1 style={titleStyle}>{selectedProperty?.name ?? "Cameras"}</h1>
          </div>
        </div>
        <div style={headerRightStyle}>
          <div style={headerActionsStyle}>
            <Link href="/cameras/import" style={secondaryLinkStyle} className="di-navbtn">
              <CameraIcon size={17} />
              Import photos
            </Link>
            <Link
              href="#add-camera"
              style={primaryLinkStyle}
              className="di-navbtn"
            >
              <PlusIcon size={17} />
              Add camera
            </Link>
          </div>
        </div>
      </header>

      <Tabs
        items={[
          {
            id: "sites",
            label: "Sites",
            badge: propertyCameras.length,
            content: sitesTab,
          },
          { id: "activity", label: "Activity", content: activityTab },
        ]}
      />
    </PageShell>
  );
}

function dateTime(date: string | undefined) {
  if (!date) return 0;

  const time = Date.parse(date);

  return Number.isNaN(time) ? 0 : time;
}

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem 1.25rem",
  flexWrap: "wrap",
  marginBottom: "1.5rem",
};

const headerLeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.85rem",
  minWidth: 0,
};

const headerIconStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3rem",
  height: "3rem",
  flex: "none",
  borderRadius: "14px",
  background: "rgba(243, 237, 217, 0.15)",
  border: "1px solid rgba(243, 237, 217, 0.35)",
  color: "#f6efd6",
};

const headerTitleWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.25rem",
  minWidth: 0,
};

const headerRightStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  flex: "1 1 280px",
  maxWidth: "460px",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "rgba(243, 237, 217, 0.82)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#f6f0dc",
  fontSize: "2rem",
  lineHeight: 1.1,
  textShadow: "0 2px 18px rgba(12, 18, 8, 0.5)",
};




// Two equal buttons on one row keeps the header short on a phone.
const headerActionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.5rem",
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
  gap: "1rem",
};

const activityStyle: CSSProperties = {
  display: "grid",
  gap: "1.5rem",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))",
  gap: "1rem",
};

const sectionStyle: CSSProperties = {
  marginTop: "0.25rem",
};

const rutBannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.7rem",
  padding: "0.85rem 1rem",
  border: "1px solid var(--accent-2-tint-border)",
  borderLeft: "4px solid var(--accent-2)",
  borderRadius: "12px",
  background: "var(--accent-2-tint)",
  color: "var(--accent-2-text)",
  fontWeight: 700,
  lineHeight: 1.5,
};

const rutIconStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.1rem",
  height: "2.1rem",
  flex: "none",
  borderRadius: "10px",
  background: "var(--surface)",
  border: "1px solid var(--accent-2-tint-border)",
  color: "var(--accent-2-text)",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.4rem",
  padding: "0.7rem 0.95rem",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};

const secondaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.4rem",
  padding: "0.7rem 0.95rem",
  border: "1px solid rgba(243, 237, 217, 0.32)",
  borderRadius: "var(--radius-sm)",
  background: "rgba(243, 237, 217, 0.14)",
  color: "#f6efd6",
  fontWeight: 800,
  textDecoration: "none",
};
