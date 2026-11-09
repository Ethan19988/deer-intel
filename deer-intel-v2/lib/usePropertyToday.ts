"use client";

import { useEffect, useState } from "react";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import {
  fetchLiveForecast,
  resolvePropertyWeatherPoint,
  type LiveForecast,
} from "@/lib/liveWeather";
import {
  forecastAsOfLabel,
  readForecastSnapshotEntry,
  usableForecast,
  writeForecastSnapshot,
} from "@/lib/forecastSnapshot";
import { rememberSunTimes } from "@/lib/theme";
import { buildTodayVerdict } from "@/lib/todayVerdict";
import { buildHitListSlides } from "@/lib/hitListSlides";
import { useMoonPhase } from "@/lib/useMoonPhase";
import { useUnitPreferences } from "@/lib/units";
import { useSeasonCalendar, getSeasonContext } from "@/lib/seasonCalendar";
import { isBuckRecord } from "@/lib/hourlyActivity";
import { getPhotoBuckNames, photoRecordTime } from "@/lib/photos";
import type { PhotoRecord } from "@/types/photo";
import type { HeroPhoto } from "@/components/TodayVerdictHero";
import type { StripPhoto } from "@/components/CameraPhotoStrip";
import { buildStripPhotos } from "@/lib/photoStrip";

// Fixed pre-mount clock; any constant works. Keeps the server render and the
// first client render identical, then the real clock takes over.
export const HYDRATION_SAFE_NOW = new Date(2000, 0, 1, 12, 0);

/**
 * Everything "tonight on this property" needs: the live forecast, the sit
 * verdict, rut phase, moon, and the hit list. Shared by Today and the property
 * page so both show the same call for the same ground.
 */
