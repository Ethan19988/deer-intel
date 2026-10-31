// Owner history for the parcel tile build: "this parcel changed hands since
// the last build".
//
// Each monthly build keeps a compact per-county snapshot of who owned every
// parcel (keyed by the county's parcel id), stored next to the tiles in the R2
// bucket under parcel-history/<county>.json.gz. The next build reads it back,
// compares each parcel's owner, and stamps changed parcels in the tiles with
// `prev` (the previous owner) and `chg` (the YYYY-MM of the build that saw the
// change). A change is carried forward in the snapshot for CHANGE_KEEP_MONTHS
// so the map keeps showing it for about a year, not just for one month.
//
// Pure functions only (plus gzip read/write helpers at the bottom), so the
// comparison logic is unit tested from lib/__tests__.

import { gunzipSync, gzipSync } from "node:zlib";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const SNAPSHOT_VERSION = 1;

/** How long a seen change keeps showing on the map. */
export const CHANGE_KEEP_MONTHS = 12;

/**
 * A county whose owners mostly "changed" in one month didn't sell its land —
 * it reformatted its owner field ("SMITH JOHN" → "JOHN SMITH") or renumbered
 * parcels. Above this share of compared parcels, nothing is flagged this build
 * and the snapshot simply restarts from the new names.
 */
export const MASS_CHANGE_SHARE = 0.25;
/** Below this many compared parcels the mass-change guard doesn't apply. */
const MASS_CHANGE_MIN_COMPARED = 200;

/** Marks a parcel id shared by different owners in one build (condos, bad data). */
const AMBIGUOUS = "";

/**
 * @typedef {{ v: number, built: string, owners: Record<string, string>, changes: Record<string, [string, string]> }} OwnerSnapshot
 *   owners: parcel id → owner name ("" when ambiguous).
 *   changes: parcel id → [previous owner, YYYY-MM the change was seen].
 */

/** "2026-11" for a date (UTC). */
export function buildMonthOf(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Whole months from `from` to `to` (both YYYY-MM); NaN if either is malformed. */
export function monthsBetween(from, to) {
  const a = /^(\d{4})-(\d{2})$/.exec(String(from));
  const b = /^(\d{4})-(\d{2})$/.exec(String(to));
  if (!a || !b) return Number.NaN;
  return (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2]));
}

/**
 * An owner name reduced to what a sale would change: case, spacing,
 * punctuation and the legal tails ("ETAL", "ET UX") that counties add and drop
 * between exports don't count as a new owner.
 */
