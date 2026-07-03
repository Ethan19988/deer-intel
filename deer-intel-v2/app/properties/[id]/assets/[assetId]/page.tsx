"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type CSSProperties } from "react";
import CameraCheckForm from "@/components/cameras/CameraCheckForm";
import CameraCheckList from "@/components/cameras/CameraCheckList";
import HuntLogList from "@/components/hunts/HuntLogList";
import PhotoRecordForm from "@/components/photos/PhotoRecordForm";
import AssetHeader from "@/components/properties/assets/AssetHeader";
import AssetPanel from "@/components/properties/assets/AssetPanel";
import RelationshipGroup from "@/components/relationships/RelationshipGroup";
import StandIntelligencePanel from "@/components/stands/StandIntelligencePanel";
import ActionCard from "@/components/ui/ActionCard";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageShell from "@/components/ui/PageShell";
import {
  createCameraCheckFromValues,
  EMPTY_CAMERA_CHECK_FORM_VALUES,
} from "@/lib/cameraCheckFormValues";
import {
  formatCameraCheckDate,
  getCameraCheckSummary,
} from "@/lib/cameraChecks";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  createPhotoRecordFromValues,
  EMPTY_PHOTO_FORM_VALUES,
} from "@/lib/photoFormValues";
import { getPhotoSummary } from "@/lib/photos";
import {
  cameraRelationshipDescription,
  getCameraRelationshipGroups,
  getStandRelationshipGroups,
  standRelationshipDescription,
  type RelationshipGroupData,
} from "@/lib/relationships";
import {
  getStandIntelligenceSummary,
  type StandIntelligenceSummary,
} from "@/lib/standIntelligence";
import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

