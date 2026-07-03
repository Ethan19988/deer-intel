"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import CameraCard from "@/components/cameras/CameraCard";
import CameraIntelligenceSection from "@/components/cameras/CameraIntelligenceSection";
import ActionCard from "@/components/ui/ActionCard";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import {
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { getCameraIntelligenceSummary } from "@/lib/cameraIntelligence";
import type { Camera } from "@/types/camera";

export default function CamerasPage() {
  const router = useRouter();
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

  function selectProperty(propertyId: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: propertyId,
    }));
  }

  function editCamera(camera: Camera) {
    router.push(
      `/properties/${camera.propertyId}?editCameraId=${encodeURIComponent(
        camera.id,
      )}#camera-sites`,
    );
  }

  return (
    <PageShell>
      <Card as="section" variant="elevated" style={heroCardStyle}>
        <PageHeader
          eyebrow="Camera Sites"
          title="Cameras"
          description="Review every camera site for the active property, open camera workspaces, and jump back to the property command center to add more."
          meta={
            <>
              <Badge variant="success">Property Based</Badge>
              <Badge>{propertyCameras.length} shown</Badge>
            </>
          }
          action={
            selectedProperty ? (
              <Link
                href={`/properties/${selectedProperty.id}#camera-sites`}
                style={primaryLinkStyle}
              >
                Add Camera Site
              </Link>
            ) : null
          }
        />
      </Card>

      <Section eyebrow="Property" title="Active Property">
        {state.properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            description="Add a property before setting camera sites."
            action={
              <Link href="/properties" style={primaryLinkStyle}>
                Add Property
              </Link>
            }
          />
        ) : (
          <Card as="div" variant="subtle">
            <label style={fieldStyle}>
              <span style={labelStyle}>Choose Property</span>
              <select
                style={selectStyle}
                value={selectedPropertyId}
                onChange={(event) => selectProperty(event.target.value)}
              >
                {state.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
          </Card>
        )}
      </Section>

      <Section eyebrow="Camera Summary" title="What This Property Shows">
        <div style={statGridStyle}>
          <StatCard
            label="Camera Sites"
            value={propertyCameras.length}
            detail={`${activeCameraCount} active`}
          />
          <StatCard
            label="Camera Checks"
            value={propertyChecks.length}
            detail={`Latest: ${latestCheck?.date || "none yet"}`}
          />
          <StatCard
            label="Photo Records"
            value={propertyPhotos.length}
            detail="Saved photo history"
          />
        </div>
      </Section>

      <CameraIntelligenceSection
        propertyId={selectedPropertyId}
        propertyName={selectedProperty?.name ?? "This property"}
        summary={cameraIntelligence}
      />

      <Section eyebrow="Next Steps" title="Quick Actions">
        <div style={actionGridStyle}>
          <ActionCard
            href={selectedProperty ? `/properties/${selectedProperty.id}` : "/properties"}
            title="Open Property"
            description="Use the property command center to add cameras, stands, deer, and hunts."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/map"
            title="Open Map"
            description="Check camera pins, GPS position, and nearby property assets."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/settings"
            title="Data Settings"
            description="Review local storage status and saved Deer Intel data counts."
          />
        </div>
      </Section>

      <Section eyebrow="Saved Camera Sites" title="Camera List">
        {propertyCameras.length === 0 ? (
          <EmptyState
            title="No camera sites for this property"
            description="Open the property command center and add the first camera site with name, type, status, GPS, battery, card, and notes."
            action={
              <Link
                href={
                  selectedProperty
                    ? `/properties/${selectedProperty.id}#camera-sites`
                    : "/properties"
                }
                style={primaryLinkStyle}
              >
                Add Camera Site
              </Link>
            }
          />
        ) : (
          <div style={listStyle}>
            {propertyCameras.map((camera) => (
              <CameraCard
                key={camera.id}
                camera={camera}
                onEdit={editCamera}
              />
            ))}
          </div>
        )}
      </Section>
    </PageShell>
  );
}

function dateTime(date: string | undefined) {
  if (!date) return 0;

  const time = Date.parse(date);

  return Number.isNaN(time) ? 0 : time;
}

const heroCardStyle: CSSProperties = {
  padding: "1.5rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const labelStyle: CSSProperties = {
  color: "#85a984",
  fontSize: "0.85rem",
  fontWeight: 800,
};

const selectStyle: CSSProperties = {
  minHeight: "48px",
  width: "100%",
  padding: "0.75rem",
  border: "1px solid #2b3a2b",
  borderRadius: "8px",
  background: "#070a07",
  color: "white",
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "1rem",
};

const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.7rem 0.9rem",
  border: "1px solid #3b6843",
  borderRadius: "8px",
  background: "#18351d",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};
