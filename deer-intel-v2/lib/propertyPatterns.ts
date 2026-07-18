// Property pattern report — the "learns each property over seasons" read.
//
// Mines the hunter's own records for what conditions actually produce deer on a
// property. Condition patterns (wind, temperature, moon, time of day, stand)
// come from HUNT SITS: each sit's weather is the condition you saw those deer
// under. Camera checks are used only for the hottest SITE — a check's weather is
// when you swapped the card, not when deer moved, so it's no signal for
// conditions. Buck sightings weigh double (mature-buck focus). Pure local data.

import type { HuntLogEntry } from "@/types/hunt";
import type { CameraCheck } from "@/types/cameraCheck";
import type { Camera } from "@/types/camera";

export type PatternInsight = {
  label: string;
  value: string;
  detail: string;
  lift?: number; // how many times the property average this bucket beats
};

export type PropertyPatternReport = {
  sits: number;
  checks: number;
  bucksSeen: number;
  deerSeen: number;
  conditionInsights: PatternInsight[]; // from hunt sits
  hottestCamera: PatternInsight | null; // from camera checks
  enough: boolean; // enough sits to read conditions
  message: string; // guidance when data is thin
};

const MIN_SITS = 5; // fewer than this and conditions are just noise
const MIN_BUCKET = 3; // a condition bucket needs this many sits to count
const LIFT = 1.3; // a bucket must beat the average by this to be a "pattern"

type Sit = {
  activity: number; // bucks*2 + does + fawns
  bucks: number;
  deer: number;
  wind: string | null;
  temp: number | null;
  moon: string | null;
  hour: number | null;
  stand: string | null;
};

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Normalize a wind field (abbrev, name, or degrees) to an 8-point compass. */
function normWind(raw: string | undefined): string | null {
  const s = (raw ?? "").trim().toUpperCase();
  if (!s) return null;
  const deg = Number(s.replace(/[^\d.-]/g, ""));
  if (s.match(/^[\d.\s°]+$/) && Number.isFinite(deg)) {
    return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
  }
  const first = s.replace(/[^NESW]/g, "").slice(0, 2);
  if (COMPASS.includes(first)) return first;
  if (first.length === 1 && "NESW".includes(first)) return first;
  // full names / NNE etc. -> take the dominant one/two letters
  const letters = s.replace(/[^NESW]/g, "");
  return letters ? (COMPASS.includes(letters.slice(0, 2)) ? letters.slice(0, 2) : letters[0]) : null;
}

