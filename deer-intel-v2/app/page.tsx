"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import LiveWeatherPanel from "@/components/weather/LiveWeatherPanel";
import PropertyPatternReport from "@/components/properties/PropertyPatternReport";
import { buildPropertyPatternReport } from "@/lib/propertyPatterns";
import MovementScorePanel from "@/components/weather/MovementScorePanel";
import WindCompass from "@/components/weather/WindCompass";
import MoonPhaseCard from "@/components/weather/MoonPhaseCard";
import Barometer from "@/components/weather/Barometer";
import RutRibbon from "@/components/season/RutRibbon";
import HuntConditionAlerts from "@/components/HuntConditionAlerts";
import ColdFrontBanner from "@/components/ColdFrontBanner";
import StandWindGrid from "@/components/StandWindGrid";
import BuckSlideshow from "@/components/BuckSlideshow";
import { buildHitListSlides } from "@/lib/hitListSlides";
import DeerHoursChart from "@/components/DeerHoursChart";
import {
  ACTIVITY_WINDOW_DAYS,
  buildHourlyActivity,
  isBuckRecord,
} from "@/lib/hourlyActivity";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  fetchRegionalActivity,
  regionForPoint,
  type RegionalActivity,
} from "@/lib/sharedSightings";
import StandCheckPanel from "@/components/StandCheckPanel";
import TodayVerdictHero, { type HeroPhoto } from "@/components/TodayVerdictHero";
import ConditionsStrip from "@/components/ConditionsStrip";
import CameraPhotoStrip, { type StripPhoto } from "@/components/CameraPhotoStrip";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { useMoonPhase } from "@/lib/useMoonPhase";
import { rememberSunTimes } from "@/lib/theme";
import { buildTodayVerdict } from "@/lib/todayVerdict";
import { getPhotoBuckNames, photoRecordTime } from "@/lib/photos";
import type { PhotoRecord } from "@/types/photo";
import BackupReminderBanner from "@/components/BackupReminderBanner";
import SetupChecklist from "@/components/SetupChecklist";
import { buildSetupChecklist } from "@/lib/setupChecklist";
import { countRecords } from "@/lib/backupReminder";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import {
  fetchLiveForecast,
  resolvePropertyWeatherPoint,
  type LiveForecast,
} from "@/lib/liveWeather";
import { useUnitPreferences } from "@/lib/units";
import { useSeasonCalendar, getSeasonContext } from "@/lib/seasonCalendar";
import { getHuntPlannerSummary } from "@/lib/huntPlanner";

// Fixed pre-mount clock (see verdict below); any constant works.
const HYDRATION_SAFE_NOW = new Date(2000, 0, 1, 12, 0);
// Below this many of your own timed photos, the regional pattern is shown.
const OWN_PHOTOS_FOR_CHART = 15;

