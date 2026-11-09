import { describe, expect, it } from "vitest";
import {
  COUNTIES,
  PUBLIC_OWNER_PATTERN as BUILD_PUBLIC_OWNER_PATTERN,
  SDAT_RECORD_PREFIXES as BUILD_SDAT_RECORD_PREFIXES,
  buildHoldingLabels,
  geodesicAcres,
  joinCoOwners,
  mdWashingtonAcres,
  ownerReformatOf,
  sdatRecordRef,
  stripCareOf as buildStripCareOf,
  toAcres,
} from "../../scripts/fetch-parcels-geojson.mjs";
import {
  PUBLIC_OWNER_PATTERN,
  isPublicOwnerName,
  ownerAcresText,
  stripCareOf,
} from "@/lib/ownerLabel";
import { joinOwnerFields } from "@/lib/parcelLookup";
import { SDAT_RECORD_PREFIXES, sdatRecordUrl } from "@/lib/sdatRecord";
import { getPaParcelProviderByCounty } from "@/parcelProviders/pa";

type Props = Record<string, unknown>;
type CountyConfig = {
  owner: (p: Props) => string;
  acres: (p: Props) => number;
  pin: (p: Props) => string;
  addr: (p: Props) => string;
};
const county = (slug: string) => (COUNTIES as unknown as Record<string, CountyConfig>)[slug];

describe("stripCareOf", () => {
  const cases: Array<[string, string]> = [
    ["SMITH FAMILY TRUST C/O MR & MRS DONALD", "SMITH FAMILY TRUST"],
    ["JONES MARY L & C/O BANK OF AMERICA", "JONES MARY L"],
    ["ACME LLC, C/O JOHN DOE", "ACME LLC"],
    ["HORAN DONNA &", "HORAN DONNA"],
    ["  KESSLER   FARMS LLC ", "KESSLER FARMS LLC"],
    ["C/O JOHN DOE", "JOHN DOE"],
    ["MCO HOLDINGS", "MCO HOLDINGS"],
    ["", ""],
  ];
  it("cuts the care-of contact and the dangling '&' / comma", () => {
    for (const [input, out] of cases) expect(stripCareOf(input)).toBe(out);
  });
  it("matches the tile build's copy exactly", () => {
    for (const [input] of cases) expect(buildStripCareOf(input)).toBe(stripCareOf(input));
  });
  it("is applied to PA DEP owners cut at 50 characters", () => {
    expect(
      county("allegheny").owner({ OWNER_NAME: "SMITH FAMILY TRUST C/O MR & MRS DONALD *" }),
    ).toBe("SMITH FAMILY TRUST");
  });
  it("is applied to McKean's folded care-of", () => {
    expect(county("mckean").owner({ OwnerName: "DOE JOHN C/O JANE DOE" })).toBe("DOE JOHN");
  });
});

describe("Washington County PA owner", () => {
  it("joins owndat_own with its continuation owndat_o_1", () => {
    const owner = county("washington").owner;
    expect(
      owner({ owndat_own: "MID MON VALLEY WATER POLLUTION", owndat_o_1: "CONTROL" }),
    ).toBe("MID MON VALLEY WATER POLLUTION CONTROL");
    expect(owner({ owndat_own: "HORAN DONNA &", owndat_o_1: "JENNIFER JAE" })).toBe(
      "HORAN DONNA & JENNIFER JAE",
    );
    expect(owner({ owndat_own: "SMITH JOHN", owndat_o_1: null })).toBe("SMITH JOHN");
  });
  it("gives the live lookup the same name", () => {
    const provider = getPaParcelProviderByCounty("Washington")!;
    const attrs = { owndat_own: "HORAN DONNA &", owndat_o_1: "JENNIFER JAE" };
    const live = joinOwnerFields(attrs, provider.ownerFieldNames, provider.ownerFieldMode);
    expect(stripCareOf(live ?? "")).toBe(county("washington").owner(attrs));
  });
  it("doesn't count the longer name as a sale in owner history", () => {
    expect(
      ownerReformatOf(
        "MID MON VALLEY WATER POLLUTION",
        "MID MON VALLEY WATER POLLUTION CONTROL",
        "washington",
      ),
    ).toBe(true);
    expect(ownerReformatOf("HORAN DONNA &", "HORAN DONNA & JENNIFER JAE")).toBe(true);
    expect(ownerReformatOf("SMITH JOHN", "SMITH JOHN & MARY")).toBe(false);
    expect(ownerReformatOf("SMITH JOHN", "JONES BOB", "washington")).toBe(false);
  });
});

