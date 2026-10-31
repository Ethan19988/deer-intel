"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import SeasonReportView from "@/components/insights/SeasonReportView";
import { insightLabelStyle } from "@/components/insights/StatPrimitives";
import Button from "@/components/ui/Button";
import { useDeerIntelStore, type DeerIntelState } from "@/lib/deerIntelStore";
import { useSeasonCalendar } from "@/lib/seasonCalendar";
import {
  availableSeasons,
  buildSeasonReport,
  defaultSeasonYear,
  seasonWindow,
  type SeasonReport,
} from "@/lib/seasonReport";
import { statsContextForProperty } from "@/lib/useInsightStats";

// Season picker + print button + one report per chosen property. Used by the
// /report page (any / all properties) and the property page's Report tab.

export const ALL_PROPERTIES = "__all__";

function reportFor(
  state: DeerIntelState,
  propertyId: string,
  seasonYear: number,
  seasonPrefs: ReturnType<typeof useSeasonCalendar>,
): SeasonReport {
  const own = <T extends { propertyId: string }>(items: T[]) =>
    items.filter((item) => item.propertyId === propertyId);
  return buildSeasonReport(
    {
      stands: own(state.stands),
      hunts: own(state.hunts),
      cameras: own(state.cameras),
      cameraChecks: own(state.cameraChecks),
      photos: own(state.photoRecords),
      deerProfiles: own(state.deerProfiles),
    },
    seasonYear,
    statsContextForProperty(state, propertyId, seasonPrefs),
  );
}

export default function SeasonReportPanel({
  propertyId,
  allowPropertyPick = false,
}: {
  /** A property id, or ALL_PROPERTIES for one page per property. */
  propertyId: string;
  allowPropertyPick?: boolean;
}) {
  const state = useDeerIntelStore();
  const seasonPrefs = useSeasonCalendar();
  const [pickedProperty, setPickedProperty] = useState(propertyId);
  const activeProperty = allowPropertyPick ? pickedProperty : propertyId;
  useEffect(() => {
    // Follow the caller (e.g. the property switcher) when it changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPickedProperty(propertyId);
  }, [propertyId]);

  // The clock is read on mount so server and first client render match.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
  }, []);

  const scopedIds = useMemo(
    () =>
      activeProperty === ALL_PROPERTIES
        ? state.properties.map((property) => property.id)
        : [activeProperty],
    [activeProperty, state.properties],
  );

  const scopedData = useMemo(() => {
    const inScope = <T extends { propertyId: string }>(items: T[]) =>
      items.filter((item) => scopedIds.includes(item.propertyId));
    return {
      hunts: inScope(state.hunts),
      cameraChecks: inScope(state.cameraChecks),
      photos: inScope(state.photoRecords),
    };
  }, [scopedIds, state.hunts, state.cameraChecks, state.photoRecords]);

  // Only seasons whose Sep–Jan window has data, plus the current one.
  const seasons = useMemo(
    () => (now ? availableSeasons(scopedData, now) : []),
    [now, scopedData],
  );

  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  // Opens on the newest season that has data (else the current one) until
  // the hunter picks one; a pick no longer offered falls back the same way.
  const defaultYear = useMemo(
    () => (now ? defaultSeasonYear(scopedData, now) : null),
    [now, scopedData],
  );
  const year = seasonYear !== null && seasons.includes(seasonYear) ? seasonYear : defaultYear;

  const reports = useMemo(() => {
    if (year === null) return [];
    return scopedIds
      .map((id) => ({
        id,
        name: state.properties.find((property) => property.id === id)?.name ?? "Property",
        report: reportFor(state, id, year, seasonPrefs),
      }))
      .filter((entry, _, all) => all.length === 1 || !entry.report.isEmpty);
  }, [scopedIds, state, year, seasonPrefs]);

  return (
    <div className="di-report-root" style={wrapStyle}>
      <div className="di-report-controls" style={controlsStyle}>
        {allowPropertyPick ? (
          <label style={fieldStyle}>
            <span style={insightLabelStyle}>Property</span>
            <select
              value={pickedProperty}
              onChange={(event) => setPickedProperty(event.target.value)}
              style={selectStyle}
            >
              {state.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
              {state.properties.length > 1 ? (
                <option value={ALL_PROPERTIES}>All properties (one page each)</option>
              ) : null}
            </select>
          </label>
        ) : null}
        <label style={fieldStyle}>
          <span style={insightLabelStyle}>Season</span>
          <select
            value={year ?? ""}
            onChange={(event) => setSeasonYear(Number(event.target.value))}
            style={selectStyle}
            disabled={seasons.length === 0}
          >
            {seasons.map((option) => (
              <option key={option} value={option}>
                {seasonWindow(option).label} (Sep–Jan)
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={() => window.print()} disabled={reports.length === 0}>
          Print / save PDF
        </Button>
      </div>

      {reports.length === 0 && year !== null ? (
        <p style={emptyStyle}>No property has anything logged for this season.</p>
      ) : null}

      {reports.map((entry) => (
        <SeasonReportView key={entry.id} report={entry.report} propertyName={entry.name} />
      ))}

      <style>{PRINT_CSS}</style>
    </div>
  );
}

// Print: white paper, black ink, no app chrome, one property per page. Kept
// with the report (rather than globals.css) since only this view prints.
const PRINT_CSS = `
@media print {
  @page { size: letter portrait; margin: 0.45in; }
  html, body { background: #fff !important; }
  :root, :root[data-theme] {
    --bg: #fff; --surface: #fff; --surface-2: #f4f4f1; --surface-3: #ebebe6;
    --border: #d4d4cc; --border-strong: #9a9a90;
    --text: #111; --text-muted: #444; --text-faint: #666;
    --accent: #2f5d2f; --accent-text: #2f5d2f; --accent-2: #c2470f;
    --success-bg: #eaf3e6; --success-border: #b9d3ae; --success-text: #2a5a22;
    --warning-text: #7a5a00;
  }
  .di-sidebar, .di-mobile-nav, .di-brandbar, .di-property-switcher,
  .di-report-controls, .di-report-hide-print, [role="tablist"] { display: none !important; }
  .di-page-shell { padding: 0 !important; }
  .di-page-content { max-width: none !important; }
  /* Only the report prints, whatever page hosts it (e.g. the property tab). */
  body * { visibility: hidden; }
  .di-report-root, .di-report-root * { visibility: visible; }
  .di-report-root { position: absolute; left: 0; top: 0; width: 100%; }
  .di-report-page {
    border: none !important; padding: 0 !important; font-size: 10.5pt;
    break-after: page; page-break-after: always;
  }
  .di-report-page:last-of-type { break-after: auto; page-break-after: auto; }
  .di-report-block, .di-report-page table { break-inside: avoid; }
  .di-report-page * { box-shadow: none !important; }
}
`;

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  minWidth: 0,
};

const controlsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: "0.6rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  minWidth: 0,
  flex: "1 1 10rem",
  maxWidth: "20rem",
};

const selectStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.3rem 0.6rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.95rem",
  width: "100%",
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
};
