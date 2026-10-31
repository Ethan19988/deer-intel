// Season report — one property, one PA deer season, summed up on a page you
// could print and pin above the gun cabinet: what you sat, what you saw, which
// stands / winds / times produced, where the tracked bucks showed up, how the
// rut played out, and a short rule-based "what to change next year".
//
// A season is the PA deer-season year: Sep 1 of year Y through Jan 31 of Y+1
// (archery opens early October, flintlock / late seasons run into January; the
// September margin catches early scouting sits and camera hits). Season Y is
// labelled "2026–27".

import { hourLabel, isBuckRecord, isDeerPhotoRecord, isTimedDeerPhoto } from "@/lib/hourlyActivity";
import { getPhotoBuckNames, getPhotoDeerProfileIds, photoRecordTime } from "@/lib/photos";
import { rutPhaseLabel, type RutPhase } from "@/lib/seasonCalendar";
import {
  aggregateSits,
  buildPropertyStandStats,
  huntWindPoint,
  lightPeriod,
  MIN_BUCKET_SITS,
  MIN_SITS_TO_CALL,
  RUT_PHASE_ORDER,
  type BestPick,
  type Bucket,
  type LightPeriod,
  type SitAggregate,
  type StandStats,
  type StatsContext,
  toSitRecord,
  formatRate,
} from "@/lib/standStats";
import { getStandWindCheck } from "@/lib/standWind";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { PhotoRecord } from "@/types/photo";
import type { Stand } from "@/types/stand";

// --- season window ------------------------------------------------------------

export type SeasonWindow = {
  year: number;
  label: string;
  /** Inclusive local date keys. */
  from: string;
  to: string;
};

export function seasonWindow(year: number): SeasonWindow {
  const next = String((year + 1) % 100).padStart(2, "0");
  return {
    year,
    label: `${year}–${next}`,
    from: `${year}-09-01`,
    to: `${year + 1}-01-31`,
  };
}

/** The season year a date key belongs to (Feb–Aug read as the coming season). */
export function seasonYearFor(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month === 1 ? year - 1 : year;
}

export function inSeason(dateKey: string, season: SeasonWindow): boolean {
  const key = dateKey.slice(0, 10);
  return key >= season.from && key <= season.to;
}