describe("Maryland co-owner joins", () => {
  it("joins the two owner lines with a single '&'", () => {
    expect(joinCoOwners("CARD SCOTT A &", "CARD GRACE E")).toBe("CARD SCOTT A & CARD GRACE E");
    expect(joinCoOwners("MATTHEWS TAD JEROME", "MATTHEWS FAITH SPEAR")).toBe(
      "MATTHEWS TAD JEROME & MATTHEWS FAITH SPEAR",
    );
    expect(joinCoOwners("SMITH JOHN", "")).toBe("SMITH JOHN");
    expect(joinCoOwners("", "SMITH JOHN")).toBe("SMITH JOHN");
  });
  it("drops a care-of second line", () => {
    expect(joinCoOwners("SMITH JOHN", "C/O JANE DOE")).toBe("SMITH JOHN");
    expect(joinCoOwners("ACME LLC C/O", "JANE DOE")).toBe("ACME LLC");
  });
  it("is what Kent, Talbot and Washington MD use", () => {
    const p = { OWNNAME1: "CARD SCOTT A &", OWNNAME2: "CARD GRACE E" };
    expect(county("md-kent").owner(p)).toBe("CARD SCOTT A & CARD GRACE E");
    expect(county("md-talbot").owner(p)).toBe("CARD SCOTT A & CARD GRACE E");
    expect(county("md-washington").owner({ OwnName1: "A B", OwnName2: "C D" })).toBe("A B & C D");
  });
  it("reads Washington MD acreage in its land unit", () => {
    expect(mdWashingtonAcres({ LandUnit: "A", LandArea: 4.71, CalcAcre: 4.18 })).toBe(4.71);
    expect(mdWashingtonAcres({ LandUnit: "S", LandArea: 43560 })).toBe(1);
    expect(mdWashingtonAcres({ LandUnit: " ", Deeded_AC: "0.102 ", CalcAcre: 0.1 })).toBe(0.1);
    expect(mdWashingtonAcres({ LandUnit: null, Deeded_AC: null, CalcAcre: 0.0413 })).toBe(0.04);
  });
});

describe("toAcres", () => {
  it("reads the first number, never concatenating digits", () => {
    expect(toAcres(12.345)).toBe(12.35);
    expect(toAcres("12 1/2")).toBe(12.5);
    expect(toAcres("1/2")).toBe(0.5);
    expect(toAcres("12.5 AC")).toBe(12.5);
    expect(toAcres("1,234.5")).toBe(1234.5);
    expect(toAcres(".04")).toBe(0.04);
    expect(toAcres("0.102 ")).toBe(0.1);
  });
  it("is 0 for blanks, junk and non-positive values", () => {
    for (const v of ["", "  ", "abc", null, undefined, 0, -3, Number.NaN]) {
      expect(toAcres(v)).toBe(0);
    }
  });
  it("falls back field by field, not on raw truthiness", () => {
    // "0" is a truthy string: `toAcres(a || b)` used to stop at it.
    expect(county("adams").acres({ DEEDED_ACRES: "0", Map_Ac: 3.2 })).toBe(3.2);
    expect(county("franklin").acres({ TOTAL_DEED: " ", BASE_ACRES: 7 })).toBe(7);
    expect(county("chester").acres({ ACRE_PLAN_: "0.00", ACRE_PLA_1: 1.5 })).toBe(1.5);
    expect(county("wyoming").acres({ Deeded_Acr: "0", CALC_AC: 2 })).toBe(2);
  });
});

describe("geodesicAcres", () => {
  it("measures a one-mile square at 640 acres", () => {
    const d = 1609.344 / 111320;
    const dl = d / Math.cos((41 * Math.PI) / 180);
    const ring = [[-77, 41], [-77 + dl, 41], [-77 + dl, 41 + d], [-77, 41 + d], [-77, 41]];
    expect(geodesicAcres({ type: "Polygon", coordinates: [ring] })).toBeGreaterThan(635);
    expect(geodesicAcres({ type: "Polygon", coordinates: [ring] })).toBeLessThan(645);
    expect(geodesicAcres(null)).toBe(0);
  });
});

describe("holding labels with missing acreage", () => {
  const parcel = (acres: number, mappedAcres: number, lng: number) => ({
    owner: "SMITH JOHN",
    pin: String(lng),
    acres,
    mappedAcres,
    lng,
    lat: 41,
    wM: 2000,
    hM: 2000,
    area: 1,
  });
  it("marks the total as a lower bound and adds the mapped estimate", () => {
    const [label] = buildHoldingLabels([parcel(40, 0, -77), parcel(0, 10.5, -77.001)]);
    expect(label.properties.acres).toBe(40);
    expect(label.properties.alb).toBe(1);
    expect(label.properties.mac).toBe(50.5);
  });
  it("leaves complete totals unflagged", () => {
    const [label] = buildHoldingLabels([parcel(40, 0, -77), parcel(2, 0, -77.001)]);
    expect(label.properties.acres).toBe(42);
    expect(label.properties.alb).toBeUndefined();
    expect(label.properties.mac).toBeUndefined();
  });
});

describe("ownerAcresText options", () => {
  it("shows mapped and lower-bound acreage", () => {
    expect(ownerAcresText(0, { mappedAcres: 12.3 })).toBe("~12.3 acres (mapped)");
    expect(ownerAcresText(40, { atLeast: true })).toBe("at least 40 acres");
    expect(ownerAcresText(5, { mappedAcres: 9 })).toBe("5 acres");
    expect(ownerAcresText(0)).toBe("");
  });
});

