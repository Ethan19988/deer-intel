import type { CountyParcelProvider } from "@/types/parcel";

const ADAMS_PARCEL_OWNER_SERVICE_URL =
  "https://mapping.adamscountypa.gov/arcgis/rest/services/AGOL/Parcel_Owners/MapServer";

// Cameron County's own ArcGIS Online parcel FeatureServer (updated Sept 2025),
// which includes assessment owner names — unlike the PASDA statewide layer.
const CAMERON_PARCEL_OWNER_SERVICE_URL =
  "https://services5.arcgis.com/NN66N9nlzcCXJ9he/arcgis/rest/services/Parcels_(September_2025)/FeatureServer";

// Northampton County's own ArcGIS Online parcel layer (~122k parcels), which
// carries assessment owner names and the situs address. PASDA's Northampton
// parcels have geometry but no owner field.
const NORTHAMPTON_PARCEL_OWNER_SERVICE_URL =
  "https://services2.arcgis.com/NlbUAihbvA50xxJw/arcgis/rest/services/Northampton_Parcels/FeatureServer";

// Wayne County's own ArcGIS Online tax parcels (~58k). Owner + acreage only:
// it publishes no parcel address (PropertyLocation is null throughout, and the
// Address/City fields are the owner's mailing address).
const WAYNE_PARCEL_OWNER_SERVICE_URL =
  "https://services1.arcgis.com/VMKRr2Ecl6EFwJpm/arcgis/rest/services/TaxParcels/FeatureServer";

// Carbon County runs its own ArcGIS Server; "Parcels Universal" carries the
// assessment owner, deeded acreage and parcel location.
const CARBON_PARCEL_OWNER_SERVICE_URL =
  "https://gis.carboncounty.com/arcgis/rest/services/Parcels_Universal/MapServer";

// Mifflin County republishes its parcels under a date-stamped name (parcelsMMDDYY
// / parcels_MMDDYY), keeping the older copies. Tap-to-identify points at the
// Oct 2026 copy; the tile build looks up the newest one each run.
const MIFFLIN_PARCEL_OWNER_SERVICE_URL =
  "https://gis.mifflincountypa.gov/arcgis/rest/services/Hosted/parcels_102126/FeatureServer";

// Pike County's own ArcGIS Server parcel layer (layer 1) with assessment owners.
const PIKE_PARCEL_OWNER_SERVICE_URL =
  "https://gis.pikepa.org/arcgis/rest/services/PikeCo_Parcels/MapServer";

// Cambria County's ArcGIS Online "Surface Owners" layer (8). Its layer 7
// "Tax Parcels" carries no owner fields.
const CAMBRIA_PARCEL_OWNER_SERVICE_URL =
  "https://services1.arcgis.com/Fw15y9AZK02r2ZNA/arcgis/rest/services/GIS_Layers/FeatureServer";

// Clearfield County's parcels are served from Centre County's GIS host.
const CLEARFIELD_PARCEL_OWNER_SERVICE_URL =
  "https://gissites4.centrecountypa.gov/arcgis/rest/services/CentreRoadsAdmin/MapServer";

// Huntingdon County's ArcGIS Online parcels joined to CAMA (layer 1).
const HUNTINGDON_PARCEL_OWNER_SERVICE_URL =
  "https://services3.arcgis.com/liWtJPxLI3mlx8pH/arcgis/rest/services/Property_Lines/FeatureServer";

// Lycoming County's own ArcGIS Server. Layer 4 is a join, so its field names
// carry the table prefix (DBO.ParcelAttributes.FULL_NAME, …).
const LYCOMING_PARCEL_OWNER_SERVICE_URL =
  "https://gis.lyco.org/arcgis/rest/services/Parcels/MapServer";

// Potter County's own ArcGIS Server tax parcels.
const POTTER_PARCEL_OWNER_SERVICE_URL =
  "https://maps.pottercountypa.net/arcgis/rest/services/TaxParcel/TaxParcels/MapServer";

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

// PA DEP's statewide parcel layer: owner names for ~40 counties in one layer.
// Used only where a county runs no public owner source of its own (owner
// names spot-checked live per county). A tap lookup is a point query, so no
// county filter is needed.
const PA_DEP_PARCEL_SERVICE_URL =
  "https://gis.dep.pa.gov/depgisprd/rest/services/Parcels/PA_Parcels/MapServer";

