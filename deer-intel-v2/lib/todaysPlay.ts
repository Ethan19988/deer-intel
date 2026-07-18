// "Today's Play" — the one daily call. Ties together today's actual conditions
// (wind, barometer, wind speed, rut phase) with the property's own patterns and
// stands to answer: hunt WHERE, WHEN, and WHY. Pure derivation from data the
// dashboard already has.

import type { LiveForecast } from "@/lib/liveWeather";
import type { Stand } from "@/types/stand";
import type { PropertyPatternReport } from "@/lib/propertyPatterns";
import { getStandWindCheck } from "@/lib/standWind";

export type MovementRating = "Prime" | "Good" | "Fair" | "Slow";

export type TodaysPlay = {
  headline: string; // the pick, e.g. "Hunt Ridge stand"
  stand: string | null; // recommended stand (clean wind), or null
  altStands: string[]; // other clean-wind stands
  movement: MovementRating; // how good today is for movement
  window: string; // when to sit
  reasons: string[]; // why
};

function windMph(raw: string | undefined): number | null {
  const m = String(raw ?? "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  let v = Number(m[0]);
  if (/km/i.test(String(raw))) v *= 0.621; // normalize km/h -> mph
  return v;
}

export function buildTodaysPlay(input: {
  forecast: LiveForecast | null;
  stands: Stand[];
  patternReport: PropertyPatternReport;
  rutLabel: string | null;
  rutActive: boolean;
}): TodaysPlay | null {
  const { forecast, stands, patternReport, rutLabel, rutActive } = input;
  if (!forecast) return null;

  const wind = forecast.current.windDirection;
  const insight = (label: string) =>
    patternReport.conditionInsights.find((i) => i.label === label);

  // Where — a stand that keeps your scent off the deer; prefer one that's ALSO
  // your most productive stand.
  const goodWind = wind
    ? stands.filter((s) => getStandWindCheck(s, wind).status === "good")
    : [];
  const bestStandName = insight("Best stand")?.value ?? null;
  let stand: string | null = null;
  let standIsProducer = false;
  if (bestStandName && goodWind.some((s) => s.name === bestStandName)) {
    stand = bestStandName;
    standIsProducer = true;
  } else if (goodWind.length) {
    stand = goodWind[0].name;
  }
  const altStands = goodWind.map((s) => s.name).filter((n) => n !== stand);

  // How good — movement rating from the barometer, wind speed, rut, and whether
  // it's your historically best wind.
  const trend = forecast.pressure?.trend;
  const bestWind = insight("Best wind");
  const windMatches =
    !!bestWind && !!wind && bestWind.value.toUpperCase().includes(wind.toUpperCase());
  let score = 1;
  if (trend === "falling") score += 2;
  else if (trend === "rising") score -= 1;
  if (rutActive) score += 2;
  const ws = windMph(forecast.current.windSpeed);
  if (ws != null) {
    if (ws <= 10) score += 1;
    else if (ws > 18) score -= 1;
  }
  if (windMatches) score += 1;
  const movement: MovementRating =
    score >= 4 ? "Prime" : score >= 2 ? "Good" : score >= 1 ? "Fair" : "Slow";

  // When.
  let window: string;
  if (rutActive) window = "All day — bucks are cruising";
  else if (trend === "falling") window = "All day — the front has them moving";
  else window = insight("Best time")?.value ?? "First light & last light";

  // Why.
  const reasons: string[] = [];
  if (stand) {
    reasons.push(
      `${wind} wind keeps your scent off ${stand}${
        standIsProducer ? " — and it's your most productive stand" : ""
      }.`,
    );
  } else if (wind) {
    reasons.push(
      `No saved stand sits clean on the ${wind} wind — still-hunt into it or pick your least-exposed sit.`,
    );
  }
  if (windMatches && bestWind) {
    reasons.push(`${wind} is your best wind here (${bestWind.detail.split(" — ")[0]}).`);
  }
  if (trend === "falling") {
    reasons.push("Barometer's falling — a front is nudging deer onto their feet.");
  } else if (trend === "rising") {
    reasons.push("High pressure behind the front; expect a slower, later sit.");
  }
  if (ws != null && ws > 18) {
    reasons.push("Wind's up — deer will hold tight to cover and leeward edges.");
  }
  if (rutActive && rutLabel) {
    reasons.push(`${rutLabel} — sit long, they're moving midday too.`);
  }

  return {
    headline: stand ? `Hunt ${stand}` : "No clean-wind stand today",
    stand,
    altStands,
    movement,
    window,
    reasons: reasons.slice(0, 4),
  };
}