export default function PropertyAssetWorkspacePage() {
  const params = useParams<{ id: string; assetId: string }>();
  const state = useDeerIntelStore();
  const property = state.properties.find((item) => item.id === params.id);
  const camera = state.cameras.find(
    (item) => item.id === params.assetId && item.propertyId === params.id,
  );
  const stand = state.stands.find(
    (item) => item.id === params.assetId && item.propertyId === params.id,
  );
  const [checkValues, setCheckValues] = useState(
    EMPTY_CAMERA_CHECK_FORM_VALUES,
  );
  const [photoValues, setPhotoValues] = useState(EMPTY_PHOTO_FORM_VALUES);

  if (!property) {
    return (
      <PageShell maxWidth="720px">
        <NotFoundCard
          title="Property not found"
          description="This property may have been deleted or is not saved in this browser yet."
          href="/properties"
          linkLabel="Back to Properties"
        />
      </PageShell>
    );
  }

  if (!camera && !stand) {
    return (
      <PageShell maxWidth="720px">
        <NotFoundCard
          title="Asset not found"
          description="This asset may have been deleted or moved from this property."
          href={`/properties/${property.id}`}
          linkLabel="Back to Property"
        />
      </PageShell>
    );
  }

  const propertyId = property.id;

  if (stand) {
    const propertyCameras = state.cameras.filter(
      (cameraItem) => cameraItem.propertyId === propertyId,
    );
    const propertyCameraChecks = state.cameraChecks.filter(
      (check) => check.propertyId === propertyId,
    );
    const propertyPins = state.pins.filter(
      (pin) => pin.propertyId === propertyId,
    );
    const propertyHunts = state.hunts.filter(
      (hunt) => hunt.propertyId === propertyId,
    );
    const standHunts = state.hunts.filter(
      (hunt) =>
        hunt.propertyId === propertyId &&
        (hunt.standId === stand.id ||
          (!hunt.standId &&
            hunt.standName.trim().toLowerCase() ===
              stand.name.trim().toLowerCase())),
    );
    const relationshipGroups = getStandRelationshipGroups({
      propertyId,
      stand,
      cameras: state.cameras,
      stands: state.stands,
        hunts: standHunts,
      });
    const standIntelligence = getStandIntelligenceSummary({
      stand,
      propertyId,
      cameras: propertyCameras,
      cameraChecks: propertyCameraChecks,
      hunts: propertyHunts,
      pins: propertyPins,
    });

    return (
      <StandWorkspace
        propertyId={propertyId}
        propertyName={property.name}
        stand={stand}
        hunts={standHunts}
        relationshipGroups={relationshipGroups}
        intelligence={standIntelligence}
      />
    );
  }

  if (!camera) {
    return (
      <PageShell maxWidth="720px">
        <NotFoundCard
          title="Asset not found"
          description="This asset may have been deleted or moved from this property."
          href={`/properties/${property.id}`}
          linkLabel="Back to Property"
        />
      </PageShell>
    );
  }

  const cameraId = camera.id;
  const cameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === propertyId && check.cameraId === cameraId,
  );
  const cameraPhotoRecords = state.photoRecords.filter(
    (photo) =>
      photo.propertyId === propertyId && photo.cameraSiteId === cameraId,
  );
  const propertyDeerProfiles = state.deerProfiles.filter(
    (profile) => profile.propertyId === propertyId,
  );
  const checkSummary = getCameraCheckSummary(cameraChecks);
  const latestCheck = checkSummary.latestCheck;
  const photoSummary = getPhotoSummary(cameraPhotoRecords);
  const relationshipGroups = getCameraRelationshipGroups({
    propertyId,
    camera,
    cameras: state.cameras,
    stands: state.stands,
    checks: cameraChecks,
  });

  function addCameraCheck() {
    const newCheck = createCameraCheckFromValues({
      id: createDeerIntelId("camera-check"),
      propertyId,
      cameraId,
      values: checkValues,
    });

    if (!newCheck) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      cameraChecks: [...currentState.cameraChecks, newCheck],
    }));
    setCheckValues(EMPTY_CAMERA_CHECK_FORM_VALUES);
  }

  function addPhotoRecord() {
    const newPhotoRecord = createPhotoRecordFromValues({
      id: createDeerIntelId("photo"),
      propertyId,
      cameraSiteId: cameraId,
      values: photoValues,
      cameraChecks,
    });

    if (!newPhotoRecord) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      photoRecords: [...currentState.photoRecords, newPhotoRecord],
    }));
    setPhotoValues({
      ...EMPTY_PHOTO_FORM_VALUES,
      cameraCheckId: newPhotoRecord.cameraCheckId,
    });
  }

  return (
    <PageShell>
      <Link href={`/properties/${property.id}`} style={backLinkStyle}>
        Back to Property
      </Link>

      <AssetHeader
        assetType="Camera Site"
        name={camera.name}
        propertyName={property.name}
        status={camera.status}
        description={cameraRelationshipDescription(camera)}
      >
        <AssetFact label="Type" value={camera.cameraType} />
        <AssetFact
          label="Last Check"
          value={formatCameraCheckDate(latestCheck?.date || camera.lastChecked)}
        />
        <AssetFact
          label="Checks"
          value={`${checkSummary.checkCount} saved`}
        />
        <AssetFact
          label="Battery"
          value={formatPercent(
            latestCheck?.batteryPercent || camera.batteryPercent,
          )}
        />
        <AssetFact
          label="SD Card"
          value={formatPercent(latestCheck?.sdCardPercent || camera.sdCardPercent)}
        />
      </AssetHeader>

      <section style={quickActionSectionStyle}>
        <div style={sectionHeaderStyle}>
          <p style={eyebrowStyle}>Next Steps</p>
          <h2 style={sectionTitleStyle}>Quick Actions</h2>
        </div>
        <div style={quickActionGridStyle}>
          <ActionCard
            href={`/properties/${property.id}?editCameraId=${encodeURIComponent(
              camera.id,
            )}#camera-sites`}
            title="Edit Camera Site"
            description="Go back to the property camera list to update this site."
            badge="Available"
            size="large"
            tone="primary"
          />
          <ActionCard
            href="/map"
            title="Open Map"
            description="Review this property map and nearby sign."
            badge="Available"
            size="large"
            tone="primary"
          />
          <ActionCard
            href={`/properties/${property.id}`}
            title="Back to Property"
            description="Return to the main property dashboard."
            badge="Available"
            size="large"
            tone="primary"
          />
        </div>
      </section>

      <div style={workspaceGridStyle}>
        <AssetPanel
          title="Check Summary"
          description="A quick look at what this camera site has shown so far."
        >
          <div style={summaryGridStyle}>
            <AssetFact label="Bucks" value={String(checkSummary.totalBucks)} />
            <AssetFact label="Does" value={String(checkSummary.totalDoes)} />
            <AssetFact label="Fawns" value={String(checkSummary.totalFawns)} />
            <AssetFact label="Turkeys" value={String(checkSummary.totalTurkeys)} />
            <AssetFact label="Bears" value={String(checkSummary.totalBears)} />
            <AssetFact label="Coyotes" value={String(checkSummary.totalCoyotes)} />
          </div>
        </AssetPanel>

        <AssetPanel
          title="Add Camera Check"
          description="Save what you found the last time this camera site was checked."
        >
          <CameraCheckForm
            values={checkValues}
            onChange={setCheckValues}
            onSubmit={addCameraCheck}
          />
        </AssetPanel>

        <AssetPanel
          title="Timeline"
          description="Camera Checks belong to this Camera Site and are shown in date order."
          defaultOpen={false}
        >
          <CameraCheckList
            checks={cameraChecks}
            photoRecords={cameraPhotoRecords}
            deerProfiles={propertyDeerProfiles}
          />
        </AssetPanel>

        <AssetPanel
          id="photos"
          title="Photos"
          description="Attach photo records to camera checks. Actual uploads can come later."
          defaultOpen={false}
        >
          <div style={summaryGridStyle}>
            <AssetFact
              label="Total Photo Records"
              value={String(photoSummary.totalPhotoRecords)}
            />
            <AssetFact
              label="Buck Photo Records"
              value={String(photoSummary.buckPhotoRecords)}
            />
            <AssetFact
              label="Most Recent Photo"
              value={photoSummary.mostRecentPhotoDate}
            />
          </div>

          <div style={photoFormWrapStyle}>
            {cameraChecks.length === 0 ? (
              <EmptyState description="Save a camera check first, then attach photo records to that check." />
            ) : (
              <PhotoRecordForm
                values={photoValues}
                cameraChecks={cameraChecks}
                deerProfiles={propertyDeerProfiles}
                onChange={setPhotoValues}
                onSubmit={addPhotoRecord}
              />
            )}
          </div>
        </AssetPanel>

        <AssetPanel
          title="Notes"
          description="Keep the simple field notes for this asset easy to find."
          defaultOpen={false}
        >
          <div style={notesGridStyle}>
            <NoteBlock
              label="Location Notes"
              value={camera.locationNotes || "No location notes yet."}
            />
            <NoteBlock label="Site Notes" value={camera.notes || "No notes yet."} />
          </div>
        </AssetPanel>

        <AssetPanel
          title="Relationships"
          description="Connected checks, stands, and camera sites on this property."
          defaultOpen={false}
        >
          <div style={relationshipGroupListStyle}>
            {relationshipGroups.map((group) => (
              <RelationshipGroup key={group.id} group={group} />
            ))}
          </div>
        </AssetPanel>
      </div>
    </PageShell>
  );
}