function paDepCounty(countyName: string): Partial<CountyParcelProvider> {
  return {
    acreageFieldNames: ["ACREAGE", "ACRES"],
    // PROPERTY_ADDRESS_1 is a mailing address in some counties.
    addressFieldNames: [],
    geometrySupport: "polygon",
    notes: `PA DEP statewide parcels (${countyName} rows); no data date published.`,
    ownerFieldNames: ["OWNER_NAME"],
    parcelIdFieldNames: ["PARCEL_ID"],
    parcelLayerId: 0,
    parcelServiceUrl: PA_DEP_PARCEL_SERVICE_URL,
    source: "PA DEP",
    status: "supported",
  };
}

function countyArcgis(
  config: Pick<
    CountyParcelProvider,
    | "acreageFieldNames"
    | "addressFieldNames"
    | "ownerFieldNames"
    | "parcelIdFieldNames"
    | "parcelLayerId"
    | "parcelServiceUrl"
    | "notes"
  > & {
    addressFieldGroups?: string[][];
    source?: CountyParcelProvider["source"];
  },
): Partial<CountyParcelProvider> {
  return {
    geometrySupport: "polygon",
    source: "County ArcGIS",
    status: "supported",
    ...config,
  };
}

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
    addressFieldNames: [],
    // Prefer the composed situs (property) address; fall back to the owner's
    // mailing address for parcels with no situs on file (e.g. vacant land).
    addressFieldGroups: [
      ["SitusSt", "SitusDir", "SitusDesc1", "SitusSufx"],
      ["OwnerAddr1", "OwnerCity"],
    ],
    geometrySupport: "polygon",
    notes: "Cameron County ArcGIS Online parcel layer with assessment owner names.",
    ownerFieldNames: ["OwnerName1", "OwnerName2"],
    parcelIdFieldNames: ["PIN", "MapNumber"],
    parcelLayerId: 0,
    parcelServiceUrl: CAMERON_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
    status: "supported",
  },
  Cambria: {
    acreageFieldNames: ["ACREAGE"],
    addressFieldNames: ["SITUS_DESC_1"],
    geometrySupport: "polygon",
    notes: "Cambria County ArcGIS Online Surface Owners layer.",
    ownerFieldNames: ["OWNER_NAME_1", "OWNER_NAME_2"],
    parcelIdFieldNames: ["CONTROL_NUMBER", "MAP_NUMBER"],
    parcelLayerId: 8,
    parcelServiceUrl: CAMBRIA_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
    status: "supported",
  },
  Carbon: {
    acreageFieldNames: ["DeedAcr", "CALCAC"],
    addressFieldNames: ["Location"],
    geometrySupport: "polygon",
    notes: "Carbon County ArcGIS Server parcels with assessment owner names.",
    ownerFieldNames: ["Owner"],
    parcelIdFieldNames: ["PIN", "ParcelID"],
    parcelLayerId: 0,
    parcelServiceUrl: CARBON_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
    status: "supported",
  },
  Chester: {
    // ACRE_PLA_1 was ACRE_PLAN1 before the 2026 upload; a missing field makes
    // the whole query fail.
    acreageFieldNames: ["ACRE_PLAN_", "ACRE_PLA_1"],
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
  Clearfield: {
    // No address: ADD1-ADD4 look like the owner's mailing address.
    acreageFieldNames: ["ACRES"],
    addressFieldNames: [],
    geometrySupport: "polygon",
    notes: "Clearfield County parcels, served from Centre County's GIS host.",
    ownerFieldNames: ["NAME"],
    parcelIdFieldNames: ["PIN", "PARCEL_ID"],
    parcelLayerId: 40,
    parcelServiceUrl: CLEARFIELD_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
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
  Huntingdon: {
    // No parcel address published; Owner_Addr is the mailing address.
    acreageFieldNames: ["CAMA_ACRES", "MAP_ACRES"],
    addressFieldNames: [],
    geometrySupport: "polygon",
    notes: "Huntingdon County ArcGIS Online parcels joined to CAMA.",
    ownerFieldNames: ["Owner_Name"],
    parcelIdFieldNames: ["TAXIDNUM"],
    parcelLayerId: 1,
    parcelServiceUrl: HUNTINGDON_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
    status: "supported",
  },
  Indiana: {
    acreageFieldNames: ["DEEDED_ACR", "ACRES", "GIS_ACRES"],
    addressFieldNames: ["COMBINED_S"],
    // Fall back to the parts when the combined situs string is blank.
    addressFieldGroups: [["COMBINED_S"], ["ADDRESS_1", "CITY", "STATE", "ZIP"]],
    geometrySupport: "polygon",
    notes: "PASDA Indiana County parcel layer (5) with assessment owner names.",
    ownerFieldNames: ["NAME_EXT", "SHORT_NAME"],
    parcelIdFieldNames: ["PARCEL_ID", "PARCEL_NO", "GIS_PIN"],
    parcelLayerId: 5,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Indiana"),
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
  Lycoming: {
    acreageFieldNames: ["DBO.ParcelAttributes.DEED_ACRES"],
    addressFieldNames: ["DBO.ParcelAttributes.SITUS"],
    geometrySupport: "polygon",
    notes: "Lycoming County ArcGIS Server parcels (layer 4, joined attributes).",
    ownerFieldNames: ["DBO.ParcelAttributes.FULL_NAME"],
    parcelIdFieldNames: ["DBO.Parcels.TXID_NMBR", "DBO.Parcels.PARCEL"],
    parcelLayerId: 4,
    parcelServiceUrl: LYCOMING_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
    status: "supported",
  },
  Mifflin: {
    acreageFieldNames: ["deed_acres", "avacres"],
    addressFieldNames: ["situs_comb"],
    geometrySupport: "polygon",
    notes: "Mifflin County hosted parcels with assessment owner names.",
    ownerFieldNames: ["short_name"],
    parcelIdFieldNames: ["account"],
    parcelLayerId: 0,
    parcelServiceUrl: MIFFLIN_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
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
  Northampton: {
    acreageFieldNames: ["ASSMNT_AC"],
    addressFieldNames: ["LOCATION"],
    geometrySupport: "polygon",
    notes:
      "Northampton County ArcGIS Online parcels. PASDA's Northampton layer has geometry but no owner field.",
    ownerFieldNames: ["OWNER_LN1", "OWNER_LN2"],
    parcelIdFieldNames: ["PARCEL_ID", "CAMA_ID"],
    parcelLayerId: 0,
    parcelServiceUrl: NORTHAMPTON_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
    status: "supported",
  },
  Pike: {
    acreageFieldNames: ["Acreage"],
    addressFieldNames: ["Situs"],
    geometrySupport: "polygon",
    notes: "Pike County ArcGIS Server parcels with assessment owner names.",
    ownerFieldNames: ["Name"],
    parcelIdFieldNames: ["Control", "MAP_JOIN"],
    parcelLayerId: 1,
    parcelServiceUrl: PIKE_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
    status: "supported",
  },
  Potter: {
    acreageFieldNames: ["Acreage"],
    addressFieldNames: ["Situs_Complete"],
    geometrySupport: "polygon",
    notes: "Potter County ArcGIS Server tax parcels.",
    ownerFieldNames: ["Owner_Name_1", "Owner_Name_2"],
    parcelIdFieldNames: ["Control_Number"],
    parcelLayerId: 0,
    parcelServiceUrl: POTTER_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
    status: "supported",
  },
  Wayne: {
    // No address fields: the layer publishes none for the parcel itself.
    acreageFieldNames: ["Acreage", "GISACRE"],
    addressFieldNames: [],
    geometrySupport: "polygon",
    notes:
      "Wayne County ArcGIS Online tax parcels. Owner + acreage only — no situs address published.",
    ownerFieldNames: ["Name", "FullName"],
    parcelIdFieldNames: ["ControlNumber", "PARCELNO"],
    parcelLayerId: 0,
    parcelServiceUrl: WAYNE_PARCEL_OWNER_SERVICE_URL,
    source: "County ArcGIS",
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

  // Added 2026-11-08 (same sources as scripts/fetch-parcels-geojson.mjs).
  Beaver: countyArcgis({
    acreageFieldNames: ["Total_Acres", "GIS_Ac"],
    addressFieldNames: [],
    addressFieldGroups: [["Location_Number", "Location_Street"]],
    notes: "Beaver County ArcGIS Server parcels with owner names.",
    ownerFieldNames: ["Owner_Name1", "Owner_Name2"],
    parcelIdFieldNames: ["Parcel_ID"],
    parcelLayerId: 22,
    parcelServiceUrl:
      "https://gis.beavercountypa.gov/server/rest/services/InfoAtlas/Parcels_with_Owner/FeatureServer",
  }),
  Centre: countyArcgis({
    acreageFieldNames: ["Cama_acres"],
    addressFieldNames: ["Location"],
    notes: "Centre County DataScout parcels with owner names.",
    ownerFieldNames: ["Name"],
    parcelIdFieldNames: ["TAXIDNUM"],
    parcelLayerId: 10,
    parcelServiceUrl:
      "https://gissites4.centrecountypa.gov/arcgis/rest/services/DataScoutParcels/MapServer",
  }),
  Crawford: countyArcgis({
    acreageFieldNames: ["GIS_ACRES"],
    addressFieldNames: ["REM_PRCL_LOCN"],
    notes: "Crawford County ArcGIS Server tax parcels (GIS acreage).",
    ownerFieldNames: ["OWN_NAME1", "OWN_NAME2"],
    parcelIdFieldNames: ["CAMA_PIN"],
    parcelLayerId: 1,
    parcelServiceUrl:
      "https://gis.crawfordcountypa.net/arcgis/rest/services/CivQuest_Public/MapServer",
  }),
  Cumberland: countyArcgis({
    acreageFieldNames: ["DEEDED_AC", "CalcAcre"],
    addressFieldNames: ["SITUS"],
    notes: "Cumberland County ArcGIS Online tax parcels.",
    ownerFieldNames: ["OWNER"],
    parcelIdFieldNames: ["PIN"],
    parcelLayerId: 0,
    parcelServiceUrl:
      "https://services1.arcgis.com/1Cfo0re3un0w6a30/arcgis/rest/services/Tax_Parcels/FeatureServer",
  }),
  Elk: countyArcgis({
    acreageFieldNames: ["camadb_ACR"],
    addressFieldNames: ["camadb_LOC"],
    notes: "Elk County parcels on the North Central PA regional ArcGIS Online.",
    ownerFieldNames: ["camadb_NAM"],
    parcelIdFieldNames: ["camadb_pin"],
    parcelLayerId: 0,
    parcelServiceUrl:
      "https://services1.arcgis.com/qXvbYftT9ld1YWzi/arcgis/rest/services/Elk_County_view/FeatureServer",
  }),
  Jefferson: countyArcgis({
    acreageFieldNames: [],
    addressFieldNames: ["AdrLabel"],
    notes: "Jefferson County parcels on the North Central PA regional ArcGIS Online.",
    ownerFieldNames: ["OwnerName"],
    parcelIdFieldNames: ["ParcelId"],
    parcelLayerId: 0,
    parcelServiceUrl:
      "https://services1.arcgis.com/qXvbYftT9ld1YWzi/arcgis/rest/services/Jefferson_County_Parcels_View/FeatureServer",
  }),
  Lebanon: countyArcgis({
    acreageFieldNames: ["DEEDED_ACR"],
    addressFieldNames: ["SITUS_ADDR"],
    notes: "Lebanon County tax parcels (shared through an ArcGIS Online proxy URL).",
    ownerFieldNames: ["OWNER", "SECOND_LIS"],
    parcelIdFieldNames: ["MAP_NUMBER"],
    parcelLayerId: 0,
    parcelServiceUrl:
      "https://utility.arcgis.com/usrsvcs/servers/7072ca11c43c43feb1ab453851e847b9/rest/services/LandRecords/TaxParcels/MapServer",
  }),
  Luzerne: countyArcgis({
    acreageFieldNames: [],
    addressFieldNames: [],
    notes: "Luzerne County ArcGIS Server tax parcels; no acreage or parcel address.",
    ownerFieldNames: ["PUB_OWNER"],
    parcelIdFieldNames: ["PIN"],
    parcelLayerId: 1,
    parcelServiceUrl: "https://gis.luzernecounty.org/server/rest/services/PublicMap/MapServer",
  }),
  Mercer: countyArcgis({
    acreageFieldNames: ["Acreage"],
    addressFieldNames: ["Situs_Desc"],
    notes: "PASDA Mercer County tax parcels (March 2026).",
    ownerFieldNames: ["Comb_Owner"],
    parcelIdFieldNames: ["Parcel_Id"],
    parcelLayerId: 0,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Mercer"),
    source: "PASDA",
  }),
  Philadelphia: countyArcgis({
    acreageFieldNames: [],
    addressFieldNames: ["ADDRESS"],
    notes: "PASDA copy of Philadelphia parcels.",
    ownerFieldNames: ["OWNER1", "OWNER2"],
    parcelIdFieldNames: ["PARCELID"],
    parcelLayerId: 14,
    parcelServiceUrl: `${PASDA_COUNTY_SERVICE_ROOT}/CityPhilly/MapServer`,
    source: "PASDA",
  }),
  Snyder: countyArcgis({
    acreageFieldNames: ["Acreage", "GISAcres"],
    addressFieldNames: ["SitusDesc"],
    notes: "Snyder County parcels on Union County's GIS server.",
    ownerFieldNames: ["Owner"],
    parcelIdFieldNames: ["PIN"],
    parcelLayerId: 1,
    parcelServiceUrl:
      "https://gis.unionco.org/server/rest/services/LandRecords/Snyder_Land_Records/MapServer",
  }),
  Susquehanna: countyArcgis({
    acreageFieldNames: ["DEEDED_ACR"],
    addressFieldNames: ["SITUS_COMBINED"],
    notes: "Susquehanna County ArcGIS Online parcels with CAMA owners.",
    ownerFieldNames: ["COMBINED_NAME"],
    parcelIdFieldNames: ["PIN"],
    parcelLayerId: 0,
    parcelServiceUrl:
      "https://services5.arcgis.com/lmuC4NmaSm4GH9h5/arcgis/rest/services/Parcels_CAMA/FeatureServer",
  }),
  Tioga: countyArcgis({
    acreageFieldNames: ["PRC_TTL_LND_AREA_ACRES"],
    addressFieldNames: ["LOCATION"],
    notes: "Tioga County ArcGIS Server parcel fabric joined to CAMA.",
    ownerFieldNames: ["SLH_OWN_NAME", "SLH_CO_OWN_NAME"],
    parcelIdFieldNames: ["PARCELID"],
    parcelLayerId: 0,
    parcelServiceUrl:
      "https://tiogagis.tiogacountypa.us/arcgis2017/rest/services/01_Parcel_Fabric_CAMA_Lines_REG/MapServer",
  }),
  Union: countyArcgis({
    acreageFieldNames: ["LegalAcres"],
    addressFieldNames: ["LocationAddress"],
    notes: "Union County ArcGIS Server land records.",
    ownerFieldNames: ["OwnName"],
    parcelIdFieldNames: ["ParcelNumber"],
    parcelLayerId: 1,
    parcelServiceUrl:
      "https://gis.unionco.org/server/rest/services/LandRecords/Union_Land_Records/MapServer",
  }),
  Washington: countyArcgis({
    acreageFieldNames: ["parcel_acres"],
    addressFieldNames: [],
    addressFieldGroups: [["legdat_adrno", "legdat_adrdir", "legdat_adrstr", "legdat_adrsuf"]],
    notes: "PASDA Washington County parcels (Aug 2026); GIS acreage.",
    ownerFieldNames: ["owndat_own1"],
    parcelIdFieldNames: ["PIN"],
    parcelLayerId: 7,
    parcelServiceUrl: pasdaCountyParcelServiceUrl("Washington"),
    source: "PASDA",
  }),
  Allegheny: paDepCounty("Allegheny"),
  Blair: paDepCounty("Blair"),
  Clinton: paDepCounty("Clinton"),
  Delaware: paDepCounty("Delaware"),
  Greene: paDepCounty("Greene"),
  Lackawanna: paDepCounty("Lackawanna"),
  Lancaster: paDepCounty("Lancaster"),
  Lehigh: paDepCounty("Lehigh"),
  Northumberland: paDepCounty("Northumberland"),
  Schuylkill: paDepCounty("Schuylkill"),
  Sullivan: paDepCounty("Sullivan"),
  Westmoreland: paDepCounty("Westmoreland"),
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
