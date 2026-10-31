"use client";

import { useMemo } from "react";
import { useDeerIntelStore, type DeerIntelState } from "@/lib/deerIntelStore";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { useSeasonCalendar, type SeasonCalendarPrefs } from "@/lib/seasonCalendar";
import { createStatsContext, type StatsContext } from "@/lib/standStats";

// The sun / rut-phase context the insight stats need for one property: the
// property's own point (saved center, else the average of its cameras and pins)
// for legal light, and the hunter's season calendar for the rut phase.

export function statsContextForProperty(
  state: DeerIntelState,
  propertyId: string,
  seasonPrefs: SeasonCalendarPrefs,
): StatsContext {
  const property = state.properties.find((item) => item.id === propertyId) ?? null;
  const point = resolvePropertyWeatherPoint(
    property,
    state.cameras.filter((camera) => camera.propertyId === propertyId),
    state.pins.filter((pin) => pin.propertyId === propertyId),
  );
  return createStatsContext({ lat: point?.lat, lng: point?.lng, seasonPrefs });
}

export function usePropertyStatsContext(propertyId: string): StatsContext {
  const state = useDeerIntelStore();
  const seasonPrefs = useSeasonCalendar();
  return useMemo(
    () => statsContextForProperty(state, propertyId, seasonPrefs),
    [state, propertyId, seasonPrefs],
  );
}
