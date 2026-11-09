// Maryland parcel tiles carry a short reference to the parcel's official SDAT
// (State Department of Assessments and Taxation) record instead of an owner
// name, because Maryland withholds owner names from its public parcel data.
// The tile build strips the shared URL prefix to keep the tiles small and
// marks which prefix with a short code; keep these in sync with
// SDAT_RECORD_PREFIXES in scripts/fetch-parcels-geojson.mjs.
//   "a:<query>" -> the RealPropertyAdmin view the state layer links to now
//   "<query>"   -> the older viewdetails page (tiles published before codes)
//   "https://…" -> a link that matched neither, kept whole
export const SDAT_RECORD_PREFIXES: Record<string, string> = {
  "": "https://sdat.dat.maryland.gov/RealProperty/Pages/viewdetails.aspx?",
  "a:": "https://sdat.dat.maryland.gov/RealPropertyAdmin/Pages/view.aspx?",
};

/** The full SDAT record URL for a tile's `rec` value, or "" if there is none. */
export function sdatRecordUrl(rec: unknown): string {
  const value = typeof rec === "string" ? rec.trim() : "";
  if (!value) return "";
  if (/^https:\/\//i.test(value)) return value;
  const coded = /^([a-z]):(.*)$/i.exec(value);
  if (coded) {
    const prefix = SDAT_RECORD_PREFIXES[`${coded[1].toLowerCase()}:`];
    // An unknown code from a newer build: no URL rather than a broken one.
    return prefix && coded[2] ? `${prefix}${coded[2]}` : "";
  }
  return `${SDAT_RECORD_PREFIXES[""]}${value}`;
}
