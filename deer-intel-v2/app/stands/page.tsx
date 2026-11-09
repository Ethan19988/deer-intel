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
  PlusIcon,
  StandIcon,
} from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Section from "@/components/ui/Section";
import {
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { getStandIntelligenceSummary } from "@/lib/standIntelligence";
import { sitWindLabel } from "@/lib/todayVerdict";
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

  // Grade stands on the next sit's forecast wind, the same wind Today's
  // verdict and dial use (not the wind blowing right now).
  const { verdict } = usePropertyToday(selectedPropertyId);
  const sitWind = verdict.wind;
  const sitWindSpeed = verdict.windSpeed;
  const sitLabel = sitWindLabel(verdict.period);
  // List stands in the verdict's next-sit ranking (best sit first), the same
  // order as Today's Stand check; any stand it hasn't graded keeps its place
  // at the end.
  const rankById = new Map(
    verdict.check.rows.map((row, index) => [row.stand.id, index]),
  );
  const rankedStands = [...propertyStands].sort(
    (a, b) =>
      (rankById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (rankById.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const pickStandId = verdict.check.pick?.stand.id;

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

  const sitesView = (
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
      {/* With no stands the add form above is already open, so it stands in
          for an empty state ("Add your first stand above" just repeated it). */}
      {propertyStands.length === 0 ? null : (
        <>
          {sitWind ? (
            <div style={windBannerStyle}>
              <span style={windIconStyle} aria-hidden="true">
                <CompassIcon size={20} />
              </span>
              <span>
                {sitLabel}: {sitWind}
                {sitWindSpeed ? ` ${sitWindSpeed.replace(/\s*mph$/i, "")}` : ""}
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
              {rankedStands.map((stand) => {
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
                    bestSit={stand.id === pickStandId}
                  />
                );
              })}
            </div>
          </Section>
        </>
      )}
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
              Log sit
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

      {sitesView}
    </PageShell>
  );
}

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
