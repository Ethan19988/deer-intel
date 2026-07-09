import { NextResponse } from "next/server";

// Esri Wayback publishes a config of every dated World Imagery release, but the
// S3 file has no CORS header, so the browser can't read it directly. This
// same-origin route fetches it server-side (cached daily) and returns the most
// recent release per year for the last 5 years, so the imagery year picker
// stays current on its own. If the fetch ever fails we fall back to a pinned
// list so the map still works.

const CONFIG_URL =
  "https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json";

const DAY_SECONDS = 86400;

export type WaybackRelease = {
  year: string;
  release: string;
  date: string;
};

const FALLBACK: WaybackRelease[] = [
  { year: "2026", release: "32246", date: "2026-06-30" },
  { year: "2025", release: "13192", date: "2025-12-18" },
  { year: "2024", release: "16453", date: "2024-12-12" },
  { year: "2023", release: "56102", date: "2023-12-07" },
  { year: "2022", release: "45134", date: "2022-12-14" },
];

export const revalidate = DAY_SECONDS;

export async function GET() {
  try {
    const response = await fetch(CONFIG_URL, {
      next: { revalidate: DAY_SECONDS },
    });

    if (!response.ok) return NextResponse.json({ releases: FALLBACK });

    const config = (await response.json()) as Record<
      string,
      { itemTitle?: string }
    >;

    const byYear = new Map<string, WaybackRelease>();

    for (const [release, info] of Object.entries(config)) {
      const match = String(info?.itemTitle ?? "").match(/(\d{4})-\d{2}-\d{2}/);
      if (!match) continue;

      const date = match[0];
      const year = match[1];
      const existing = byYear.get(year);

      if (!existing || date > existing.date) {
        byYear.set(year, { year, release, date });
      }
    }

    const releases = Array.from(byYear.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    return NextResponse.json({
      releases: releases.length > 0 ? releases : FALLBACK,
    });
  } catch {
    return NextResponse.json({ releases: FALLBACK });
  }
}
