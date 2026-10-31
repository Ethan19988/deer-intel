"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import AddStandCard from "@/components/stands/AddStandCard";
import StandCard from "@/components/stands/StandCard";
import { findLikelyDuplicateStands } from "@/lib/standDuplicates";
import { useAddFormRequest } from "@/lib/useAddFormRequest";
import EmptyState from "@/components/ui/EmptyState";
import {
  ClipboardIcon,
  CompassIcon,
  DeerIcon,
  PlusIcon,
  StandIcon,
} from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import Tabs from "@/components/ui/Tabs";
import {
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { getStandIntelligenceSummary } from "@/lib/standIntelligence";
import type { SitPeriodKey } from "@/lib/todayVerdict";
import { usePropertyToday } from "@/lib/usePropertyToday";

export default function StandsPage() {
  const state = useDeerIntelStore();
  const addForm = useAddFormRequest("add-stand");
  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const selectedPropertyId = selectedProperty?.id ?? "";
  const propertyStands = state.stands.filter(
    (stand) => stand.propertyId === selectedPropertyId,
  );
  const propertyHunts = state.hunts.filter(
    (hunt) => hunt.propertyId === selectedPropertyId,
  );
  const propertyCameras = state.cameras.filter(
    (camera) => camera.propertyId === selectedPropertyId,
  );
  const propertyCameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === selectedPropertyId,
  );
  const propertyPins = state.pins.filter(
    (pin) => pin.propertyId === selectedPropertyId,
  );
  const huntedStandIds = new Set(
    propertyHunts.map((hunt) => hunt.standId).filter(Boolean),
  );
  const huntedStandCount = propertyStands.filter((stand) =>
    huntedStandIds.has(stand.id),
  ).length;
  const standsWithWindNotes = propertyStands.filter(
    (stand) => stand.bestWinds.trim() || stand.avoidWinds.trim(),
  ).length;

  // Grade stands on the next sit's forecast wind, the same wind Today's
  // verdict and dial use (not the wind blowing right now).
  const { verdict } = usePropertyToday(selectedPropertyId);
  const sitWind = verdict.wind;
  const sitWindSpeed = verdict.windSpeed;
  const sitWindLabel = SIT_WIND_LABEL[verdict.period];

  const likelyDuplicateIds = findLikelyDuplicateStands(propertyStands);

  // Removes the stand only. Hunts keep their saved stand name, and a map pin
  // the stand came from stays on the map.
  function deleteStand(standId: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      stands: currentState.stands.filter((stand) => stand.id !== standId),
    }));
  }

  function saveStandWinds(
    standId: string,
    winds: { bestWinds: string; avoidWinds: string },
  ) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      stands: currentState.stands.map((stand) =>
        stand.id === standId ? { ...stand, ...winds } : stand,
      ),
    }));
  }


  if (state.properties.length === 0) {
    return (
      <PageShell>
        <PageHeader eyebrow="Tree stands & blinds" title="Stands" />
        <EmptyState
          illustration={<StandIcon size={30} />}
          title="No properties yet"
          description="Add a property before saving stand sites."
          action={
            <Link href="/properties" className="di-link-btn di-link-btn--primary">
              Add property
            </Link>
          }
        />
      </PageShell>
    );
  }

  const sitesTab = (
    <div style={listStyle}>
      {/* The header's "Add stand" opens this; it isn't a standing card. */}
      {addForm.requested || propertyStands.length === 0 ? (
        <AddStandCard
          key={selectedPropertyId}
          propertyId={selectedPropertyId}
          propertyName={selectedProperty?.name ?? "this property"}
          defaultOpen
        />
      ) : null}
      {propertyStands.length === 0 ? (
        <EmptyState
          illustration={<StandIcon size={30} />}
          title="No stands for this property"
          description="Add your first stand above with its type, best and avoid winds, and access and exit notes."
        />
      ) : (
        <>
          {sitWind ? (
            <div style={windBannerStyle}>
              <span style={windIconStyle} aria-hidden="true">
                <CompassIcon size={20} />
              </span>
              <span>
                <b>
                  {sitWindLabel}: {sitWind}
                  {sitWindSpeed ? ` ${sitWindSpeed}` : ""}
                </b>{" "}
                — check each stand&apos;s wind fit below before you pick your
                sit.
              </span>
            </div>
          ) : null}

          <Section
            eyebrow="On this property"
            title="Stand Sites"
            icon={<StandIcon size={18} />}
            style={sectionStyle}
          >
            <div style={listStyle}>
              {propertyStands.map((stand) => {
                const intelligence = getStandIntelligenceSummary({
                  stand,
                  propertyId: selectedPropertyId,
                  cameras: propertyCameras,
                  cameraChecks: propertyCameraChecks,
                  hunts: propertyHunts,
                  pins: propertyPins,
                });

                return (
                  <StandCard
                    key={stand.id}
                    stand={stand}
                    intelligence={intelligence}
                    todayWind={sitWind}
                    todayWindSpeed={sitWindSpeed}
                    onSaveWinds={saveStandWinds}
                    pins={propertyPins}
                    onDelete={deleteStand}
                    likelyDuplicate={likelyDuplicateIds.has(stand.id)}
                  />
                );
              })}
            </div>
          </Section>
        </>
      )}
    </div>
  );

  const activityTab = (
    <div style={statGridStyle}>
      <StatCard
        label="Stand Sites"
        value={propertyStands.length}
        detail="Saved stand locations"
        icon={<StandIcon size={18} />}
        tone="green"
      />
      <StatCard
        label="Hunted Stands"
        value={huntedStandCount}
        detail={`${propertyHunts.length} hunts logged`}
        icon={<DeerIcon size={18} />}
        tone="blaze"
      />
      <StatCard
        label="Wind Notes"
        value={standsWithWindNotes}
        detail="Stands with wind guidance"
        icon={<CompassIcon size={18} />}
        tone="neutral"
      />
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow={selectedProperty?.name ?? "On this property"}
        title="Stands"
        meta={
          propertyStands.length > 0
            ? `${propertyStands.length} sites · ${huntedStandCount} hunted · ${propertyHunts.length} sits`
            : undefined
        }
        action={
          <>
            <Link href="/hunt-log" className="di-link-btn">
              <ClipboardIcon size={16} />
              Log hunt
            </Link>
            <a
              href="#add-stand"
              className="di-link-btn di-link-btn--primary"
              onClick={(event) => {
                event.preventDefault();
                addForm.request();
              }}
            >
              <PlusIcon size={16} />
              Add stand
            </a>
          </>
        }
      />

      <Tabs
        items={[
          {
            id: "sites",
            label: "Sites",
            badge: propertyStands.length,
            content: sitesTab,
          },
          { id: "activity", label: "Activity", content: activityTab },
        ]}
      />
    </PageShell>
  );
}

// Which sit the banner's wind is for, matching the Today verdict and dial.
const SIT_WIND_LABEL: Record<SitPeriodKey, string> = {
  morning: "Morning sit wind",
  evening: "Tonight's sit wind",
  tomorrow: "Tomorrow AM sit wind",
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
  gap: "1rem",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const sectionStyle: CSSProperties = {
  marginTop: "0.25rem",
};

const windBannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.7rem",
  padding: "0.85rem 1rem",
  border: "1px solid var(--accent-tint-border)",
  borderLeft: "4px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  fontWeight: 700,
  lineHeight: 1.5,
};

const windIconStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.1rem",
  height: "2.1rem",
  flex: "none",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
};