export function normalizeOwnerForHistory(name) {
  return String(name ?? "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(ETAL|ET AL|ETUX|ET UX|ETVIR|ET VIR)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether two owner names are the same owner for history purposes. */
export function sameOwnerForHistory(a, b) {
  return normalizeOwnerForHistory(a) === normalizeOwnerForHistory(b);
}

/** @returns {OwnerSnapshot} */
export function emptySnapshot(built = "") {
  return { v: SNAPSHOT_VERSION, built, owners: {}, changes: {} };
}

/** A parsed snapshot, or an empty one when the input isn't a usable snapshot. */
export function coerceSnapshot(value) {
  if (!value || typeof value !== "object" || value.v !== SNAPSHOT_VERSION) {
    return emptySnapshot();
  }
  const owners = value.owners && typeof value.owners === "object" ? value.owners : {};
  const changes = value.changes && typeof value.changes === "object" ? value.changes : {};
  return { v: SNAPSHOT_VERSION, built: String(value.built ?? ""), owners, changes };
}

/**
 * Tracks one county through one build. Feed it every parcel as it streams
 * (`observe`), then ask `stampFor(pin)` for the properties to put on that
 * parcel's tile feature and `finish()` for the snapshot to save for next
 * month. Stamps are only final once every parcel has been seen — a parcel id
 * can turn out to be shared by two owners, or the whole county can turn out
 * to have been reformatted — so the build writes parcels with their id and
 * stamps them in a second pass (see fetch-parcels-geojson.mjs).
 *
 * @param {OwnerSnapshot} previous
 * @param {string} buildMonth YYYY-MM
 */
export function createOwnerHistory(previous, buildMonth) {
  const prev = coerceSnapshot(previous);
  /** @type {Record<string, string>} */
  const owners = {};
  /** @type {Record<string, [string, string]>} */
  const changes = {};
  /** Ids whose change was first seen this build (vs carried forward). */
  const fresh = new Set();
  let compared = 0;
  let changed = 0;

  // A change carried from an earlier build stays only while the owner it was
  // recorded against is still the owner, and until it ages out.
  const carried = (pin, owner) => {
    const c = prev.changes[pin];
    if (!Array.isArray(c) || c.length < 2) return undefined;
    const age = monthsBetween(c[1], buildMonth);
    if (!(age >= 0 && age < CHANGE_KEEP_MONTHS)) return undefined;
    const recordedOwner = prev.owners[pin];
    if (recordedOwner === undefined || recordedOwner === AMBIGUOUS) return undefined;
    if (!sameOwnerForHistory(recordedOwner, owner)) return undefined;
    return [String(c[0]), String(c[1])];
  };

  const isMassChange = () =>
    compared >= MASS_CHANGE_MIN_COMPARED && changed / compared > MASS_CHANGE_SHARE;

  /** The change to show for a parcel id, once every parcel has been seen. */
  const finalChange = (key) => {
    if (!key || !owners[key] || owners[key] === AMBIGUOUS) return undefined;
    const c = changes[key];
    if (!c) return undefined;
    // On a mass change only this build's "changes" are suspect; changes
    // carried from earlier builds still stand.
    if (fresh.has(key) && isMassChange()) return undefined;
    return c;
  };

  return {
    /**
     * @param {string} pin the county's parcel id ("" when it has none)
     * @param {string} owner the current owner
     */
    observe(pin, owner) {
      const key = String(pin ?? "").trim();
      if (!key || !owner) return;

      // A second, different owner under one id makes the id useless for
      // history (condo units, a county's placeholder id).
      const seen = owners[key];
      if (seen !== undefined) {
        if (seen !== AMBIGUOUS && !sameOwnerForHistory(seen, owner)) {
          owners[key] = AMBIGUOUS;
        }
        return;
      }
      owners[key] = owner;

      const before = prev.owners[key];
      if (before === undefined || before === AMBIGUOUS) return;
      compared += 1;
      if (!sameOwnerForHistory(before, owner)) {
        changed += 1;
        changes[key] = [before, buildMonth];
        fresh.add(key);
        return;
      }
      const c = carried(key, owner);
      if (c) changes[key] = c;
    },

    /**
     * Tile properties for a parcel: `prev` (previous owner) and `chg`
     * (YYYY-MM the change was seen), or {} when it hasn't changed hands.
     * @returns {{ prev?: string, chg?: string }}
     */
    stampFor(pin) {
      const c = finalChange(String(pin ?? "").trim());
      return c ? { prev: c[0], chg: c[1] } : {};
    },

    stats() {
      return { compared, changed, massChange: isMassChange() };
    },

    /**
     * The snapshot to keep for the next build. On a mass change the new names
     * simply become the baseline.
     * @returns {OwnerSnapshot}
     */
    finish() {
      const kept = {};
      for (const key of Object.keys(changes)) {
        const c = finalChange(key);
        if (c) kept[key] = c;
      }
      return { v: SNAPSHOT_VERSION, built: buildMonth, owners, changes: kept };
    },
  };
}

// --- File helpers (gzip JSON) ----------------------------------------------

/** Reads a gzip JSON snapshot; an empty snapshot when missing or unreadable. */
export function readSnapshotFile(path) {
  if (!path || !existsSync(path)) return emptySnapshot();
  try {
    return coerceSnapshot(JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")));
  } catch {
    return emptySnapshot();
  }
}

export function writeSnapshotFile(path, snapshot) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, gzipSync(Buffer.from(JSON.stringify(snapshot), "utf8")));
}
