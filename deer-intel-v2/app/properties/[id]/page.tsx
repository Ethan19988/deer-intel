"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type CSSProperties } from "react";
import CameraCard from "@/components/cameras/CameraCard";
import CameraForm, {
  type CameraFormValues,
} from "@/components/cameras/CameraForm";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import type { Camera } from "@/types/camera";

type WorkspaceIconName =
  | "overview"
  | "map"
  | "cameras"
  | "stands"
  | "huntLog"
  | "deerHistory"
  | "aiScout"
  | "analytics";

type WorkspaceCard = {
  title: string;
  description: string;
  icon: WorkspaceIconName;
  status?: "Available" | "Coming Soon";
};

const EMPTY_CAMERA_FORM_VALUES: CameraFormValues = {
  name: "",
  cameraType: "Standard",
  manufacturer: "",
  model: "",
  status: "Active",
  latitude: "",
  longitude: "",
  locationNotes: "",
  batteryPercent: "",
  sdCardPercent: "",
  signalStrength: "",
  carrier: "",
  lastChecked: "",
  lastTransmission: "",
  notes: "",
};

const WORKSPACE_CARDS: WorkspaceCard[] = [
  {
    title: "Overview",
    description:
      "Season notes, property patterns, pressure, and habitat observations will live here.",
    icon: "overview",
  },
  {
    title: "Map",
    description:
      "Property-specific pins, access routes, bedding, food, and travel corridors will connect here.",
    icon: "map",
  },
  {
    title: "Cameras",
    description:
      "Add and monitor property-specific trail cameras, card checks, battery status, and notes.",
    icon: "cameras",
    status: "Available",
  },
  {
    title: "Stands",
    description:
      "Stand locations, wind rules, access notes, and hunt history will be managed here.",
    icon: "stands",
  },
  {
    title: "Hunt Log",
    description:
      "Hunts, sightings, weather, wind, results, and lessons learned will be tracked here.",
    icon: "huntLog",
  },
  {
    title: "Deer History",
    description:
      "Sightings, buck patterns, travel timing, and seasonal movement notes will build up here.",
    icon: "deerHistory",
  },
  {
    title: "AI Scout",
    description:
      "Future recommendations will combine property history, conditions, movement, and timing.",
    icon: "aiScout",
  },
  {
    title: "Analytics",
    description:
      "Property trends, stand performance, camera activity, and hunt results will surface here.",
    icon: "analytics",
  },
];

