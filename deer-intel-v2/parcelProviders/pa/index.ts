import type { CountyParcelProvider } from "@/types/parcel";

const PASDA_PA_PARCELS_SERVICE_URL =
  "https://maps.pasda.psu.edu/arcgis/rest/services/PA_Parcels/MapServer";

const ADAMS_PARCEL_OWNER_SERVICE_URL =
  "https://mapping.adamscountypa.gov/arcgis/rest/services/AGOL/Parcel_Owners/MapServer";

const PA_COUNTIES: Array<{ countyFips: string; countyName: string }> = [
  { countyFips: "001", countyName: "Adams" },
  { countyFips: "003", countyName: "Allegheny" },
  { countyFips: "005", countyName: "Armstrong" },
  { countyFips: "007", countyName: "Beaver" },
  { countyFips: "009", countyName: "Bedford" },
  { countyFips: "011", countyName: "Berks" },
  { countyFips: "013", countyName: "Blair" },
  { countyFips: "015", countyName: "Bradford" },
  { countyFips: "017", countyName: "Bucks" },
  { countyFips: "019", countyName: "Butler" },
  { countyFips: "021", countyName: "Cambria" },
  { countyFips: "023", countyName: "Cameron" },
  { countyFips: "025", countyName: "Carbon" },
  { countyFips: "027", countyName: "Centre" },
  { countyFips: "029", countyName: "Chester" },
  { countyFips: "031", countyName: "Clarion" },
  { countyFips: "033", countyName: "Clearfield" },
  { countyFips: "035", countyName: "Clinton" },
  { countyFips: "037", countyName: "Columbia" },
  { countyFips: "039", countyName: "Crawford" },
  { countyFips: "041", countyName: "Cumberland" },
  { countyFips: "043", countyName: "Dauphin" },
  { countyFips: "045", countyName: "Delaware" },
  { countyFips: "047", countyName: "Elk" },
  { countyFips: "049", countyName: "Erie" },
  { countyFips: "051", countyName: "Fayette" },
  { countyFips: "053", countyName: "Forest" },
  { countyFips: "055", countyName: "Franklin" },
  { countyFips: "057", countyName: "Fulton" },
  { countyFips: "059", countyName: "Greene" },
  { countyFips: "061", countyName: "Huntingdon" },
  { countyFips: "063", countyName: "Indiana" },
  { countyFips: "065", countyName: "Jefferson" },
  { countyFips: "067", countyName: "Juniata" },
  { countyFips: "069", countyName: "Lackawanna" },
  { countyFips: "071", countyName: "Lancaster" },
  { countyFips: "073", countyName: "Lawrence" },
  { countyFips: "075", countyName: "Lebanon" },
  { countyFips: "077", countyName: "Lehigh" },
  { countyFips: "079", countyName: "Luzerne" },
  { countyFips: "081", countyName: "Lycoming" },
  { countyFips: "083", countyName: "McKean" },
  { countyFips: "085", countyName: "Mercer" },
  { countyFips: "087", countyName: "Mifflin" },
  { countyFips: "089", countyName: "Monroe" },
  { countyFips: "091", countyName: "Montgomery" },
  { countyFips: "093", countyName: "Montour" },
  { countyFips: "095", countyName: "Northampton" },
  { countyFips: "097", countyName: "Northumberland" },
  { countyFips: "099", countyName: "Perry" },
  { countyFips: "101", countyName: "Philadelphia" },
  { countyFips: "103", countyName: "Pike" },
  { countyFips: "105", countyName: "Potter" },
  { countyFips: "107", countyName: "Schuylkill" },
  { countyFips: "109", countyName: "Snyder" },
  { countyFips: "111", countyName: "Somerset" },
  { countyFips: "113", countyName: "Sullivan" },
  { countyFips: "115", countyName: "Susquehanna" },
  { countyFips: "117", countyName: "Tioga" },
  { countyFips: "119", countyName: "Union" },
  { countyFips: "121", countyName: "Venango" },
  { countyFips: "123", countyName: "Warren" },
  { countyFips: "125", countyName: "Washington" },
  { countyFips: "127", countyName: "Wayne" },
  { countyFips: "129", countyName: "Westmoreland" },
  { countyFips: "131", countyName: "Wyoming" },
  { countyFips: "133", countyName: "York" },
];

const COUNTY_OVERRIDES: Record<string, Partial<CountyParcelProvider>> = {
  Adams: {
    acreageFieldNames: ["DEEDED_ACRES", "Map_Ac"],
    addressFieldNames: ["COMBINED_SITUS"],
    geometrySupport: "polygon",
    notes: "Adams County public Parcel Owners ArcGIS layer.",
    ownerFieldNames: ["SHORT_NAME"],
    parcelIdFieldNames: ["Parcel_ID"],
    parcelLayerId: 0,
    parcelServiceUrl: ADAMS_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
    status: "supported",
  },
  Cameron: {
    acreageFieldNames: ["Shape_Area"],
    addressFieldNames: [],
    geometrySupport: "polygon",
    notes:
      "PASDA statewide parcel layer has parcel geometry/PIN but no owner fields.",
    ownerFieldNames: [],
    parcelIdFieldNames: ["PIN"],
    parcelLayerId: 1,
    parcelServiceUrl: PASDA_PA_PARCELS_SERVICE_URL,
    source: "PASDA",
    status: "partial",
  },
  Franklin: {
    acreageFieldNames: ["Shape_Area"],
    addressFieldNames: [],
    geometrySupport: "polygon",
    notes:
      "PASDA statewide parcel layer has parcel geometry/PIN but no owner fields.",
    ownerFieldNames: [],
    parcelIdFieldNames: ["PIN"],
    parcelLayerId: 1,
    parcelServiceUrl: PASDA_PA_PARCELS_SERVICE_URL,
    source: "PASDA",
    status: "partial",
  },
};

export const PA_COUNTY_PARCEL_PROVIDERS: CountyParcelProvider[] =
  PA_COUNTIES.map((county) => ({
    acreageFieldNames: [],
    addressFieldNames: [],
    countyFips: county.countyFips,
    countyName: county.countyName,
    geometrySupport: "none",
    ownerFieldNames: [],
    parcelIdFieldNames: [],
    source: "Unavailable",
    status: "unavailable",
    ...COUNTY_OVERRIDES[county.countyName],
  }));

export function getPaParcelProviderByCounty(
  countyName: string,
): CountyParcelProvider | undefined {
  const normalizedCountyName = normalizeCountyName(countyName);

  return PA_COUNTY_PARCEL_PROVIDERS.find(
    (provider) => normalizeCountyName(provider.countyName) === normalizedCountyName,
  );
}

export function getPaParcelProviderByFips(
  countyFips: string,
): CountyParcelProvider | undefined {
  const normalizedFips = countyFips.padStart(3, "0");

  return PA_COUNTY_PARCEL_PROVIDERS.find(
    (provider) => provider.countyFips === normalizedFips,
  );
}

function normalizeCountyName(countyName: string) {
  return countyName
    .replace(/\s+county$/i, "")
    .trim()
    .toLowerCase();
}
