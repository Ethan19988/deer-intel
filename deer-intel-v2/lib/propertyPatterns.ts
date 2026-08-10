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
import type { PhotoRecord } from "@/types/photo";

export type PatternConfidence = "low" | "medium" | "high";

export type PatternInsight = {
  label: string;
  value: string;
  detail: string;
  lift?: number; // how many times the property average this bucket beats
  // How much data stands behind the winning bucket — a guard against reading too
  // much into a couple of lucky observations.
  confidence?: PatternConfidence;
};

export type PropertyPatternReport = {
  sits: number;
  checks: number;
  sightings: number; // deer trail-cam photos with usable conditions
  bucksSeen: number;
  deerSeen: number;
  conditionInsights: PatternInsight[]; // from hunt sits
  sightingInsights: PatternInsight[]; // from trail-cam sightings + their weather
  hottestCamera: PatternInsight | null; // from camera checks
  enough: boolean; // enough sits to read conditions
  message: string; // guidance when data is thin
};

const MIN_SITS = 5; // fewer than this and conditions are just noise
const MIN_BUCKET = 3; // a condition bucket needs this many observations to count
const LIFT = 1.3; // a bucket must beat the average by this to be a "pattern"

// Confidence tiers from the winning bucket's sample size. Sightings clear the
// higher bars quickly (there are far more photos than sits); hunts rarely do,
// which is the honest read.
function confidenceFor(n: number): PatternConfidence {
  return n >= 12 ? "high" : n >= 6 ? "medium" : "low";
}

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
  unit: string,
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
    } over ${best.g.n} ${unit}.`,
    lift,
    confidence: confidenceFor(best.g.n),
  };
}

// The wind/temp/moon/time (and optionally stand) insights for a set of
// observations — shared by hunt sits and trail-cam sightings so both read the
// property the same way. Temperature is bucketed relative to THIS set's own
// spread, so it's unit-agnostic.
function conditionInsightsFor(
  obs: Sit[],
  unit: string,
  includeStand: boolean,
): PatternInsight[] {
  const temps = obs
    .map((o) => o.temp)
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);
  const t33 = temps.length ? temps[Math.floor(temps.length * 0.33)] : null;
  const t66 = temps.length ? temps[Math.floor(temps.length * 0.66)] : null;
  const tempBucket = (s: Sit): string | null => {
    if (s.temp == null || t33 == null || t66 == null || t33 === t66) return null;
    return s.temp <= t33 ? "Colder" : s.temp >= t66 ? "Warmer" : "Middle";
  };
  const timeBucket = (s: Sit): string | null =>
    s.hour == null ? null : s.hour < 9 ? "Dawn" : s.hour >= 15 ? "Dusk" : "Midday";

  const out: PatternInsight[] = [];
  const push = (i: PatternInsight | null) => {
    if (i) out.push(i);
  };
  push(bestBucket(obs, (s) => s.wind, "Best wind", (b) => `${b} wind`, unit));
  push(
    bestBucket(
      obs,
      tempBucket,
      "Best temperature",
      (b) => (b === "Colder" ? "Colder days" : b === "Warmer" ? "Warmer days" : "Mild temps"),
      unit,
    ),
  );
  push(bestBucket(obs, (s) => s.moon, "Best moon", (b) => `${b} moon`, unit));
  push(
    bestBucket(
      obs,
      timeBucket,
      "Best time",
      (b) => (b === "Dawn" ? "First light" : b === "Dusk" ? "Last light" : "Midday"),
      unit,
    ),
  );
  if (includeStand) {
    push(bestBucket(obs, (s) => s.stand, "Best stand", (b) => b, unit));
  }

  // Strongest pattern first, so a compact view leads with the best one.
  out.sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0));
  return out;
}

/** Local hour-of-day from a photo timestamp, or null for a date-only string. */
function hourFromTimestamp(raw: string | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!s || /^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const time = Date.parse(s);
  if (Number.isNaN(time)) return null;
  return new Date(time).getHours();
}

// A deer trail-cam photo as a condition observation: the weather stamped on the
// photo is genuinely WHEN the deer moved (unlike a card-swap check), so it's
// real signal. Bucks weigh double, matching the hunt-sit convention. Non-deer
// photos (turkey, etc.) are dropped.
function photoObservation(photo: PhotoRecord): Sit | null {
  const species = photo.species ?? "";
  const isBuck = Boolean(photo.buckName?.trim()) || /buck/i.test(species);
  const isDeer = isBuck || /doe|deer|fawn/i.test(species);
  if (!isDeer) return null;

  const snap = photo.weatherSnapshot;
  return {
    activity: isBuck ? 2 : 1,
    bucks: isBuck ? 1 : 0,
    deer: 1,
    wind: normWind(snap?.windDirection),
    temp: parseTemp(snap?.temperature),
    moon: normMoon(snap?.moonPhase),
    hour: hourFromTimestamp(photo.photoDate),
    stand: null,
  };
}

export function buildPropertyPatternReport(
  hunts: HuntLogEntry[],
  checks: CameraCheck[],
  cameras: Camera[],
  photos: PhotoRecord[] = [],
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

  const conditionInsights = conditionInsightsFor(sits, "sits", true);

  // Trail-cam sightings carry the weather at capture time, so they read
  // conditions the same way — and there are far more of them, so the patterns
  // firm up faster.
  const sightingObs = photos
    .map(photoObservation)
    .filter((o): o is Sit => o != null);
  const sightingInsights = conditionInsightsFor(sightingObs, "sightings", false);

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
    sightings: sightingObs.length,
    bucksSeen,
    deerSeen,
    conditionInsights,
    sightingInsights,
    hottestCamera,
    enough,
    message,
  };
}
