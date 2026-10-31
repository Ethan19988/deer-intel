"use client";

import { useEffect } from "react";
import { coldFrontStatus, type LiveForecast } from "@/lib/liveWeather";
import {
  fireNotification,
  getNotificationPermission,
  useNotificationPrefs,
} from "@/lib/notifications";
import { buildGoodWindAlert, type TodayVerdict } from "@/lib/todayVerdict";

type HuntConditionAlertsProps = {
  propertyId: string;
  propertyName: string;
  /** The Today forecast (from usePropertyToday); null while it loads. */
  forecast: LiveForecast | null;
  /** The Today verdict, so the alert grades the same next-sit wind. */
  verdict: TodayVerdict;
  /** The page clock; null before mount. */
  now: Date | null;
};

// Headless: on the dashboard, fire local notifications for the conditions the
// hunter opted into: a falling barometer, and a stand with a good wind for the
// NEXT SIT (the verdict's forecast sit wind, not the wind right now). The
// good-wind alert only fires in the few hours before that sit starts and is
// keyed per sit day + AM/PM + stand, so a wind that wobbles through the day
// doesn't re-alert. Deduped per day in lib/notifications.
export default function HuntConditionAlerts({
  propertyId,
  propertyName,
  forecast,
  verdict,
  now,
}: HuntConditionAlertsProps) {
  const prefs = useNotificationPrefs();

  const front = coldFrontStatus(forecast?.pressure);
  const frontText =
    prefs.coldFront && front.isFront
      ? `${propertyName}: barometer falling${
          front.dropInHg !== null
            ? ` (down ${front.dropInHg.toFixed(2)} inHg)`
            : ""
        } — prime deer movement likely.`
      : "";

  const goodWind =
    prefs.goodWind && now
      ? buildGoodWindAlert({ verdict, forecast, now, propertyId, propertyName })
      : null;

  // Strings, not objects, drive the effect: the page rebuilds the verdict
  // every render, and the clock ticks each minute.
  const goodWindKey = goodWind?.key ?? "";
  const goodWindBody = goodWind?.body ?? "";
  const goodWindTitle = goodWind?.title ?? "";

  useEffect(() => {
    if (getNotificationPermission() !== "granted") return;
    if (!frontText) return;

    void fireNotification(
      `coldfront:${propertyName}`,
      "Cold front moving in",
      frontText,
    );
  }, [frontText, propertyName]);

  useEffect(() => {
    if (getNotificationPermission() !== "granted") return;
    if (!goodWindKey) return;

    void fireNotification(goodWindKey, goodWindTitle, goodWindBody);
  }, [goodWindKey, goodWindTitle, goodWindBody]);

  return null;
}
