"use client";

import { useEffect, useState, type CSSProperties } from "react";
import HuntLogForm from "@/components/hunts/HuntLogForm";
import HuntLogList from "@/components/hunts/HuntLogList";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { ClipboardIcon, StandIcon } from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import Tabs from "@/components/ui/Tabs";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  createHuntFromValues,
  EMPTY_HUNT_FORM_VALUES,
} from "@/lib/huntFormValues";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { createStandFromPin, findStandForPin, getStandPins } from "@/lib/standPins";
import type { MapPin } from "@/types/mapPin";

export default function HuntLogPage() {
  const state = useDeerIntelStore();
  const [huntValues, setHuntValues] = useState(EMPTY_HUNT_FORM_VALUES);
  const [loadedUrlDefaults, setLoadedUrlDefaults] = useState(false);
  const hasStands = state.stands.length > 0;
  const standPins = getStandPins(state.pins);
  const weatherLocation = resolvePropertyWeatherPoint(
    state.properties.find(
      (property) => property.id === huntValues.propertyId,
    ),
    state.cameras.filter(
      (camera) => camera.propertyId === huntValues.propertyId,
    ),
    state.pins.filter((pin) => pin.propertyId === huntValues.propertyId),
  );

  useEffect(() => {
    if (loadedUrlDefaults || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const propertyId = params.get("propertyId") ?? "";
    const standId = params.get("standId") ?? "";
    const propertyExists = state.properties.some(
      (property) => property.id === propertyId,
    );
    const standMatchesProperty = state.stands.some(
      (stand) => stand.id === standId && stand.propertyId === propertyId,
    );

    let didCancel = false;

    queueMicrotask(() => {
      if (didCancel) return;

      if (propertyExists) {
        setHuntValues((currentValues) => ({
          ...currentValues,
          propertyId,
          standId: standMatchesProperty ? standId : "",
        }));
      }

      setLoadedUrlDefaults(true);
    });

    return () => {
      didCancel = true;
    };
  }, [loadedUrlDefaults, state.properties, state.stands]);

  function saveHunt() {
    const newHunt = createHuntFromValues({
      id: createDeerIntelId("hunt"),
      values: huntValues,
      stands: state.stands,
    });

    if (!newHunt) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      hunts: [...currentState.hunts, newHunt],
    }));
    setHuntValues({
      ...EMPTY_HUNT_FORM_VALUES,
      propertyId: newHunt.propertyId,
      standId: newHunt.standId,
    });
  }

  function convertPinToStand(pin: MapPin) {
    // A double-tap (common on mobile before the list re-renders) must not save
    // the same pin as a stand twice — reuse the existing stand if there is one.
    const existingStand = findStandForPin(state.stands, pin.id);

    if (existingStand) {
      setHuntValues((currentValues) => ({
        ...currentValues,
        propertyId: existingStand.propertyId,
        standId: existingStand.id,
      }));
      return;
    }

    const newStand = createStandFromPin({
      id: createDeerIntelId("stand"),
      pin,
    });

    // Guard against double-taps: if this pin was already promoted (even by a
    // tap that hasn't re-rendered yet), reuse that stand instead of adding a
    // duplicate. The check runs inside the updater so it sees the latest state.
    let standIdToSelect = newStand.id;

    updateDeerIntelStore((currentState) => {
      const alreadyPromoted = findStandForPin(currentState.stands, pin.id);

      if (alreadyPromoted) {
        standIdToSelect = alreadyPromoted.id;
        return currentState;
      }

      return {
        ...currentState,
        stands: [...currentState.stands, newStand],
      };
    });

    setHuntValues((currentValues) => ({
      ...currentValues,
      propertyId: newStand.propertyId,
      standId: standIdToSelect,
    }));
  }

  function getPropertyName(propertyId: string) {
    return (
      state.properties.find((property) => property.id === propertyId)?.name ??
      "Unknown property"
    );
  }

  const canLogOrConvert = hasStands || standPins.length > 0;

  const logTab = (
    <Card as="section" variant="elevated" style={formCardStyle}>
      {canLogOrConvert ? (
        <HuntLogForm
          values={huntValues}
          properties={state.properties}
          stands={state.stands}
          standPins={standPins}
          weatherLocation={weatherLocation}
          getPropertyName={getPropertyName}
          onConvertPin={convertPinToStand}
          onChange={setHuntValues}
          onSubmit={saveHunt}
        />
      ) : (
        <EmptyState
          illustration={<StandIcon size={30} />}
          title="Add a stand first"
          description="Hunts need a stand. Open a property, add a stand, then come back here to log the sit."
        />
      )}
    </Card>
  );

  const historyTab = (
    <HuntLogList
      hunts={state.hunts}
      getPropertyName={getPropertyName}
      emptyDescription="No hunts logged yet. Save your first sit from the Log a sit tab."
    />
  );

  return (
    <PageShell>
      <header className="di-section-hero" style={headerStyle}>
        <span style={headerIconStyle} aria-hidden="true">
          <ClipboardIcon size={24} />
        </span>
        <div style={headerTitleWrapStyle}>
          <p style={eyebrowStyle}>Hunt Log</p>
          <h1 style={titleStyle}>Hunt Log</h1>
        </div>
      </header>

      <Tabs
        items={[
          { id: "log", label: "Log a sit", content: logTab },
          {
            id: "history",
            label: "History",
            badge: state.hunts.length,
            content: historyTab,
          },
        ]}
      />
    </PageShell>
  );
}

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.85rem",
  marginBottom: "1.5rem",
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

const formCardStyle: CSSProperties = {
  padding: "1.25rem",
};
