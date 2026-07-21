"use client";

import { useEffect, useState, type CSSProperties } from "react";
import HuntLogForm from "@/components/hunts/HuntLogForm";
import HuntLogList from "@/components/hunts/HuntLogList";
import StandPinConvertList from "@/components/hunts/StandPinConvertList";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { StandIcon } from "@/components/ui/FieldIcons";
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
import { createStandFromPin, getStandPins } from "@/lib/standPins";
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
    const newStand = createStandFromPin({
      id: createDeerIntelId("stand"),
      pin,
    });

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      stands: [...currentState.stands, newStand],
    }));
    setHuntValues((currentValues) => ({
      ...currentValues,
      propertyId: newStand.propertyId,
      standId: newStand.id,
    }));
  }

  function getPropertyName(propertyId: string) {
    return (
      state.properties.find((property) => property.id === propertyId)?.name ??
      "Unknown property"
    );
  }

  const logTab = (
    <Card as="section" variant="elevated" style={formCardStyle}>
      {hasStands ? (
        <HuntLogForm
          values={huntValues}
          properties={state.properties}
          stands={state.stands}
          weatherLocation={weatherLocation}
          onChange={setHuntValues}
          onSubmit={saveHunt}
        />
      ) : standPins.length > 0 ? (
        <StandPinConvertList
          standPins={standPins}
          getPropertyName={getPropertyName}
          onConvert={convertPinToStand}
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
      <header style={headerStyle}>
        <p style={eyebrowStyle}>Hunt Log</p>
        <h1 style={titleStyle}>Hunt Log</h1>
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
  display: "grid",
  gap: "0.35rem",
  marginBottom: "1.5rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "2rem",
  lineHeight: 1.1,
};

const formCardStyle: CSSProperties = {
  padding: "1.25rem",
};