export default function Home() {
  const state = useDeerIntelStore();
  const planner = getHuntPlannerSummary(state);
  const recommendedProperty = planner.recommendedProperty.property;
  const activeProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ??
    recommendedProperty ??
    state.properties[0];
  const activePropertyId = activeProperty?.id ?? "";
  const propertyCameras = state.cameras.filter(
    (camera) => camera.propertyId === activePropertyId,
  );
  const propertyStands = state.stands.filter(
    (stand) => stand.propertyId === activePropertyId,
  );
  const propertyPins = state.pins.filter(
    (pin) => pin.propertyId === activePropertyId,
  );
  const propertyHunts = state.hunts.filter(
    (hunt) => hunt.propertyId === activePropertyId,
  );
  const propertyCameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === activePropertyId,
  );
  const propertyPhotoRecords = state.photoRecords.filter(
    (photo) => photo.propertyId === activePropertyId,
  );
  const patternReport = buildPropertyPatternReport(
    propertyHunts,
    propertyCameraChecks,
    propertyCameras,
    propertyPhotoRecords,
  );
  const hasPatternSignal =
    patternReport.conditionInsights.length > 0 || Boolean(patternReport.hottestCamera);
  const weatherPoint = resolvePropertyWeatherPoint(
    activeProperty ?? null,
    propertyCameras,
    propertyPins,
  );
  const weatherKey = weatherPoint
    ? `${weatherPoint.lat},${weatherPoint.lng}`
    : "";
  const [forecast, setForecast] = useState<LiveForecast | null>(null);
  const { user } = useAuth();
  const [regionalActivity, setRegionalActivity] = useState<RegionalActivity | null>(null);

  // Regional pattern from shared, anonymous sightings (signed-in accounts).
  useEffect(() => {
    const client = getSupabaseClient();
    if (!user || !client || !weatherKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRegionalActivity(null);
      return;
    }
    const [lat, lng] = weatherKey.split(",").map(Number);
    let active = true;
    regionForPoint(lat, lng)
      .then((region) => fetchRegionalActivity(client, region, ACTIVITY_WINDOW_DAYS))
      .then((activity) => {
        if (active) setRegionalActivity(activity);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user, weatherKey]);
  const units = useUnitPreferences();
  const seasonPrefs = useSeasonCalendar();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Intentional client-only seed: `now` starts null so server and first
    // client render match (no hydration mismatch), then the real clock is set
    // once on mount and ticked each minute. This one-time post-mount set is by
    // design, not a cascading-render bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const tempUnit = units.temperature;
  const windUnit = units.wind;

  useEffect(() => {
    if (!weatherKey) {
      // Clear a stale forecast when the active property has no weather point.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForecast(null);
      return;
    }

    const [lat, lng] = weatherKey.split(",").map(Number);
    let active = true;

    fetchLiveForecast(
      { lat, lng },
      { temperature: tempUnit, wind: windUnit },
    ).then((result) => {
      if (!active) return;
      setForecast(result.status === "ok" ? result.forecast : null);
      // Lets the "Follow daylight" theme track this property's real day length.
      if (result.status === "ok") {
        rememberSunTimes(result.forecast.sunriseIso, result.forecast.sunsetIso);
      }
    });

    return () => {
      active = false;
    };
  }, [weatherKey, tempUnit, windUnit]);

  const currentWind = forecast?.current.windDirection;
  const seasonCtx = getSeasonContext(now ?? new Date(), seasonPrefs, activeProperty?.latitude);
  const moon = useMoonPhase();
  // Before mount `now` is null; a fixed stand-in keeps the server render and
  // the first client render identical, then the real clock takes over.
  const verdict = buildTodayVerdict({
    now: now ?? HYDRATION_SAFE_NOW,
    forecast,
    stands: propertyStands,
    hunts: propertyHunts,
    pins: propertyPins,
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
  const hourlyActivity = buildHourlyActivity(
    propertyPhotoRecords,
    now ?? HYDRATION_SAFE_NOW,
  );
  // Until this property has a real sample of its own timed photos, show the
  // anonymous regional pattern (when there's enough of one).
  const chartActivity =
    hourlyActivity.total < OWN_PHOTOS_FOR_CHART && regionalActivity
      ? regionalActivity
      : hourlyActivity;

  const hitListSlides = activeProperty
    ? buildHitListSlides({
        propertyId: activeProperty.id,
        propertyName: activeProperty.name,
        profiles: state.deerProfiles,
        photos: state.photoRecords,
        cameras: state.cameras,
        cameraChecks: state.cameraChecks,
        hunts: state.hunts,
        pins: state.pins,
      })
    : [];

  const cameraName = (cameraId: string) =>
    propertyCameras.find((camera) => camera.id === cameraId)?.name ?? "Camera";
  const recentPhotos = propertyPhotoRecords
    .filter((photo) => Boolean(photo.imageId))
    .sort((a, b) => photoRecordTime(b) - photoRecordTime(a));
  const isBuckPhoto = isBuckRecord;
  const photoDateLabel = (photo: PhotoRecord) => {
    const time = photoRecordTime(photo);
    return time
      ? new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";
  };
  const heroSource = recentPhotos.find(isBuckPhoto) ?? recentPhotos[0];
  const heroPhoto: HeroPhoto | null = heroSource?.imageId
    ? {
        imageId: heroSource.imageId,
        caption: `${getPhotoBuckNames(heroSource)[0] ?? heroSource.species ?? "Deer"} on ${cameraName(heroSource.cameraSiteId)}`,
        dateLabel: photoDateLabel(heroSource),
      }
    : null;
  const stripPhotos: StripPhoto[] = recentPhotos.slice(0, 8).map((photo) => ({
    id: photo.id,
    imageId: photo.imageId!,
    title: getPhotoBuckNames(photo)[0] ?? (photo.species || "Deer"),
    subtitle: [cameraName(photo.cameraSiteId), photoDateLabel(photo)]
      .filter(Boolean)
      .join(", "),
    href: `/properties/${photo.propertyId}/assets/${photo.cameraSiteId}#photos`,
    isBuck: isBuckPhoto(photo),
  }));

  return (
    <PageShell maxWidth="980px">
      <HuntConditionAlerts
        propertyName={activeProperty?.name ?? "This property"}
        point={weatherPoint}
        stands={propertyStands}
      />
      <BackupReminderBanner
        currentRecordCount={countRecords(state)}
        nowMs={now ? now.getTime() : null}
      />
      <ColdFrontBanner
        propertyName={activeProperty?.name ?? "this property"}
        pressure={forecast?.pressure}
      />
      {activeProperty ? (
        <SetupChecklist
          propertyName={activeProperty.name}
          items={buildSetupChecklist({
            property: activeProperty,
            stands: propertyStands,
            cameras: propertyCameras,
            pins: propertyPins,
          })}
        />
      ) : null}
      <TodayVerdictHero
        verdict={verdict}
        propertyName={activeProperty?.name ?? "Your ground"}
        photo={heroPhoto}
      />

      <div style={todayStackStyle}>
        <ConditionsStrip
          windDirection={forecast?.current.windDirection}
          windSpeed={forecast?.current.windSpeed}
          temperature={forecast?.current.temperature}
          conditions={forecast?.current.weather}
          moon={moon}
          pressure={forecast?.pressure}
        />

        <BuckSlideshow slides={hitListSlides} />

        <RutRibbon
          phase={seasonCtx.phase}
          phaseLabel={seasonCtx.phaseLabel}
          daysToPeak={seasonCtx.daysToPeak}
        />

        <StandCheckPanel
          check={verdict.check}
          wind={verdict.wind}
          whenLabel={verdict.periodLabel}
        />
        <StandWindGrid
          days={forecast?.days ?? []}
          stands={propertyStands}
          activeKey={activeSitKey}
        />

        <DeerHoursChart
          activity={chartActivity}
          regional={
            chartActivity === regionalActivity && regionalActivity
              ? {
                  regionLabel: regionalActivity.regionLabel,
                  contributors: regionalActivity.contributors,
                }
              : undefined
          }
          sunriseHour={isoHour(forecast?.sunriseIso)}
          sunsetHour={isoHour(forecast?.sunsetIso)}
          nowHour={now ? now.getHours() + now.getMinutes() / 60 : undefined}
        />

        <CameraPhotoStrip
          photos={stripPhotos}
          allHref={activeProperty ? "/cameras" : "/properties"}
        />

        <Card as="section" variant="subtle" style={conditionsCardStyle}>
          <CollapsibleSection
            title="All conditions"
            description="Forecast, wind compass, moon, barometer, and movement score"
            variant="bare"
          >
            <LiveWeatherPanel
              point={weatherPoint}
              emptyHint={
                activeProperty
                  ? "Add map pins or a camera location to this property to load live weather."
                  : "Set up a property with map pins to load live weather."
              }
            />
            <div style={instrumentsRowStyle}>
              <WindCompass
                wind={currentWind}
                windSpeed={forecast?.current.windSpeed}
                stands={propertyStands}
              />
              <MoonPhaseCard />
              <Barometer pressure={forecast?.pressure} />
            </div>
            <MovementScorePanel point={weatherPoint} />
          </CollapsibleSection>
        </Card>
      </div>

      {activeProperty && hasPatternSignal ? (
        <Section eyebrow="Patterns" title="What's Been Working">
          <PropertyPatternReport report={patternReport} limit={2} />
        </Section>
      ) : null}

    </PageShell>
  );
}

/** Fractional local hour from an Open-Meteo "YYYY-MM-DDTHH:MM" time. */
function isoHour(iso: string | undefined): number | undefined {
  const [h, m] = (iso?.split("T")[1] ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h + m / 60 : undefined;
}

const todayStackStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  margin: "1rem 0 2rem",
};

const conditionsCardStyle: CSSProperties = {
  padding: "0.25rem 1rem",
};

const instrumentsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
  gap: "0.8rem",
  margin: "1rem 0",
};

