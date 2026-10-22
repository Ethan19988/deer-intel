"use client";

import { useEffect, useState, type CSSProperties } from "react";
import HuntLogForm from "@/components/hunts/HuntLogForm";
import HuntLogList from "@/components/hunts/HuntLogList";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import { StandIcon } from "@/components/ui/FieldIcons";
import PageHeader from "@/components/ui/PageHeader";
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
  newHuntFormValues,
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

    // Wait for saved data to load so the selected property is known.
    if (state.properties.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    // A link can name the property; otherwise use the one picked in the header.
    const propertyId = params.get("propertyId") || state.selectedPropertyId;
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

      // Default to "logging a sit right now" (today, current time). Set after
      // mount rather than in useState so the server render and the first
      // client render agree.
      setHuntValues((currentValues) =>
        newHuntFormValues(
          new Date(),
          propertyExists
            ? {
                propertyId,
                standId: standMatchesProperty ? standId : "",
              }
            : {
                propertyId: currentValues.propertyId,
                standId: currentValues.standId,
              },
        ),
      );

      setLoadedUrlDefaults(true);
    });

    return () => {
      didCancel = true;
    };
  }, [loadedUrlDefaults, state.properties, state.stands, state.selectedPropertyId]);

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
    setHuntValues(
      newHuntFormValues(new Date(), {
        propertyId: newHunt.propertyId,
        standId: newHunt.standId,
      }),
    );
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
    <section style={formCardStyle} aria-label="Log a sit">
      {canLogOrConvert && !loadedUrlDefaults ? (
        // One frame while today's date, time, and property fill in, instead of
        // a form that flashes blank fields.
        <div style={{ minHeight: "28rem" }} aria-busy="true" />
      ) : canLogOrConvert ? (
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
          description="Every sit is logged from a stand. Add one, then come back here to log the sit."
          action={
            <Link href="/stands#add-stand" className="di-link-btn di-link-btn--primary">
              Add a stand
            </Link>
          }
        />
      )}
    </section>
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
      <PageHeader eyebrow="Hunt log" title="Log a sit" />

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

const formCardStyle: CSSProperties = {
  maxWidth: "640px",
};