function StandWorkspace({
  propertyId,
  propertyName,
  stand,
  hunts,
  relationshipGroups,
  intelligence,
}: {
  propertyId: string;
  propertyName: string;
  stand: Stand;
  hunts: HuntLogEntry[];
  relationshipGroups: RelationshipGroupData[];
  intelligence: StandIntelligenceSummary;
}) {
  return (
    <PageShell>
      <Link href={`/properties/${propertyId}`} style={backLinkStyle}>
        Back to Property
      </Link>

      <AssetHeader
        assetType="Stand"
        name={stand.name}
        propertyName={propertyName}
        status={stand.standType}
        description={standRelationshipDescription(stand)}
      >
        <AssetFact label="Type" value={stand.standType} />
        <AssetFact label="Best Winds" value={stand.bestWinds} />
        <AssetFact label="Avoid Winds" value={stand.avoidWinds} />
      </AssetHeader>

      <section style={quickActionSectionStyle}>
        <div style={sectionHeaderStyle}>
          <p style={eyebrowStyle}>Next Steps</p>
          <h2 style={sectionTitleStyle}>Quick Actions</h2>
        </div>
        <div style={quickActionGridStyle}>
          <ActionCard
            href={`/hunt-log?propertyId=${propertyId}&standId=${stand.id}`}
            title="Log Hunt"
            description="Add hunt history for this stand."
            badge="Available"
            size="large"
            tone="primary"
          />
          <ActionCard
            href="/map"
            title="Open Map"
            description="Review this property map and nearby sign."
            badge="Available"
            size="large"
            tone="primary"
          />
          <ActionCard
            href={`/properties/${propertyId}`}
            title="Back to Property"
            description="Return to the main property dashboard."
            badge="Available"
            size="large"
            tone="primary"
          />
        </div>
      </section>

      <div style={workspaceGridStyle}>
        <AssetPanel
          title="Stand Intelligence"
          description="Simple guidance from wind notes, hunt pressure, observations, and related camera activity."
        >
          <StandIntelligencePanel propertyId={propertyId} summary={intelligence} />
        </AssetPanel>

        <AssetPanel
          title="Hunt History"
          description="Hunts for this stand will appear here."
        >
          <HuntLogList
            hunts={hunts}
            emptyDescription="No hunts logged for this stand yet."
          />
        </AssetPanel>

        <AssetPanel
          title="Wind Plan"
          description="Keep the simple wind rules easy to see in the field."
          defaultOpen={false}
        >
          <div style={summaryGridStyle}>
            <AssetFact label="Best Winds" value={stand.bestWinds} />
            <AssetFact label="Avoid Winds" value={stand.avoidWinds} />
          </div>
        </AssetPanel>

        <AssetPanel
          title="Access and Exit"
          description="How to get in and out without hurting the hunt."
          defaultOpen={false}
        >
          <div style={notesGridStyle}>
            <NoteBlock
              label="Access Route"
              value={stand.accessRouteNotes || "No access route notes yet."}
            />
            <NoteBlock
              label="Exit Route"
              value={stand.exitRouteNotes || "No exit route notes yet."}
            />
          </div>
        </AssetPanel>

        <AssetPanel
          title="Notes"
          description="Simple stand notes."
          defaultOpen={false}
        >
          <NoteBlock label="Notes" value={stand.notes || "No notes yet."} />
        </AssetPanel>

        <AssetPanel
          title="Relationships"
          description="Connected hunts, camera sites, and nearby stands."
          defaultOpen={false}
        >
          <div style={relationshipGroupListStyle}>
            {relationshipGroups.map((group) => (
              <RelationshipGroup key={group.id} group={group} />
            ))}
          </div>
        </AssetPanel>
      </div>
    </PageShell>
  );
}

