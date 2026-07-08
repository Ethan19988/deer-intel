import type { CountyParcelProvider } from "@/types/parcel";

const ADAMS_PARCEL_OWNER_SERVICE_URL =
  "https://mapping.adamscountypa.gov/arcgis/rest/services/AGOL/Parcel_Owners/MapServer";

// Cameron County's own ArcGIS Online parcel FeatureServer (updated Sept 2025),
// which includes assessment owner names — unlike the PASDA statewide layer.
const CAMERON_PARCEL_OWNER_SERVICE_URL =
  "https://services5.arcgis.com/NN66N9nlzcCXJ9he/arcgis/rest/services/Parcels_(September_2025)/FeatureServer";

// PASDA hosts a per-county parcel MapServer for every PA county at
// .../pasda/<County>County/MapServer. Coverage of owner fields varies by
// county, so each supported county is configured explicitly below.
const PASDA_COUNTY_SERVICE_ROOT =
  "https://mapservices.pasda.psu.edu/server/rest/services/pasda";

function pasdaCountyParcelServiceUrl(countyName: string) {
  return `${PASDA_COUNTY_SERVICE_ROOT}/${countyName.replace(/\s+/g, "")}County/MapServer`;
}

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
  Bedford: {
    acreageFieldNames: ["ACRES"],
    addressFieldNames: ["SITUS_DESC"],
    geometrySupport: "polygon",
    notes: "PASDA Bedford County parcel layer with assessment owner names.",
    ownerFieldNames: ["OWNER_NAME"],
    parcelIdFieldNames: ["Name"],
    parcelLayerId: 0,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Bedford"),
    source: "PASDA",
    status: "supported",
  },
  Berks: {
    acreageFieldNames: ["ACREAGE"],
    addressFieldNames: ["FULLSITEAD"],
    geometrySupport: "polygon",
    notes: "PASDA Berks County parcel layer with assessment owner names.",
    ownerFieldNames: ["NAME1"],
    parcelIdFieldNames: ["PIN"],
    parcelLayerId: 6,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Berks"),
    source: "PASDA",
    status: "supported",
  },
  Bucks: {
    acreageFieldNames: ["DEED_AREA"],
    addressFieldNames: ["ADDRESS"],
    geometrySupport: "polygon",
    notes: "PASDA Bucks County parcel layer with assessment owner names.",
    ownerFieldNames: ["OWNER1", "OWNER2"],
    parcelIdFieldNames: ["PARCEL_NUM"],
    parcelLayerId: 17,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Bucks"),
    source: "PASDA",
    status: "supported",
  },
  Butler: {
    acreageFieldNames: [],
    addressFieldNames: ["Paddr1"],
    geometrySupport: "polygon",
    notes:
      "PASDA Butler County parcel layer with owner names; no acreage field.",
    ownerFieldNames: ["Own1"],
    parcelIdFieldNames: ["PIN"],
    parcelLayerId: 0,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Butler"),
    source: "PASDA",
    status: "supported",
  },
  Cameron: {
    acreageFieldNames: ["Acres"],
    addressFieldNames: ["SitusDesc1"],
    geometrySupport: "polygon",
    notes: "Cameron County ArcGIS Online parcel layer with assessment owner names.",
    ownerFieldNames: ["OwnerName1", "OwnerName2"],
    parcelIdFieldNames: ["PIN", "MapNumber"],
    parcelLayerId: 0,
    parcelServiceUrl: CAMERON_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
    status: "supported",
  },
  Chester: {
    acreageFieldNames: ["ACRE_PLAN_", "ACRE_PLAN1"],
    addressFieldNames: ["LOC_ADDRES"],
    geometrySupport: "polygon",
    notes: "PASDA Chester County parcel layer with assessment owner names.",
    ownerFieldNames: ["OWN1", "OWN2"],
    parcelIdFieldNames: ["PIN_COMMON", "UPI"],
    parcelLayerId: 11,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Chester"),
    source: "PASDA",
    status: "supported",
  },
  Forest: {
    acreageFieldNames: ["ACRES"],
    addressFieldNames: ["SITUS"],
    geometrySupport: "polygon",
    notes: "PASDA Forest County parcel layer with assessment owner names.",
    ownerFieldNames: ["OWNER1"],
    parcelIdFieldNames: ["PARCEL"],
    parcelLayerId: 3,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Forest"),
    source: "PASDA",
    status: "supported",
  },
  Franklin: {
    acreageFieldNames: ["TOTAL_DEED", "BASE_ACRES"],
    addressFieldNames: ["FULL_SITUS"],
    geometrySupport: "polygon",
    notes: "PASDA Franklin County parcel layer with CAMA owner names.",
    ownerFieldNames: ["FULL_OWNER"],
    parcelIdFieldNames: ["CONTROL_NU"],
    parcelLayerId: 0,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Franklin"),
    source: "PASDA",
    status: "supported",
  },
  Juniata: {
    acreageFieldNames: ["Calc_AC", "Assess_Acr"],
    addressFieldNames: ["Physical_A"],
    geometrySupport: "polygon",
    notes: "PASDA Juniata County parcel layer with assessment owner names.",
    ownerFieldNames: ["Owners_Nam"],
    parcelIdFieldNames: ["PIN", "UPI_Number"],
    parcelLayerId: 0,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Juniata"),
    source: "PASDA",
    status: "supported",
  },
  Montgomery: {
    acreageFieldNames: ["LAND_ACRES"],
    addressFieldNames: ["LOCATION1"],
    geometrySupport: "polygon",
    notes: "PASDA Montgomery County parcel layer with assessment owner names.",
    ownerFieldNames: ["OWN1", "OWN2"],
    parcelIdFieldNames: ["PARCEL", "TAXPIN"],
    parcelLayerId: 14,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Montgomery"),
    source: "PASDA",
    status: "supported",
  },
  Wyoming: {
    acreageFieldNames: ["Deeded_Acr", "CALC_AC"],
    addressFieldNames: ["Situs_Addr"],
    geometrySupport: "polygon",
    notes: "PASDA Wyoming County parcel layer with assessment owner names.",
    ownerFieldNames: ["Owner", "Owner_2"],
    parcelIdFieldNames: ["PARCELNUM", "Pin"],
    parcelLayerId: 2,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Wyoming"),
    source: "PASDA",
    status: "supported",
  },
  York: {
    acreageFieldNames: ["ACRES"],
    addressFieldNames: ["PROPADR"],
    geometrySupport: "polygon",
    notes: "PASDA York County parcel layer with assessment owner names.",
    ownerFieldNames: ["OWNER_FULL", "OWN_NAME1"],
    parcelIdFieldNames: ["PIDN"],
    parcelLayerId: 31,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("York"),
    source: "PASDA",
    status: "supported",
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