function parseTemp(raw: string | undefined): number | null {
  const m = String(raw ?? "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function normMoon(raw: string | undefined): string | null {
  const s = (raw ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("new")) return "New";
  if (s.includes("full")) return "Full";
  if (s.includes("wax")) return "Waxing";
  if (s.includes("wan")) return "Waning";
  if (s.includes("quarter")) return s.includes("first") ? "Waxing" : "Waning";
  return null;
}

function parseHour(raw: string | undefined): number | null {
  const s = (raw ?? "").trim();
  const m = s.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ampm = (m[3] ?? "").toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h >= 0 && h <= 23 ? h : null;
}

function readWeather(entry: HuntLogEntry) {
  const snap = entry.weatherSnapshot;
  return {
    wind: normWind(entry.windDirection || snap?.windDirection),
    temp: parseTemp(entry.temperature || snap?.temperature),
    moon: normMoon(entry.moonPhase || snap?.moonPhase),
  };
}

/** The single best bucket for a dimension, phrased as an insight, or null. */
function bestBucket(
  sits: Sit[],
  key: (s: Sit) => string | null,
  label: string,
  phrase: (bucket: string) => string,
): PatternInsight | null {
  const groups = new Map<string, { n: number; activity: number; bucks: number; deer: number }>();
  let withKey = 0;
  let totalActivity = 0;
  for (const s of sits) {
    const k = key(s);
    if (k == null) continue;
    withKey += 1;
    totalActivity += s.activity;
    const g = groups.get(k) ?? { n: 0, activity: 0, bucks: 0, deer: 0 };
    g.n += 1;
    g.activity += s.activity;
    g.bucks += s.bucks;
    g.deer += s.deer;
    groups.set(k, g);
  }
  if (withKey < MIN_SITS) return null;
  const avg = totalActivity / withKey;
  if (avg <= 0) return null;

  let best: { bucket: string; rate: number; g: { n: number; bucks: number; deer: number } } | null = null;
  for (const [bucket, g] of groups) {
    if (g.n < MIN_BUCKET) continue;
    const rate = g.activity / g.n;
    if (!best || rate > best.rate) best = { bucket, rate, g };
  }
  if (!best || best.rate < LIFT * avg) return null;

  const lift = best.rate / avg;
  return {
    label,
    value: phrase(best.bucket),
    detail: `${lift.toFixed(1)}× your average — ${best.g.deer} deer${
      best.g.bucks ? ` (${best.g.bucks} bucks)` : ""
    } over ${best.g.n} sits.`,
    lift,
  };
}

export function buildPropertyPatternReport(
  hunts: HuntLogEntry[],
  checks: CameraCheck[],
  cameras: Camera[],
): PropertyPatternReport {
  const sits: Sit[] = hunts.map((h) => {
    const w = readWeather(h);
    const bucks = h.bucks || 0;
    const deer = bucks + (h.does || 0) + (h.fawns || 0);
    return {
      activity: bucks * 2 + (h.does || 0) + (h.fawns || 0),
      bucks,
      deer,
      wind: w.wind,
      temp: w.temp,
      moon: w.moon,
      hour: parseHour(h.startTime),
      stand: (h.standName || "").trim() || null,
    };
  });

  const bucksSeen = sits.reduce((a, s) => a + s.bucks, 0);
  const deerSeen = sits.reduce((a, s) => a + s.deer, 0);

  // Temperature bucketed RELATIVE to this property's own range (unit-agnostic).
  const temps = sits.map((s) => s.temp).filter((t): t is number => t != null).sort((a, b) => a - b);
  const t33 = temps.length ? temps[Math.floor(temps.length * 0.33)] : null;
  const t66 = temps.length ? temps[Math.floor(temps.length * 0.66)] : null;
  const tempBucket = (s: Sit): string | null => {
    if (s.temp == null || t33 == null || t66 == null || t33 === t66) return null;
    return s.temp <= t33 ? "Colder" : s.temp >= t66 ? "Warmer" : "Middle";
  };
  const timeBucket = (s: Sit): string | null =>
    s.hour == null ? null : s.hour < 9 ? "Dawn" : s.hour >= 15 ? "Dusk" : "Midday";

  const conditionInsights: PatternInsight[] = [];
  const push = (i: PatternInsight | null) => {
    if (i) conditionInsights.push(i);
  };
  push(bestBucket(sits, (s) => s.wind, "Best wind", (b) => `${b} wind`));
  push(bestBucket(sits, tempBucket, "Best temperature", (b) =>
    b === "Colder" ? "Your colder sits" : b === "Warmer" ? "Your warmer sits" : "Mild temps",
  ));
  push(bestBucket(sits, (s) => s.moon, "Best moon", (b) => `${b} moon`));
  push(bestBucket(sits, timeBucket, "Best time", (b) =>
    b === "Dawn" ? "First light" : b === "Dusk" ? "Last light" : "Midday",
  ));
  push(bestBucket(sits, (s) => s.stand, "Best stand", (b) => b));

  // Strongest pattern first, so a compact view (Today) leads with the best one.
  conditionInsights.sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0));

  // Hottest camera site — deer logged, ignoring check-time weather.
  const nameById = new Map(cameras.map((c) => [c.id, c.name]));
  const camAct = new Map<string, { bucks: number; deer: number }>();
  for (const c of checks) {
    const g = camAct.get(c.cameraId) ?? { bucks: 0, deer: 0 };
    g.bucks += c.bucks || 0;
    g.deer += (c.bucks || 0) + (c.does || 0) + (c.fawns || 0);
    camAct.set(c.cameraId, g);
  }
  let hottestCamera: PatternInsight | null = null;
  let top: { id: string; deer: number; bucks: number } | null = null;
  for (const [id, g] of camAct) {
    if (g.deer > 0 && (!top || g.deer > top.deer)) top = { id, deer: g.deer, bucks: g.bucks };
  }
  if (top) {
    hottestCamera = {
      label: "Hottest camera",
      value: nameById.get(top.id) ?? "A camera",
      detail: `${top.deer} deer${top.bucks ? ` (${top.bucks} bucks)` : ""} logged — your most active site.`,
    };
  }

  const enough = sits.length >= MIN_SITS;
  const message = enough
    ? conditionInsights.length
      ? ""
      : "No standout conditions yet — your sightings are spread evenly. Keep logging and patterns will surface."
    : `Log the conditions on more sits to unlock your property's patterns — ${sits.length} so far, ${MIN_SITS} needed.`;

  return {
    sits: sits.length,
    checks: checks.length,
    bucksSeen,
    deerSeen,
    conditionInsights,
    hottestCamera,
    enough,
    message,
  };
}