function dateKeyOf(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type SeasonData = { hunts: HuntLogEntry[]; cameraChecks: CameraCheck[]; photos: PhotoRecord[] };

/**
 * Seasons whose Sep 1–Jan 31 window holds a sit, check or deer photo (the
 * records a report counts), newest first. A date outside every window (a
 * June sit) doesn't make its season look like it has data.
 */
export function seasonsWithData(data: SeasonData): number[] {
  const years = new Set<number>();
  const add = (key: string | undefined) => {
    if (!key) return;
    const year = seasonYearFor(key);
    if (year !== null && inSeason(key, seasonWindow(year))) years.add(year);
  };
  data.hunts.forEach((hunt) => add(hunt.date));
  data.cameraChecks.forEach((check) => add(check.date));
  data.photos.forEach((photo) => {
    if (!isDeerPhotoRecord(photo)) return;
    const time = photoRecordTime(photo);
    if (time) add(dateKeyOf(time));
  });
  return [...years].sort((a, b) => b - a);
}

/** Seasons with data (see seasonsWithData) plus the current one — newest first. */
export function availableSeasons(data: SeasonData, now: Date): number[] {
  const years = new Set(seasonsWithData(data));
  const current = seasonYearFor(dateKeyOf(now.getTime()));
  if (current !== null) years.add(current);
  return [...years].sort((a, b) => b - a);
}

/**
 * The season a report opens on: the newest one (not after the current one)
 * that has data, else the current season.
 */
export function defaultSeasonYear(data: SeasonData, now: Date): number | null {
  const current = seasonYearFor(dateKeyOf(now.getTime()));
  const withData = seasonsWithData(data).filter((year) => current === null || year <= current);
  return withData[0] ?? current;
}

// --- report shape ----------------------------------------------------------------

export type ReportSummary = SitAggregate & {
  cameraChecks: number;
  deerPhotos: number;
  buckPhotos: number;
};

export type BuckSighting = {
  /** Deer profile id, or "name:<lowercase>" for a named buck with no profile. */
  key: string;
  name: string;
  profileId?: string;
  photos: number;
  firstSeen: string;
  lastSeen: string;
  /** Camera sites, most photos first. */
  sites: Array<{ cameraId: string; name: string; photos: number }>;
  byPeriod: Record<LightPeriod, number>;
  /** Busiest capture hour, when at least 3 photos carry a time. */
  peakHourLabel: string | null;
  /** Rut phase with the most photos of him. */
  topPhase: string | null;
  /** Times he was logged on a sit (by name in the sit notes). */
  sitMentions: number;
};

export type PhaseActivity = {
  phase: RutPhase;
  label: string;
  sits: number;
  deerPerSit: number;
  bucksPerSit: number;
  deerPhotos: number;
  buckPhotos: number;
};

export type ReportAdviceTone = "change" | "keep" | "data";

export type ReportAdvice = {
  tone: ReportAdviceTone;
  title: string;
  detail: string;
};

export type SeasonReport = {
  season: SeasonWindow;
  summary: ReportSummary;
  stands: StandStats[];
  /** Stands with enough sits, best deer-per-sit first (top 3). */
  bestStands: StandStats[];
  propertyStats: StandStats;
  bestWind: BestPick | null;
  bestTime: BestPick | null;
  windRows: Bucket<string>[];
  timeRows: Bucket<string>[];
  bucks: BuckSighting[];
  phases: PhaseActivity[];
  advice: ReportAdvice[];
  isEmpty: boolean;
};

export type SeasonReportInput = {
  stands: Stand[];
  hunts: HuntLogEntry[];
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  photos: PhotoRecord[];
  deerProfiles: DeerProfile[];
};

// --- builders -----------------------------------------------------------------------

type SeasonPhoto = {
  photo: PhotoRecord;
  time: number;
  dateKey: string;
  timed: boolean;
  buck: boolean;
  phase: RutPhase | null;
  period: LightPeriod | null;
};

function seasonPhotos(
  photos: PhotoRecord[],
  season: SeasonWindow,
  ctx: StatsContext,
): SeasonPhoto[] {
  const out: SeasonPhoto[] = [];
  for (const photo of photos) {
    const time = photoRecordTime(photo);
    if (!time) continue;
    const dateKey = dateKeyOf(time);
    if (!inSeason(dateKey, season)) continue;
    const timed = isTimedDeerPhoto(photo);
    const buck = isBuckRecord(photo);
    // Deer only: a timed non-deer photo is dropped; an untimed one counts if
    // it's a buck link or names a deer species.
    if (!isDeerPhotoRecord(photo)) continue;
    const sun = timed ? ctx.sunFor(dateKey) : null;
    const date = new Date(time);
    out.push({
      photo,
      time,
      dateKey,
      timed,
      buck,
      phase: ctx.phaseFor(dateKey),
      period: sun ? lightPeriod(date.getHours() * 60 + date.getMinutes(), sun) : null,
    });
  }
  return out;
}

function buildBuckSightings(
  photos: SeasonPhoto[],
  hunts: HuntLogEntry[],
  cameras: Camera[],
  profiles: DeerProfile[],
): BuckSighting[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const profileByName = new Map(
    profiles.map((profile) => [profile.nickname.trim().toLowerCase(), profile]),
  );
  const cameraName = new Map(cameras.map((camera) => [camera.id, camera.name]));

  type Acc = {
    key: string;
    name: string;
    profileId?: string;
    photos: SeasonPhoto[];
  };
  const groups = new Map<string, Acc>();

  for (const entry of photos) {
    const keys = new Map<string, { name: string; profileId?: string }>();
    for (const id of getPhotoDeerProfileIds(entry.photo)) {
      const profile = profileById.get(id);
      if (profile) keys.set(profile.id, { name: profile.nickname, profileId: profile.id });
    }
    for (const name of getPhotoBuckNames(entry.photo)) {
      const profile = profileByName.get(name.toLowerCase());
      if (profile) keys.set(profile.id, { name: profile.nickname, profileId: profile.id });
      else if (![...keys.values()].some((v) => v.name.toLowerCase() === name.toLowerCase())) {
        keys.set(`name:${name.toLowerCase()}`, { name });
      }
    }
    for (const [key, meta] of keys) {
      const acc = groups.get(key) ?? { key, name: meta.name, profileId: meta.profileId, photos: [] };
      acc.photos.push(entry);
      groups.set(key, acc);
    }
  }

  return [...groups.values()]
    .map((acc) => {
      const sorted = [...acc.photos].sort((a, b) => a.time - b.time);
      const siteCounts = new Map<string, number>();
      const byPeriod: Record<LightPeriod, number> = { morning: 0, evening: 0, night: 0 };
      const hourCounts = new Array(24).fill(0);
      const phaseCounts = new Map<RutPhase, number>();
      let timed = 0;
      for (const entry of sorted) {
        const site = entry.photo.cameraSiteId || "";
        siteCounts.set(site, (siteCounts.get(site) ?? 0) + 1);
        if (entry.period) byPeriod[entry.period] += 1;
        if (entry.timed) {
          hourCounts[new Date(entry.time).getHours()] += 1;
          timed += 1;
        }
        if (entry.phase) phaseCounts.set(entry.phase, (phaseCounts.get(entry.phase) ?? 0) + 1);
      }
      let peakHour = -1;
      for (let hour = 0; hour < 24; hour += 1) {
        if (hourCounts[hour] > (peakHour < 0 ? 0 : hourCounts[peakHour])) peakHour = hour;
      }
      const topPhase = [...phaseCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const needle = acc.name.trim().toLowerCase();
      const sitMentions = needle.length >= 3
        ? hunts.filter((hunt) => (hunt.notes || "").toLowerCase().includes(needle)).length
        : 0;

      return {
        key: acc.key,
        name: acc.name,
        profileId: acc.profileId,
        photos: sorted.length,
        firstSeen: sorted[0].dateKey,
        lastSeen: sorted[sorted.length - 1].dateKey,
        sites: [...siteCounts.entries()]
          .map(([cameraId, count]) => ({
            cameraId,
            name: cameraName.get(cameraId) ?? "Unknown camera",
            photos: count,
          }))
          .sort((a, b) => b.photos - a.photos),
        byPeriod,
        peakHourLabel: timed >= 3 && peakHour >= 0 ? hourLabel(peakHour) : null,
        topPhase: topPhase ? rutPhaseLabel(topPhase) : null,
        sitMentions,
      } satisfies BuckSighting;
    })
    .sort((a, b) => b.photos - a.photos || a.name.localeCompare(b.name));
}

function buildPhaseActivity(
  propertyStats: StandStats,
  photos: SeasonPhoto[],
): PhaseActivity[] {
  const photoCounts = new Map<RutPhase, { deer: number; bucks: number }>();
  for (const entry of photos) {
    if (!entry.phase) continue;
    const counts = photoCounts.get(entry.phase) ?? { deer: 0, bucks: 0 };
    counts.deer += 1;
    if (entry.buck) counts.bucks += 1;
    photoCounts.set(entry.phase, counts);
  }
  const sitByPhase = new Map(propertyStats.byPhase.map((bucket) => [bucket.key, bucket.agg]));

  return RUT_PHASE_ORDER.filter((phase) => sitByPhase.has(phase) || photoCounts.has(phase)).map(
    (phase) => {
      const agg = sitByPhase.get(phase);
      const counts = photoCounts.get(phase) ?? { deer: 0, bucks: 0 };
      return {
        phase,
        label: rutPhaseLabel(phase),
        sits: agg?.sits ?? 0,
        deerPerSit: agg?.deerPerSit ?? 0,
        bucksPerSit: agg?.bucksPerSit ?? 0,
        deerPhotos: counts.deer,
        buckPhotos: counts.bucks,
      };
    },
  );
}

// --- "what to change" rules ------------------------------------------------------------

/** Share of property sits above which a stand that underproduces is overhunted. */
const OVERHUNT_SHARE = 0.4;
/** A stand "beats" the property when its rate is at least this multiple. */
const STRONG_LIFT = 1.3;
const WEAK_LIFT = 0.75;
const MAX_ADVICE = 6;

export function buildAdvice(
  input: { stands: Stand[]; hunts: HuntLogEntry[] },
  rows: StandStats[],
  property: StandStats,
  phases: PhaseActivity[],
): ReportAdvice[] {
  const advice: ReportAdvice[] = [];
  const total = property.overall.sits;
  if (total === 0) return advice;
  const avg = property.overall.activityPerSit;
  const standById = new Map(input.stands.map((stand) => [stand.id, stand]));

  // 1. Sat on the wrong wind — against the stand's own avoid winds.
  const wrongWind: Array<{ name: string; count: number; deer: number }> = [];
  for (const row of rows) {
    const stand = standById.get(row.standId);
    if (!stand || !stand.avoidWinds.trim()) continue;
    let count = 0;
    let deer = 0;
    for (const hunt of input.hunts) {
      if (hunt.standId !== stand.id) continue;
      const point = huntWindPoint(hunt);
      if (!point) continue;
      const speed = hunt.windSpeed || hunt.weatherSnapshot?.windSpeed;
      if (getStandWindCheck(stand, point, speed).status === "avoid") {
        count += 1;
        deer += (hunt.bucks || 0) + (hunt.does || 0) + (hunt.fawns || 0);
      }
    }
    if (count >= 2) wrongWind.push({ name: stand.name, count, deer });
  }
  wrongWind.sort((a, b) => b.count - a.count);
  for (const item of wrongWind.slice(0, 2)) {
    advice.push({
      tone: "change",
      title: `Stop sitting ${item.name} on its wrong wind`,
      detail: `${item.count} sits on a wind you marked to avoid${
        item.deer ? ` (${item.deer} deer seen — likely fewer than it should have been)` : " with nothing seen"
      }. Save it for a good wind and sit somewhere else.`,
    });
  }

  // 2. Overhunted: a big share of the sits, below-average results.
  for (const row of rows) {
    if (row.overall.sits < MIN_SITS_TO_CALL) continue;
    const share = row.overall.sits / total;
    if (share >= OVERHUNT_SHARE && avg > 0 && row.overall.activityPerSit < avg * WEAK_LIFT && rows.length > 1) {
      advice.push({
        tone: "change",
        title: `${row.standName} was overhunted`,
        detail: `${Math.round(share * 100)}% of your sits (${row.overall.sits}) for ${formatRate(
          row.overall.deerPerSit,
        )} deer/sit, below the property's ${formatRate(property.overall.deerPerSit)}. Spread the pressure next year.`,
      });
    }
  }

  // 3. Under-used good stands: beat the property with few sits.
  const medianSits = [...rows.map((r) => r.overall.sits)].sort((a, b) => a - b)[
    Math.floor(rows.length / 2)
  ] ?? 0;
  for (const row of rows) {
    const sits = row.overall.sits;
    if (sits < MIN_BUCKET_SITS || sits > medianSits || rows.length < 2) continue;
    if (avg > 0 && row.overall.activityPerSit >= avg * STRONG_LIFT) {
      advice.push({
        tone: "keep",
        title: `Hunt ${row.standName} more`,
        detail: `Only ${sits} sits, but ${formatRate(row.overall.deerPerSit)} deer/sit against the property's ${formatRate(
          property.overall.deerPerSit,
        )}. It earned more time — on its best wind.`,
      });
    }
  }

  // 4. Best time under-used.
  if (property.bestTime) {
    const share = property.bestTime.agg.sits / total;
    if (share < 0.4) {
      advice.push({
        tone: "keep",
        title: `More ${property.bestTime.label.toLowerCase()} sits`,
        detail: `${property.bestTime.label} sits produced ${formatRate(
          property.bestTime.agg.deerPerSit,
        )} deer/sit (${property.bestTime.lift.toFixed(1)}× your average) but were only ${Math.round(
          share * 100,
        )}% of your time on stand.`,
      });
    }
  }

  // 5. Rut timing: bucks on camera in a phase you barely sat.
  const busiestBuckPhase = [...phases].sort((a, b) => b.buckPhotos - a.buckPhotos)[0];
  if (busiestBuckPhase && busiestBuckPhase.buckPhotos >= 5 && busiestBuckPhase.sits < Math.max(2, total * 0.15)) {
    advice.push({
      tone: "change",
      title: `Be in the woods during ${busiestBuckPhase.label.toLowerCase()}`,
      detail: `Your cameras logged ${busiestBuckPhase.buckPhotos} buck photos then, but you sat only ${busiestBuckPhase.sits} ${
        busiestBuckPhase.sits === 1 ? "time" : "times"
      }. Block those days off next year.`,
    });
  }

  // 6. Stands never sat.
  const unsat = rows.filter((row) => row.overall.sits === 0 && standById.has(row.standId));
  if (unsat.length > 0 && total >= MIN_SITS_TO_CALL) {
    advice.push({
      tone: "data",
      title: unsat.length === 1 ? `${unsat[0].standName} never got a sit` : `${unsat.length} stands never got a sit`,
      detail: `${unsat
        .slice(0, 3)
        .map((row) => row.standName)
        .join(", ")}${unsat.length > 3 ? "…" : ""} — try them on a good wind, move them, or pull them.`,
    });
  }

  // 7. Data gaps that blind the report.
  const missingWind = property.missingWind / total;
  const missingTime = property.missingTime / total;
  if (missingWind > 0.3 || missingTime > 0.3) {
    const gaps = [
      missingWind > 0.3 ? `wind on ${property.missingWind}` : "",
      missingTime > 0.3 ? `times on ${property.missingTime}` : "",
    ].filter(Boolean);
    advice.push({
      tone: "data",
      title: "Log every sit's wind and times",
      detail: `Missing ${gaps.join(" and ")} of ${total} sits. Those sits can't count toward best wind or best time.`,
    });
  }

  if (total < MIN_SITS_TO_CALL) {
    advice.push({
      tone: "data",
      title: "Too few sits to call",
      detail: `${total} ${total === 1 ? "sit" : "sits"} logged this season — the patterns above need at least ${MIN_SITS_TO_CALL} before they mean much.`,
    });
  }

  return advice.slice(0, MAX_ADVICE);
}

export function buildSeasonReport(
  input: SeasonReportInput,
  seasonYear: number,
  ctx: StatsContext,
): SeasonReport {
  const season = seasonWindow(seasonYear);
  const hunts = input.hunts.filter((hunt) => hunt.date && inSeason(hunt.date, season));
  const checks = input.cameraChecks.filter((check) => check.date && inSeason(check.date, season));
  const photos = seasonPhotos(input.photos, season, ctx);

  const { property, stands } = buildPropertyStandStats(input.stands, hunts, ctx);
  const overall = aggregateSits(hunts.map((hunt) => toSitRecord(hunt, ctx)));

  const bestStands = stands
    .filter((row) => row.overall.sits >= MIN_SITS_TO_CALL && row.overall.activityPerSit > 0)
    .sort((a, b) => b.overall.activityPerSit - a.overall.activityPerSit)
    .slice(0, 3);

  const phases = buildPhaseActivity(property, photos);

  return {
    season,
    summary: {
      ...overall,
      cameraChecks: checks.length,
      deerPhotos: photos.length,
      buckPhotos: photos.filter((entry) => entry.buck).length,
    },
    stands,
    bestStands,
    propertyStats: property,
    bestWind: property.bestWind,
    bestTime: property.bestTime,
    windRows: property.byWind,
    timeRows: property.byTime,
    bucks: buildBuckSightings(photos, hunts, input.cameras, input.deerProfiles),
    phases,
    advice: buildAdvice({ stands: input.stands, hunts }, stands, property, phases),
    isEmpty: hunts.length === 0 && checks.length === 0 && photos.length === 0,
  };
}