export default function PropertyWorkspacePage() {
  const params = useParams<{ id: string }>();
  const { cameras, properties } = useDeerIntelStore();
  const property = properties.find((item) => item.id === params.id);
  const propertyCameras = cameras.filter(
    (camera) => camera.propertyId === params.id,
  );
  const [cameraValues, setCameraValues] = useState<CameraFormValues>(
    EMPTY_CAMERA_FORM_VALUES,
  );
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [editCameraValues, setEditCameraValues] = useState<CameraFormValues>(
    EMPTY_CAMERA_FORM_VALUES,
  );

  function addCamera() {
    if (!property) return;

    const newCamera = createCameraFromValues({
      id: createDeerIntelId("camera"),
      propertyId: property.id,
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
    if (!property || editingCameraId === null) return;

    const updatedCamera = createCameraFromValues({
      id: editingCameraId,
      propertyId: property.id,
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

  if (!property) {
    return (
      <main style={pageStyle}>
        <div style={contentStyle}>
          <section style={notFoundCardStyle}>
            <p style={eyebrowStyle}>Property Workspace</p>
            <h1 style={pageTitleStyle}>Property not found</h1>
            <p style={mutedTextStyle}>
              This property may have been deleted or is not saved in this
              browser yet.
            </p>
            <Link href="/properties" style={backLinkStyle}>
              Back to Properties
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={contentStyle}>
        <Link href="/properties" style={backTextLinkStyle}>
          Back to Properties
        </Link>

        <header style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>Property Workspace</p>
            <h1 style={pageTitleStyle}>{property.name}</h1>
            <p style={mutedTextStyle}>
              A focused dashboard for this property&apos;s map, cameras,
              stands, hunt history, and AI scouting notes.
            </p>
          </div>
        </header>

        <section style={summaryGridStyle} aria-label="Property details">
          <div style={summaryCardStyle}>
            <p style={summaryLabelStyle}>County / Region</p>
            <p style={summaryValueStyle}>{property.county}</p>
          </div>
          <div style={summaryCardStyle}>
            <p style={summaryLabelStyle}>Acres</p>
            <p style={summaryValueStyle}>{property.acres}</p>
          </div>
          <div style={notesCardStyle}>
            <p style={summaryLabelStyle}>Notes</p>
            <p style={notesTextStyle}>{property.notes}</p>
          </div>
        </section>

        <section style={cameraSectionStyle} aria-labelledby="cameras-title">
          <div style={sectionTitleRowStyle}>
            <div>
              <p style={eyebrowStyle}>Property Cameras</p>
              <h2 id="cameras-title" style={sectionTitleStyle}>
                Cameras
              </h2>
            </div>
            <span style={availableStatusBadgeStyle}>
              {propertyCameras.length}{" "}
              {propertyCameras.length === 1 ? "camera" : "cameras"}
            </span>
          </div>

          <div style={cameraFormCardStyle}>
            <h3 style={subsectionTitleStyle}>Add Camera</h3>
            <CameraForm
              values={cameraValues}
              submitLabel="Add Camera"
              onChange={setCameraValues}
              onSubmit={addCamera}
            />
          </div>

          {propertyCameras.length === 0 ? (
            <p style={emptyStateStyle}>
              No cameras added for this property yet. Add the first camera
              above to start tracking checks, batteries, SD cards, and notes.
            </p>
          ) : (
            <div style={cameraListStyle}>
              {propertyCameras.map((camera) => (
                <div key={camera.id}>
                  {editingCameraId === camera.id ? (
                    <div style={editCameraCardStyle}>
                      <h3 style={subsectionTitleStyle}>Edit Camera</h3>
                      <CameraForm
                        values={editCameraValues}
                        submitLabel="Save Camera"
                        onChange={setEditCameraValues}
                        onSubmit={saveEditedCamera}
                        onCancel={cancelEditingCamera}
                      />
                    </div>
                  ) : (
                    <CameraCard camera={camera} onEdit={startEditingCamera} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={workspaceSectionStyle} aria-labelledby="workspace-title">
          <div style={sectionHeaderStyle}>
            <p style={eyebrowStyle}>Workspace</p>
            <h2 id="workspace-title" style={sectionTitleStyle}>
              Property Dashboard
            </h2>
          </div>

          <div style={workspaceGridStyle}>
            {WORKSPACE_CARDS.map((card) => (
              <article key={card.title} style={workspaceCardStyle}>
                <div style={workspaceCardHeaderStyle}>
                  <span style={iconWrapStyle}>
                    <WorkspaceIcon name={card.icon} />
                  </span>
                  <span
                    style={
                      card.status === "Available"
                        ? availableStatusBadgeStyle
                        : statusBadgeStyle
                    }
                  >
                    {card.status ?? "Coming Soon"}
                  </span>
                </div>
                <h3 style={workspaceCardTitleStyle}>{card.title}</h3>
                <p style={workspaceCardDescriptionStyle}>{card.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function createCameraFromValues({
  id,
  propertyId,
  values,
}: {
  id: string;
  propertyId: string;
  values: CameraFormValues;
}): Camera | null {
  const name = values.name.trim();

  if (!name) return null;

  const cameraType = values.cameraType;

  return {
    id,
    propertyId,
    name,
    cameraType,
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
    status: values.status,
    latitude: parseOptionalNumber(values.latitude),
    longitude: parseOptionalNumber(values.longitude),
    locationNotes: values.locationNotes.trim(),
    batteryPercent: values.batteryPercent.trim(),
    sdCardPercent: values.sdCardPercent.trim(),
    signalStrength:
      cameraType === "Cellular"
        ? optionalTrimmedValue(values.signalStrength)
        : undefined,
    carrier:
      cameraType === "Cellular"
        ? optionalTrimmedValue(values.carrier)
        : undefined,
    lastChecked: values.lastChecked,
    lastTransmission:
      cameraType === "Cellular"
        ? optionalTrimmedValue(values.lastTransmission)
        : undefined,
    notes: values.notes.trim(),
  };
}

function cameraToFormValues(camera: Camera): CameraFormValues {
  return {
    name: camera.name,
    cameraType: camera.cameraType,
    manufacturer: camera.manufacturer,
    model: camera.model,
    status: camera.status,
    latitude: camera.latitude === undefined ? "" : String(camera.latitude),
    longitude: camera.longitude === undefined ? "" : String(camera.longitude),
    locationNotes: camera.locationNotes,
    batteryPercent: camera.batteryPercent,
    sdCardPercent: camera.sdCardPercent,
    signalStrength: camera.signalStrength ?? "",
    carrier: camera.carrier ?? "",
    lastChecked: camera.lastChecked,
    lastTransmission: camera.lastTransmission ?? "",
    notes: camera.notes,
  };
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;

  const parsedValue = Number(trimmedValue);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function optionalTrimmedValue(value: string): string | undefined {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  if (name === "overview") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M5 6h14M5 12h8M5 18h14" style={iconPathStyle} />
      </svg>
    );
  }

  if (name === "map") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M9 18 4 20V6l5-2 6 2 5-2v14l-5 2-6-2Z" style={iconPathStyle} />
        <path d="M9 4v14M15 6v14" style={iconPathStyle} />
      </svg>
    );
  }

  if (name === "cameras") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M5 8h3l2-2h4l2 2h3v10H5V8Z" style={iconPathStyle} />
        <path d="M12 11.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" style={iconPathStyle} />
      </svg>
    );
  }

  if (name === "stands") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M7 20 12 4l5 16M9 13h6M8 17h8" style={iconPathStyle} />
        <path d="M10 8h4" style={iconPathStyle} />
      </svg>
    );
  }

  if (name === "huntLog") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M7 4h10v16H7V4Z" style={iconPathStyle} />
        <path d="M10 8h4M10 12h4M10 16h2" style={iconPathStyle} />
      </svg>
    );
  }

  if (name === "deerHistory") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M5 18c2.5-5 6.5-8 14-10" style={iconPathStyle} />
        <path d="M7 15c1.5.5 3 .5 4.5-.2M11 11c1 .7 2.2 1.1 3.8 1.1" style={iconPathStyle} />
        <path d="M6 6c1.8.2 3.2 1 4.2 2.3M8 4c.6 1.6 1.4 2.9 2.4 3.9" style={iconPathStyle} />
      </svg>
    );
  }

  if (name === "analytics") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M5 19V5M5 19h14" style={iconPathStyle} />
        <path d="M8 16v-4M12 16V8M16 16v-6" style={iconPathStyle} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
      <path d="M12 3v4M12 17v4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M3 12h4M17 12h4M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" style={iconPathStyle} />
      <path d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" style={iconPathStyle} />
    </svg>
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
  maxWidth: "1120px",
  margin: "0 auto",
};

const heroStyle: CSSProperties = {
  marginTop: "1rem",
  marginBottom: "1.5rem",
  padding: "1.5rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
  boxShadow: "0 18px 45px rgba(0, 0, 0, 0.24)",
};

const notFoundCardStyle: CSSProperties = {
  ...heroStyle,
  maxWidth: "680px",
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
  fontSize: "2.25rem",
  lineHeight: 1.1,
};

const mutedTextStyle: CSSProperties = {
  maxWidth: "700px",
  margin: "0.85rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.6,
};

const backTextLinkStyle: CSSProperties = {
  color: "#c6d5c5",
  fontWeight: 700,
  textDecoration: "none",
};

const backLinkStyle: CSSProperties = {
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

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const summaryCardStyle: CSSProperties = {
  padding: "1rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
};

const notesCardStyle: CSSProperties = {
  ...summaryCardStyle,
  gridColumn: "1 / -1",
};

const summaryLabelStyle: CSSProperties = {
  margin: 0,
  color: "#879486",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const summaryValueStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "#f1f5ef",
  fontSize: "1.2rem",
  fontWeight: 700,
  lineHeight: 1.3,
};

const notesTextStyle: CSSProperties = {
  margin: "0.4rem 0 0",
  color: "#c7d0c5",
  lineHeight: 1.6,
};

const cameraSectionStyle: CSSProperties = {
  marginTop: "1.75rem",
  padding: "1.25rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
};

const sectionTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  marginBottom: "1rem",
};

const cameraFormCardStyle: CSSProperties = {
  padding: "1rem",
  border: "1px solid #1e2a1e",
  borderRadius: "8px",
  background: "#0a0f0a",
};

const editCameraCardStyle: CSSProperties = {
  ...cameraFormCardStyle,
  border: "1px solid #315135",
};

const subsectionTitleStyle: CSSProperties = {
  margin: "0 0 1rem",
  fontSize: "1.05rem",
  lineHeight: 1.25,
};

const cameraListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginTop: "1rem",
};

const emptyStateStyle: CSSProperties = {
  margin: "1rem 0 0",
  padding: "1rem",
  border: "1px dashed #334533",
  borderRadius: "8px",
  background: "#0a0f0a",
  color: "#b8c2b6",
  lineHeight: 1.5,
};

const workspaceSectionStyle: CSSProperties = {
  marginTop: "1.75rem",
};

const sectionHeaderStyle: CSSProperties = {
  marginBottom: "1rem",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.35rem",
  lineHeight: 1.2,
};

const workspaceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
};

const workspaceCardStyle: CSSProperties = {
  minHeight: "190px",
  padding: "1.15rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
};

const workspaceCardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
};

const iconWrapStyle: CSSProperties = {
  display: "inline-flex",
  width: "2.5rem",
  height: "2.5rem",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #315135",
  borderRadius: "8px",
  background: "#132414",
  color: "#a7d1a6",
};

const iconStyle: CSSProperties = {
  width: "1.35rem",
  height: "1.35rem",
};

const iconPathStyle: CSSProperties = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const statusBadgeStyle: CSSProperties = {
  padding: "0.35rem 0.6rem",
  border: "1px solid #2d402d",
  borderRadius: "8px",
  background: "#101a10",
  color: "#c6d5c5",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const availableStatusBadgeStyle: CSSProperties = {
  ...statusBadgeStyle,
  border: "1px solid #3b6843",
  background: "#18351d",
  color: "#c6f0c6",
};

const workspaceCardTitleStyle: CSSProperties = {
  margin: "1rem 0 0",
  fontSize: "1.25rem",
  lineHeight: 1.25,
};

const workspaceCardDescriptionStyle: CSSProperties = {
  margin: "0.6rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.6,
};
