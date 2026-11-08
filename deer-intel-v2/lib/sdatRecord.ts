// Maryland parcel tiles carry a short reference to the parcel's official SDAT
// (State Department of Assessments and Taxation) record instead of an owner
// name, because Maryland withholds owner names from its public parcel data.
// The tile build strips this shared prefix to keep the tiles small; keep it in
// sync with SDAT_RECORD_PREFIX in scripts/fetch-parcels-geojson.mjs.
const SDAT_RECORD_PREFIX =
  "https://sdat.dat.maryland.gov/RealProperty/Pages/viewdetails.aspx?";

/** The full SDAT record URL for a tile's `rec` value, or "" if there is none. */
export function sdatRecordUrl(rec: unknown): string {
  const value = typeof rec === "string" ? rec.trim() : "";
  if (!value) return "";
  if (/^https:\/\//i.test(value)) return value;
  return `${SDAT_RECORD_PREFIX}${value}`;
}
