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
import DeerHoursChart from "@/components/DeerHoursChart";
import {
  ACTIVITY_WINDOW_DAYS,
  buildHourlyActivity,
} from "@/lib/hourlyActivity";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  fetchRegionalActivity,
  regionForPoint,
  type RegionalActivity,
} from "@/lib/sharedSightings";
import StandCheckPanel from "@/components/StandCheckPanel";
import TodayVerdictHero from "@/components/TodayVerdictHero";
import ConditionsStrip from "@/components/ConditionsStrip";
import CameraPhotoStrip from "@/components/CameraPhotoStrip";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import BackupReminderBanner from "@/components/BackupReminderBanner";
import SetupChecklist from "@/components/SetupChecklist";
import { buildSetupChecklist } from "@/lib/setupChecklist";
import { countRecords } from "@/lib/backupReminder";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { getHuntPlannerSummary } from "@/lib/huntPlanner";
import { HYDRATION_SAFE_NOW, usePropertyToday } from "@/lib/usePropertyToday";
import type { SitPeriodKey } from "@/lib/todayVerdict";

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
  const {
    weatherPoint,
    weatherKey,
    forecast,
    now,
    moon,
    seasonCtx,
    verdict,
    activeSitKey,
    hitListSlides,
    heroPhoto,
    stripPhotos,
  } = usePropertyToday(activePropertyId);
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

  const currentWind = forecast?.current.windDirection;
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


  return (
    <PageShell maxWidth="980px">
      <HuntConditionAlerts
        propertyId={activePropertyId}
        propertyName={activeProperty?.name ?? "This property"}
        forecast={forecast}
        verdict={verdict}
        now={now}
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
              {/* Graded on the verdict's next-sit wind, like the headline. */}
              <WindCompass
                wind={verdict.wind}
                windSpeed={verdict.windSpeed}
                label={SIT_WIND_LABEL[verdict.period]}
                currentWind={currentWind}
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

// Which sit the wind dial is reading, matching the verdict's period.
const SIT_WIND_LABEL: Record<SitPeriodKey, string> = {
  morning: "Morning sit wind",
  evening: "Tonight's sit wind",
  tomorrow: "Tomorrow AM sit wind",
};

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

