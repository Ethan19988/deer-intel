"use client";

import { useEffect, useRef } from "react";
import {
  fetchLiveForecast,
  type WeatherPoint,
} from "@/lib/liveWeather";
import { getStandWindCheck } from "@/lib/standWind";
import {
  fireNotification,
  getNotificationPermission,
  useNotificationPrefs,
} from "@/lib/notifications";
import { useUnitPreferences } from "@/lib/units";
import type { Stand } from "@/types/stand";

type HuntConditionAlertsProps = {
  propertyName: string;
  point: WeatherPoint | null;
  stands: Stand[];
};

// Headless: on the dashboard, when the active property's live forecast loads,
// fire local notifications for the conditions the hunter opted into (a falling
// barometer / a stand that matches today's wind). Deduped per day in
// lib/notifications, so opening the app repeatedly won't spam. The forecast
// fetch is cached (same point + units) so this piggybacks on the weather panel.
export default function HuntConditionAlerts({
  propertyName,
  point,
  stands,
}: HuntConditionAlertsProps) {
  const prefs = useNotificationPrefs();
  const units = useUnitPreferences();

  // Keep the latest stands without making the effect re-run on every render
  // (the dashboard rebuilds the array each time); a content signature drives it.
  const standsRef = useRef(stands);
  standsRef.current = stands;
  const standsSignature = stands
    .map((stand) => `${stand.id}:${stand.bestWinds}:${stand.avoidWinds}`)
    .join("|");

  const pointKey = point ? `${point.lat},${point.lng}` : "";

  useEffect(() => {
    if (!point || !pointKey) return;
    if (getNotificationPermission() !== "granted") return;
    if (!prefs.coldFront && !prefs.goodWind) return;

    let active = true;

    fetchLiveForecast(point, units).then((result) => {
      if (!active || result.status !== "ok") return;

      const forecast = result.forecast;

      if (prefs.coldFront && forecast.pressure?.trend === "falling") {
        void fireNotification(
          `coldfront:${propertyName}`,
          "Cold front moving in",
          `${propertyName}: barometer falling — deer movement likely. ${forecast.pressure.hint}.`,
        );
      }

      if (prefs.goodWind) {
        const wind = forecast.current.windDirection;
        const goodStands = wind
          ? standsRef.current.filter(
              (stand) => getStandWindCheck(stand, wind).status === "good",
            )
          : [];

        if (goodStands.length > 0) {
          const names = goodStands
            .slice(0, 3)
            .map((stand) => stand.name)
            .join(", ");
          const extra = goodStands.length > 3 ? " and more" : "";

          void fireNotification(
            `goodwind:${propertyName}:${wind}`,
            "Good wind for a stand",
            `${propertyName}: a ${wind} wind favors ${names}${extra}.`,
          );
        }
      }
    });

    return () => {
      active = false;
    };
    // standsSignature stands in for the stands array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pointKey,
    prefs.coldFront,
    prefs.goodWind,
    units.temperature,
    units.wind,
    propertyName,
    standsSignature,
  ]);

  return null;
}
