"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import AddCameraCard from "@/components/cameras/AddCameraCard";
import CameraSiteRow from "@/components/cameras/CameraSiteRow";
import CameraPhotoStrip from "@/components/CameraPhotoStrip";
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
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Tabs from "@/components/ui/Tabs";
import {
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { getCameraIntelligenceSummary } from "@/lib/cameraIntelligence";
import { photoRecordTime } from "@/lib/photos";
import { useAddFormRequest } from "@/lib/useAddFormRequest";
import { buildStripPhotos } from "@/lib/photoStrip";
import type { Camera } from "@/types/camera";

// Chasing behavior seen on a photo this recent flags the rut-watch banner.
const RUT_WATCH_DAYS = 7;

export default function CamerasPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const addForm = useAddFormRequest("add-camera");

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
        <PageHeader eyebrow="Trail cameras" title="Cameras" />
        <EmptyState
          illustration={<CameraIcon size={28} />}
          title="No properties yet"
          description="Add a property first, then set up its camera sites."
          action={
            <Link href="/properties" className="di-link-btn di-link-btn--primary">
              Add property
            </Link>
          }
        />
      </PageShell>
    );
  }

  const latestPhotos = buildStripPhotos(propertyPhotos, propertyCameras, 6);

  const sitesTab = (
    <div style={listStyle}>
      {/* The header's "Add camera" opens this; it isn't a standing card. */}
      {addForm.requested || propertyCameras.length === 0 ? (
        <AddCameraCard
          key={selectedPropertyId}
          propertyId={selectedPropertyId}
          propertyName={selectedProperty?.name ?? "this property"}
          defaultOpen
        />
      ) : null}
      {propertyCameras.length === 0 ? (
        <EmptyState
          illustration={<CameraIcon size={28} />}
          title="No camera sites yet"
          description="Add your first camera above: name, type, GPS and which way it faces. Then import photos and tag your bucks."
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

          <ul style={rowListStyle} aria-label="Camera sites">
            {propertyCameras.map((camera) =>
              camera.id === editingId ? (
                <li key={camera.id} id={`camera-${camera.id}`} style={editItemStyle}>
                  <EditCameraCard camera={camera} onDone={() => setEditingId(null)} />
                </li>
              ) : (
                <CameraSiteRow
                  key={camera.id}
                  camera={camera}
                  onEdit={editCamera}
                  photoRecords={propertyPhotos.filter(
                    (photo) => photo.cameraSiteId === camera.id,
                  )}
                />
              ),
            )}
          </ul>

          <CameraPhotoStrip photos={latestPhotos} layout="grid" />
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
      <PageHeader
        eyebrow={selectedProperty?.name ?? "On this property"}
        title="Cameras"
        meta={
          propertyCameras.length > 0
            ? `${propertyCameras.length} sites · ${activeCameraCount} active · ${propertyPhotos.length} photos`
            : undefined
        }
        action={
          <>
            <Link href="/cameras/import" className="di-link-btn">
              Import photos
            </Link>
            <a
              href="#add-camera"
              className="di-link-btn di-link-btn--primary"
              onClick={(event) => {
                event.preventDefault();
                addForm.request();
              }}
            >
              <PlusIcon size={16} />
              Add camera
            </a>
          </>
        }
      />

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

const rowListStyle: CSSProperties = {
  display: "grid",
  margin: 0,
  padding: 0,
  listStyle: "none",
  borderTop: "1px solid var(--border)",
};

const editItemStyle: CSSProperties = {
  padding: "0.75rem 0",
  borderBottom: "1px solid var(--border)",
};

const rutBannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.7rem",
  padding: "0.85rem 1rem",
  border: "1px solid var(--accent-2-tint-border)",
  borderLeft: "4px solid var(--accent-2)",
  borderRadius: "var(--radius-sm)",
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
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  border: "1px solid var(--accent-2-tint-border)",
  color: "var(--accent-2-text)",
};
