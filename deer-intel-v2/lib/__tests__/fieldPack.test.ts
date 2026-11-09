import { describe, expect, it } from "vitest";
import {
  FIELD_PACK_STALE_MS,
  fieldPackAge,
  fieldPackReady,
  fieldPackSources,
  fieldPackSummary,
  forecastThroughLabel,
  legalLightLines,
  parcelItem,
  planFieldPack,
  type FieldPackItem,
} from "@/lib/fieldPack";
import { forecastSnapshotKey } from "@/lib/forecastSnapshot";
import type { OfflinePackPlan, OfflineTileSource } from "@/lib/offlineMaps";
import type { LiveForecast } from "@/lib/liveWeather";

const satellite: OfflineTileSource = {
  url: "https://wayback.example.com/tile/32246/{z}/{y}/{x}",
  maxNativeZoom: 19,
};
const topo: OfflineTileSource = {
  url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  maxNativeZoom: 17,
};
const water: OfflineTileSource = {
  url: "https://water.example.com/{z}/{y}/{x}",
  maxNativeZoom: 16,
  sparse: true,
};
const parcels: OfflineTileSource = {
  kind: "pmtiles",
  url: "https://pmtiles.example.com/pa-parcels.pmtiles",
  minNativeZoom: 12,
  maxNativeZoom: 15,
};
// About a hunt area: ~1.5 km square.
const huntArea = { south: 41.4, west: -77.2, north: 41.414, east: -77.182 };
// A whole county — far past the cap.
const county = { south: 41.0, west: -78.0, north: 41.6, east: -77.0 };

const forecast = {
  timezone: "America/New_York",
  sunriseIso: "2026-11-09T06:52",
  sunsetIso: "2026-11-09T16:59",
  days: [
    { date: "2026-11-09", sunriseIso: "2026-11-09T06:52", sunsetIso: "2026-11-09T16:59" },
    { date: "2026-11-10", sunriseIso: "2026-11-10T06:53", sunsetIso: "2026-11-10T16:58" },
    { date: "2026-11-11" },
  ],
} as unknown as LiveForecast;

describe("fieldPackSources", () => {
  it("puts satellite first, then topo, then what's on screen without duplicates", () => {
    const sources = fieldPackSources(satellite, topo, [satellite, water, parcels]);
    expect(sources).toEqual([satellite, topo, water, parcels]);
  });

  it("keeps two WMS layers of one service apart", () => {
    const a: OfflineTileSource = { kind: "wms", url: "https://wms", maxNativeZoom: 19, wms: { layers: "a", version: "1.3.0" } };
    const b: OfflineTileSource = { ...a, wms: { layers: "b", version: "1.3.0" } };
    expect(fieldPackSources(satellite, topo, [a, b])).toHaveLength(4);
  });
});

describe("planFieldPack", () => {
  it("saves a hunt area at 13–17 with parcels to their data zoom", () => {
    const plan = planFieldPack(fieldPackSources(satellite, topo, [water, parcels]), huntArea);
    expect(plan.minZoom).toBe(13);
    expect(plan.maxZoom).toBe(17);
    expect(plan.vectorMaxZoom).toBe(15);
    expect(plan.tileCount).toBeGreaterThan(0);
    expect(plan.tileCount).toBeLessThanOrEqual(6000);
  });

  it("stays under the 6000-tile cap for a huge area", () => {
    const plan = planFieldPack(fieldPackSources(satellite, topo, [water, parcels]), county);
    expect(plan.tileCount).toBeLessThanOrEqual(6000);
    expect(plan.clamped).toBe(true);
  });
});

describe("forecast and legal light", () => {
  it("names the last forecast day", () => {
    expect(forecastThroughLabel(forecast)).toBe("Wed");
    expect(forecastThroughLabel(null)).toBe("");
  });

  it("lists PA legal light per day on the property's clock", () => {
    expect(legalLightLines(forecast)).toEqual([
      "Mon 6:22 AM – 5:29 PM",
      "Tue 6:23 AM – 5:28 PM",
    ]);
  });

  it("uses the snapshot key usePropertyToday reads", () => {
    expect(forecastSnapshotKey({ lat: 41.5, lng: -77.5 }, { temperature: "F", wind: "mph" })).toBe(
      "41.5,-77.5|F|mph",
    );
  });
});

describe("checklist", () => {
  const items: FieldPackItem[] = [
    { id: "map", ok: true, detail: "1,240 tiles" },
    { id: "forecast", ok: true, detail: "through Wed" },
    { id: "pages", ok: true, detail: "" },
    { id: "parcels", ok: false, detail: "need signal" },
  ];

  it("summarizes like the panel", () => {
    expect(fieldPackSummary(items)).toBe(
      "Ready for the field: map ✓ (1,240 tiles) · forecast ✓ (through Wed) · pages ✓ · parcel lines ✗ need signal",
    );
  });

  it("isn't ready without the map or forecast", () => {
    expect(fieldPackReady(items)).toBe(true);
    expect(fieldPackReady([{ ...items[0], ok: false }, items[1]])).toBe(false);
    expect(fieldPackReady([items[0]])).toBe(false);
  });

  it("marks parcels only when planned and actually saved", () => {
    const plan = { sources: [parcels], vectorMaxZoom: 15, vectorTrimmed: false } as OfflinePackPlan;
    expect(parcelItem(plan, true, true)).toEqual({ id: "parcels", ok: true, detail: "" });
    expect(parcelItem(plan, true, false).ok).toBe(false);
    expect(parcelItem(plan, false, true).ok).toBe(false);
    expect(parcelItem({ ...plan, vectorMaxZoom: 14, vectorTrimmed: true }, true, true).detail).toBe(
      "to zoom 14",
    );
    expect(parcelItem({ ...plan, vectorMaxZoom: undefined }, true, true).detail).toBe("need signal");
  });
});

describe("fieldPackAge", () => {
  const saved = Date.UTC(2026, 10, 9, 12);

  it("says how long ago and flags a pack over a day old", () => {
    expect(fieldPackAge(saved, saved + 20_000)).toEqual({ label: "saved just now", stale: false });
    expect(fieldPackAge(saved, saved + 5 * 60_000).label).toBe("saved 5 min ago");
    expect(fieldPackAge(saved, saved + 2 * 3_600_000)).toEqual({ label: "saved 2 h ago", stale: false });
    expect(fieldPackAge(saved, saved + FIELD_PACK_STALE_MS + 60_000).stale).toBe(true);
    expect(fieldPackAge(saved, saved + 3 * 86_400_000).label).toBe("saved 3 days ago");
  });
});
