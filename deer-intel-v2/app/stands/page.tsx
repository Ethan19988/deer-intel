"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import StandCard from "@/components/stands/StandCard";
import EmptyState from "@/components/ui/EmptyState";
import {
  ClipboardIcon,
  CompassIcon,
  DeerIcon,
  PlusIcon,
  StandIcon,
} from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import Tabs from "@/components/ui/Tabs";
import {
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { getStandIntelligenceSummary } from "@/lib/standIntelligence";
import {
  fetchLiveWeather,
  resolvePropertyWeatherPoint,
} from "@/lib/liveWeather";

export default function StandsPage() {
  const state = useDeerIntelStore();
  const [todayWind, setTodayWind] = useState<string>();
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

  useEffect(() => {
    if (!selectedProperty) {
      setTodayWind(undefined);
      return;
    }

    const point = resolvePropertyWeatherPoint(
      selectedProperty,
      state.cameras.filter((camera) => camera.propertyId === selectedProperty.id),
      state.pins.filter((pin) => pin.propertyId === selectedProperty.id),
    );

    if (!point) {
      setTodayWind(undefined);
      return;
    }

    let active = true;

    fetchLiveWeather(point).then((result) => {
      if (!active) return;
      setTodayWind(
        result.status === "ok" ? result.fields.windDirection : undefined,
      );
    });

    return () => {
      active = false;
    };
    // Refetch when the property changes; asset edits mid-view are rare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId]);

  function selectProperty(propertyId: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: propertyId,
    }));
  }

  if (state.properties.length === 0) {
    return (
      <PageShell>
        <header className="di-section-hero" style={headerStyle}>
          <div style={headerLeadStyle}>
            <span style={headerIconStyle} aria-hidden="true">
              <StandIcon size={24} />
            </span>
            <div style={headerTitleWrapStyle}>
              <p style={eyebrowStyle}>Stands</p>
              <h1 style={titleStyle}>Stands</h1>
            </div>
          </div>
        </header>
        <EmptyState
          illustration={<StandIcon size={30} />}
          title="No properties yet"
          description="Add a property before saving stand sites."
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
      {propertyStands.length === 0 ? (
        <EmptyState
          illustration={<StandIcon size={30} />}
          title="No stands for this property"
          description="Open the property command center to add stand type, wind notes, access, exit, and notes."
          action={
            <Link
              href={`/properties/${selectedPropertyId}#stand-sites`}
              style={primaryLinkStyle}
              className="di-navbtn"
            >
              Add Stand
            </Link>
          }
        />
      ) : (
        <>
          {todayWind ? (
            <div style={windBannerStyle}>
              <span style={windIconStyle} aria-hidden="true">
                <CompassIcon size={20} />
              </span>
              <span>
                <b>Today&apos;s wind: {todayWind}</b> — check each stand&apos;s
                wind fit below before you pick your sit.
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
                    todayWind={todayWind}
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
      <header className="di-section-hero" style={headerStyle}>
        <div style={headerLeadStyle}>
          <span style={headerIconStyle} aria-hidden="true">
            <StandIcon size={24} />
          </span>
          <div style={headerTitleWrapStyle}>
            <p style={eyebrowStyle}>Stands</p>
            <h1 style={titleStyle}>{selectedProperty?.name ?? "Stands"}</h1>
          </div>
        </div>
        <div style={headerRightStyle}>
          <label style={pickerStyle}>
            <span style={pickerLabelStyle}>Property</span>
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
          <div style={headerActionsStyle}>
            <Link href="/hunt-log" style={secondaryLinkStyle} className="di-navbtn">
              <ClipboardIcon size={17} />
              Log Hunt
            </Link>
            <Link
              href={`/properties/${selectedPropertyId}#stand-sites`}
              style={primaryLinkStyle}
              className="di-navbtn"
            >
              <PlusIcon size={17} />
              Add Stand
            </Link>
          </div>
        </div>
      </header>

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
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "0.7rem",
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

const pickerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  marginTop: "0.15rem",
};

const pickerLabelStyle: CSSProperties = {
  color: "rgba(243, 237, 217, 0.82)",
  fontSize: "0.85rem",
  fontWeight: 800,
};

const selectStyle: CSSProperties = {
  minHeight: "42px",
  minWidth: "180px",
  padding: "0.5rem 0.65rem",
  border: "1px solid rgba(243, 237, 217, 0.3)",
  borderRadius: "var(--radius-sm)",
  background: "rgba(243, 237, 217, 0.14)",
  color: "#f6efd6",
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  flexWrap: "wrap",
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
  borderRadius: "12px",
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
  borderRadius: "10px",
  background: "var(--surface)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
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