describe("public owner pattern", () => {
  it("is the same in the tile build and the app", () => {
    expect(PUBLIC_OWNER_PATTERN.source).toBe(BUILD_PUBLIC_OWNER_PATTERN.source);
    expect(PUBLIC_OWNER_PATTERN.flags).toBe(BUILD_PUBLIC_OWNER_PATTERN.flags);
  });
  it("covers PA and MD public owners", () => {
    for (const name of [
      "COMMONWEALTH OF PA",
      "PA GAME COMMISSION",
      "PA DCNR BUREAU OF FORESTRY",
      "STATE OF MARYLAND",
      "WASHINGTON COUNTY MARYLAND",
      "KENT COUNTY, MARYLAND",
      "COUNTY COMMISSIONERS OF KENT COUNTY",
      "COUNTY OF FRANKLIN",
      "POTTER TOWNSHIP SUPERVISORS",
      "UNITED STATES OF AMERICA",
      "NATIONAL PARK SERVICE",
      "MAYOR & COUNCIL OF CHESTERTOWN",
      "BOARD OF EDUCATION OF TALBOT COUNTY",
      "PA DEPT OF TRANSPORTATION",
    ]) {
      expect(isPublicOwnerName(name)).toBe(true);
      expect(BUILD_PUBLIC_OWNER_PATTERN.test(name)).toBe(true);
    }
    for (const name of ["SMITH JOHN R & MARY L", "KESSLER FARMS LLC", "MARYLAND JONES"]) {
      expect(isPublicOwnerName(name)).toBe(false);
      expect(BUILD_PUBLIC_OWNER_PATTERN.test(name)).toBe(false);
    }
  });
});

describe("SDAT record refs", () => {
  const admin =
    "https://sdat.dat.maryland.gov/RealPropertyAdmin/Pages/view.aspx?County=12&SearchType=ACCT&District=01&AccountNumber=000195";
  const legacy =
    "https://sdat.dat.maryland.gov/RealProperty/Pages/viewdetails.aspx?County=12&SearchType=ACCT&District=01&AccountNumber=000195";
  it("uses the same prefixes in the build and the app", () => {
    expect(SDAT_RECORD_PREFIXES).toEqual(BUILD_SDAT_RECORD_PREFIXES);
  });
  it("stores the admin view with an 'a:' code and rebuilds it", () => {
    const ref = sdatRecordRef(admin);
    expect(ref).toBe("a:County=12&SearchType=ACCT&District=01&AccountNumber=000195");
    expect(sdatRecordUrl(ref)).toBe(admin);
  });
  it("still reads refs in tiles already published", () => {
    const ref = sdatRecordRef(legacy.replace("https:", "http:"));
    expect(ref).toBe("County=12&SearchType=ACCT&District=01&AccountNumber=000195");
    expect(sdatRecordUrl(ref)).toBe(legacy);
    expect(sdatRecordUrl(legacy)).toBe(legacy);
  });
  it("keeps unknown links whole and ignores blanks / unknown codes", () => {
    expect(sdatRecordRef("https://example.gov/parcel?1")).toBe("https://example.gov/parcel?1");
    expect(sdatRecordRef("")).toBe("");
    expect(sdatRecordUrl("")).toBe("");
    expect(sdatRecordUrl(undefined)).toBe("");
    expect(sdatRecordUrl("z:County=1")).toBe("");
  });
});

describe("live provider owner fields", () => {
  it("takes the first form for alternate-name counties", () => {
    for (const name of ["York", "Indiana", "Wayne"]) {
      expect(getPaParcelProviderByCounty(name)?.ownerFieldMode).toBe("first");
    }
    expect(
      joinOwnerFields(
        { NAME_EXT: "SMITH JOHN R & MARY L", SHORT_NAME: "SMITH JOHN R & MA" },
        ["NAME_EXT", "SHORT_NAME"],
        "first",
      ),
    ).toBe("SMITH JOHN R & MARY L");
    expect(joinOwnerFields({ NAME_EXT: " ", SHORT_NAME: "SMITH J" }, ["NAME_EXT", "SHORT_NAME"], "first")).toBe(
      "SMITH J",
    );
  });
  it("matches the tile build's owner fields", () => {
    expect(getPaParcelProviderByCounty("Bedford")?.ownerFieldNames).toEqual(["OWNER_NAME", "OWNER_NA_1"]);
    expect(getPaParcelProviderByCounty("Juniata")?.ownerFieldNames).toEqual(["Owners_Nam", "Owners_N_1"]);
    expect(getPaParcelProviderByCounty("Potter")?.ownerFieldNames).toEqual(["Owner_Name_1"]);
    expect(getPaParcelProviderByCounty("Butler")?.parcelIdFieldNames[0]).toBe("DPIN");
    expect(getPaParcelProviderByCounty("Butler")?.addressFieldNames).toEqual(["Legal2"]);
    expect(getPaParcelProviderByCounty("Huntingdon")?.addressFieldNames).toEqual(["Property_A"]);
  });
});