function NotFoundCard({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <Card as="section" variant="elevated" style={notFoundCardStyle}>
      <p style={eyebrowStyle}>Asset Workspace</p>
      <h1 style={notFoundTitleStyle}>{title}</h1>
      <p style={notFoundTextStyle}>{description}</p>
      <Link href={href} style={primaryLinkStyle}>
        {linkLabel}
      </Link>
    </Card>
  );
}

function AssetFact({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p style={factLabelStyle}>{label}</p>
      <p style={factValueStyle}>{value || "Not set"}</p>
    </div>
  );
}

function NoteBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={factLabelStyle}>{label}</p>
      <p style={noteValueStyle}>{value}</p>
    </div>
  );
}

function formatPercent(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) return "";
  if (trimmedValue.endsWith("%")) return trimmedValue;
  if (!Number.isNaN(Number(trimmedValue))) return `${trimmedValue}%`;

  return trimmedValue;
}

const backLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  color: "#c6d5c5",
  fontWeight: 700,
  textDecoration: "none",
};

const quickActionSectionStyle: CSSProperties = {
  marginTop: "1.75rem",
};

const sectionHeaderStyle: CSSProperties = {
  marginBottom: "1rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.45rem",
  lineHeight: 1.2,
};

const quickActionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: "1rem",
};

const workspaceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1.25rem",
  marginTop: "1.75rem",
  alignItems: "start",
};

const notesGridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: "1rem",
};

const photoFormWrapStyle: CSSProperties = {
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid #1e2a1e",
};

const relationshipGroupListStyle: CSSProperties = {
  display: "grid",
  gap: "1.25rem",
};

const factLabelStyle: CSSProperties = {
  margin: 0,
  color: "#879486",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const factValueStyle: CSSProperties = {
  margin: "0.3rem 0 0",
  color: "#f1f5ef",
  lineHeight: 1.4,
};

const noteValueStyle: CSSProperties = {
  margin: "0.3rem 0 0",
  color: "#c7d0c5",
  lineHeight: 1.6,
};

const notFoundCardStyle: CSSProperties = {
  marginTop: "1rem",
  padding: "1.5rem",
};

const notFoundTitleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  fontSize: "2.35rem",
  lineHeight: 1.1,
};

const notFoundTextStyle: CSSProperties = {
  maxWidth: "640px",
  margin: "0.85rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.6,
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
