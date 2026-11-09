// Shared formatting for land-owner map labels rendered by the statewide
// parcel-tiles overlay (components/map/ParcelTilesLayer.tsx).

// The acreage caption shown under an owner name, Spartan-Forge style: the value
// with up to two decimals (trailing zeros trimmed) and the word "acre(s)"
// spelled out — "0.21 acres", "1.03 acres", "12 acres". Empty when there's no
// usable acreage to show.
//
// The tiles can also carry `mac` (mapped acres: the polygon's own area, for a
// parcel or holding the county gives no acreage for) and, on holding labels,
// `alb: 1` (some parcel had no county acreage, so `acres` is a lower bound).
// Pass them as options: no county acres + mapped -> "~12 acres (mapped)";
// a lower-bound total -> "at least 40 acres".
export function ownerAcresText(
  acres: number,
  options: { mappedAcres?: number; atLeast?: boolean } = {},
): string {
  const fmt = (value: number) => {
    const rounded = value >= 100 ? value.toFixed(0) : value.toFixed(2);
    const trimmed = rounded.includes(".")
      ? rounded.replace(/\.?0+$/, "")
      : rounded;
    return `${trimmed} ${trimmed === "1" ? "acre" : "acres"}`;
  };
  const mapped = Number(options.mappedAcres) || 0;
  if (!(acres > 0)) return mapped > 0 ? `~${fmt(mapped)} (mapped)` : "";
  return options.atLeast ? `at least ${fmt(acres)}` : fmt(acres);
}

// Drop a care-of contact folded into an owner name ("SMITH TRUST C/O MR & MRS
// JONES" -> "SMITH TRUST"), plus the "&"/comma it leaves dangling. MUST behave
// like stripCareOf in scripts/fetch-parcels-geojson.mjs, which cleans the tile
// names; the live owner lookup uses this one so the two names match.
export function stripCareOf(owner: string): string {
  const name = String(owner ?? "").trim().replace(/\s+/g, " ");
  const cut = name.replace(/\s*\bC\/O\b.*$/i, "").replace(/[\s,&]+$/, "").trim();
  // A name that is nothing but a care-of line keeps the contact, not nothing.
  return cut || name.replace(/^C\/O\b[\s,]*/i, "").trim();
}

// The owner name as printed on the map: county records carry legal suffixes
// ("ETAL", "ET UX") that eat label width without telling a hunter anything,
// and state game lands often come as "COMMONWEALTH OF PA STATE GAME LANDS".
// The full record name still shows on the owner card.
export function ownerDisplayName(owner: string): string {
  let name = owner.trim().replace(/\s+/g, " ").toUpperCase();
  const gameLands = /STATE GAME LANDS?(\s*(NO\.?|#)?\s*\d+)?/.exec(name);
  if (gameLands) return gameLands[0].replace(/LAND$/, "LANDS");
  name = name.replace(/[\s,&]+(ETAL|ET AL|ET UX|ETUX|ET VIR|ETVIR)\.?$/, "");
  return name.replace(/[\s,&]+$/, "") || owner.trim().toUpperCase();
}

// Government / public land, by name (PA and MD). MUST stay identical to the
// tile build's PUBLIC_OWNER_PATTERN (scripts/fetch-parcels-geojson.mjs), which
// sets the tiles' `pub` flag, so a parcel whose flag is missing still reads as
// public; lib/__tests__/parcelOwnerFields.test.ts checks the two match.
export const PUBLIC_OWNER_PATTERN =
  /\b(COMMONWEALTH|STATE GAME LAND|GAME COMMISSION|DCNR|BUREAU OF FOREST|STATE FOREST|STATE PARK|UNITED STATES|U ?S ?A\b|FEDERAL|NATIONAL PARK|FOREST SERVICE|FISH (AND|&) BOAT|COUNTY OF|TOWNSHIP OF|BOROUGH OF|MUNICIPAL|SCHOOL DISTRICT|BOARD OF EDUCATION|AUTHORITY|DEP(ARTMEN)?T\.? OF|STATE OF MARYLAND|COUNTY,? (OF )?MARYLAND\b|COMMISSIONERS|SUPERVISORS|MAYOR (AND|&) (CITY )?COUNCIL)/i;

export function isPublicOwnerName(owner: string): boolean {
  return PUBLIC_OWNER_PATTERN.test(owner);
}

// Owner names reduced to comparable words: upper case, punctuation dropped,
// legal suffixes ("ETAL", "ET UX") removed.
function ownerWords(name: string): string[] {
  const words = name
    .toUpperCase()
    .replace(/&/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const next = words[i + 1];
    if (word === "ETAL" || word === "ETUX" || word === "ETVIR") continue;
    if (word === "ET" && (next === "AL" || next === "UX" || next === "VIR")) {
      i += 1;
      continue;
    }
    out.push(word);
  }
  return out;
}

/**
 * Whether two owner names describe the same owner record. Tolerant of spacing,
 * punctuation, legal suffixes, and one name being a shortened form of the
 * other (a co-owner the other source left off, or a truncated field).
 */
export function ownersMatch(a: string, b: string): boolean {
  const wa = ownerWords(a);
  const wb = ownerWords(b);
  if (!wa.length || !wb.length) return wa.length === wb.length;
  // Same letters, different spacing/punctuation ("MC DONALD" / "MCDONALD").
  if (wa.join("") === wb.join("")) return true;
  const [small, large] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  // One is the other's leading words, the last possibly cut short by a
  // fixed-width field ("SMITH JOHN R & MARY L" / "SMITH JOHN R & MA").
  // A lone word must match whole, or "SMITH" would match "SMITHERS FARM".
  const leading = small.every((word, i) =>
    i < small.length - 1 || small.length === 1
      ? word === large[i]
      : Boolean(large[i]?.startsWith(word)),
  );
  if (leading) return true;
  // Or all of one's words appear in the other (a co-owner listed first or
  // left off: "SMITH MARY" / "SMITH JOHN & MARY").
  const pool = new Set(large);
  return small.every((word) => pool.has(word));
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The month a parcel changed hands as printed on the map and owner card:
 * the tiles' `chg` ("2026-11") → "Nov 2026". Empty for anything malformed.
 */
export function ownerChangeMonthText(chg: unknown): string {
  const m = /^(\d{4})-(\d{2})$/.exec(typeof chg === "string" ? chg.trim() : "");
  if (!m) return "";
  const month = Number(m[2]);
  if (month < 1 || month > 12) return "";
  return `${MONTH_ABBR[month - 1]} ${m[1]}`;
}

/**
 * The "Previously: …" line for an owner card, or "" when the parcel hasn't
 * changed hands (or the previous owner is the same name, reformatted).
 */
export function previousOwnerText(prev: unknown, chg: unknown, currentOwner = ""): string {
  const name = typeof prev === "string" ? prev.trim() : "";
  if (!name) return "";
  if (currentOwner && ownerWords(name).join("") === ownerWords(currentOwner).join("")) return "";
  const month = ownerChangeMonthText(chg);
  return month ? `${name} (changed ${month})` : name;
}