export function usePropertyToday(propertyId: string) {
  const state = useDeerIntelStore();
  const property = state.properties.find((item) => item.id === propertyId);
  const cameras = state.cameras.filter((camera) => camera.propertyId === propertyId);
  const stands = state.stands.filter((stand) => stand.propertyId === propertyId);
  const pins = state.pins.filter((pin) => pin.propertyId === propertyId);
  const hunts = state.hunts.filter((hunt) => hunt.propertyId === propertyId);
  const photoRecords = state.photoRecords.filter((photo) => photo.propertyId === propertyId);

  const weatherPoint = resolvePropertyWeatherPoint(property ?? null, cameras, pins);
  const weatherKey = weatherPoint ? `${weatherPoint.lat},${weatherPoint.lng}` : "";

  const units = useUnitPreferences();
  const tempUnit = units.temperature;
  const windUnit = units.wind;
  const seasonPrefs = useSeasonCalendar();
  const moon = useMoonPhase();

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Intentional client-only seed: `now` starts null so server and first
    // client render match, then the real clock is set on mount and ticked
    // each minute.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // The forecast in use, which spot/units it's for, when it was fetched, and
  // whether it came from the saved snapshot (no live fetch has landed yet).
  const [forecastState, setForecastState] = useState<{
    key: string;
    forecast: LiveForecast;
    savedAt: number;
    fromSnapshot: boolean;
  } | null>(null);
  // Changes every 20 minutes; drives a forecast refresh (the cache expires on
  // the same schedule and at midnight).
  const weatherSlot = now ? Math.floor(now.getTime() / (20 * 60 * 1000)) : 0;
  useEffect(() => {
    if (!weatherKey) {
      // Clear a stale forecast when the property has no weather point.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForecastState(null);
      return;
    }

    const [lat, lng] = weatherKey.split(",").map(Number);
    let active = true;
    const snapshotKey = `${weatherKey}|${tempUnit}|${windUnit}`;

    // Show the last forecast for this spot right away so the verdict isn't
    // blank while the fetch runs (or when there's no signal at all). A
    // forecast already showing for this spot is kept unless the snapshot is
    // newer; another spot's forecast is dropped.
    const snapshot = readForecastSnapshotEntry(snapshotKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForecastState((prev) => {
      const prevForSpot = prev && prev.key === snapshotKey ? prev : null;
      if (snapshot && (!prevForSpot || snapshot.savedAt > prevForSpot.savedAt)) {
        return { key: snapshotKey, ...snapshot, fromSnapshot: true };
      }
      return prevForSpot;
    });

    fetchLiveForecast({ lat, lng }, { temperature: tempUnit, wind: windUnit }).then(
      (result) => {
        if (!active) return;
        if (result.status === "ok") {
          // One timestamp for both, so the next refresh doesn't mistake its
          // own saved copy for a newer snapshot.
          const savedAt = Date.now();
          setForecastState({
            key: snapshotKey,
            forecast: result.forecast,
            savedAt,
            fromSnapshot: false,
          });
          writeForecastSnapshot(snapshotKey, result.forecast, savedAt);
          // Lets the "Follow daylight" theme track this property's day length.
          rememberSunTimes(result.forecast.sunriseIso, result.forecast.sunsetIso);
        }
        // A failed fetch (no signal in the woods) never clears the forecast
        // already showing; it ages out via usableForecast below.
      },
    );

    return () => {
      active = false;
    };
    // weatherSlot re-runs this every 20 minutes (and when the phone wakes
    // the minute tick), so wind and the cold-front cue stay current.
  }, [weatherKey, tempUnit, windUnit, weatherSlot]);

  // Roll a held forecast forward past midnight (yesterday's day dropped) and
  // let it lapse after the last day it covers.
  const forecast = forecastState
    ? now
      ? usableForecast(forecastState.forecast, forecastState.savedAt, now.getTime())
      : forecastState.forecast
    : null;
  // "Forecast as of 6:12 AM" when the call rests on a saved or aging forecast.
  const forecastSavedAt = forecast && forecastState ? forecastState.savedAt : null;
  const forecastAsOf =
    forecast && forecastState && now
      ? forecastAsOfLabel(forecastState.savedAt, now.getTime(), forecastState.fromSnapshot)
      : null;

  // HYDRATION_SAFE_NOW on the server/first render so the rut ribbon's
  // "peak in N days" matches between server HTML and the client.
  const seasonCtx = getSeasonContext(now ?? HYDRATION_SAFE_NOW, seasonPrefs, property?.latitude);
  const verdict = buildTodayVerdict({
    now: now ?? HYDRATION_SAFE_NOW,
    forecast,
    stands,
    hunts,
    pins,
    rutLabel: seasonCtx.phaseLabel,
    rutActive: ["seeking", "chasing", "peak"].includes(seasonCtx.phase),
  });

  // The forecast column for the next sit, highlighted in the wind grid.
  const forecastDays = forecast?.days ?? [];
  const activeSitKey =
    verdict.period === "tomorrow"
      ? forecastDays[1] && `${forecastDays[1].date}-AM`
      : forecastDays[0] &&
        `${forecastDays[0].date}-${verdict.period === "morning" ? "AM" : "PM"}`;

  const hitListSlides = property
    ? buildHitListSlides({
        propertyId: property.id,
        propertyName: property.name,
        profiles: state.deerProfiles,
        photos: state.photoRecords,
        cameras: state.cameras,
        cameraChecks: state.cameraChecks,
        hunts: state.hunts,
        pins: state.pins,
      })
    : [];

  // Newest photos first; the hero leads with the latest buck (else any deer).
  const cameraName = (cameraId: string) =>
    cameras.find((camera) => camera.id === cameraId)?.name ?? "Camera";
  const photoDateLabel = (photo: PhotoRecord) => {
    const time = photoRecordTime(photo);
    return time
      ? new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";
  };
  const recentPhotos = photoRecords
    .filter((photo) => Boolean(photo.imageId))
    .sort((a, b) => photoRecordTime(b) - photoRecordTime(a));
  const heroSource = recentPhotos.find(isBuckRecord) ?? recentPhotos[0];
  const heroPhoto: HeroPhoto | null = heroSource?.imageId
    ? {
        imageId: heroSource.imageId,
        caption: `${getPhotoBuckNames(heroSource)[0] ?? heroSource.species ?? "Deer"} on ${cameraName(heroSource.cameraSiteId)}`,
        dateLabel: photoDateLabel(heroSource),
      }
    : null;

  const stripPhotos: StripPhoto[] = buildStripPhotos(photoRecords, cameras);

  return {
    heroPhoto,
    stripPhotos,
    weatherPoint,
    weatherKey,
    forecast,
    forecastSavedAt,
    forecastAsOf,
    now,
    moon,
    seasonCtx,
    verdict,
    activeSitKey,
    hitListSlides,
  };
}
