"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { TargetIcon } from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import {
  EMPTY_AI_SCOUT_CONDITIONS,
  buildAiScoutRequestContext,
} from "@/lib/aiScoutContext";
import { checkAiScoutConfigured, requestAiScoutReport } from "@/lib/aiScoutClient";
import { useAiScoutEnabled } from "@/lib/aiScoutPreferences";
import {
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  fetchLiveForecast,
  resolvePropertyWeatherPoint,
  type LiveForecast,
} from "@/lib/liveWeather";
import { readForecastSnapshot } from "@/lib/forecastSnapshot";
import { useUnitPreferences } from "@/lib/units";
import { clipTerrainSetToArea, getScoutPicks } from "@/lib/terrainMovementData";
import { aggregateCameraActivity } from "@/lib/terrainLearning";
import {
  boundsOfHuntArea,
  centerOfBounds,
  useTerrainSet,
} from "@/lib/useTerrainSet";
import { useMoonPhase } from "@/lib/useMoonPhase";
import type { AiScoutConditions, AiScoutReport } from "@/types/aiScout";

export default function AIPage() {
  const state = useDeerIntelStore();
  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const selectedPropertyId = selectedProperty?.id ?? "";
  const propertyCameras = state.cameras.filter(
    (camera) => camera.propertyId === selectedPropertyId,
  );
  const propertyCameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === selectedPropertyId,
  );
  const propertyStands = state.stands.filter(
    (stand) => stand.propertyId === selectedPropertyId,
  );
  const propertyHunts = state.hunts.filter(
    (hunt) => hunt.propertyId === selectedPropertyId,
  );
  const propertyPhotoRecords = state.photoRecords.filter(
    (photo) => photo.propertyId === selectedPropertyId,
  );
  const propertyDeerProfiles = state.deerProfiles.filter(
    (profile) => profile.propertyId === selectedPropertyId,
  );
  const propertyPins = state.pins.filter(
    (pin) => pin.propertyId === selectedPropertyId,
  );

  // Terrain-predicted scouting spots for this property, if a LiDAR read covers
  // its location. Fed into the AI Scout context
  // so the LLM can weigh terrain against the hunter's saved stands.
  // The drawn hunt area anchors the read when there is one — a property with
  // only an outline (no saved coordinate or pins) otherwise resolved to no
  // point and skipped the terrain read entirely.
  const terrainBbox = boundsOfHuntArea(selectedProperty?.huntArea);
  const terrainPoint = selectedProperty
    ? ((terrainBbox ? centerOfBounds(terrainBbox) : null) ??
      resolvePropertyWeatherPoint(selectedProperty, propertyCameras, propertyPins))
    : null;
  const terrainSet = useTerrainSet(
    terrainPoint,
    selectedProperty?.name,
    terrainBbox,
  );
  // Keep the AI's terrain picks to the drawn hunt area, same as the map, and
  // grade them against this property's trail-camera activity (Phase 3 learning).
  const terrainReview = clipTerrainSetToArea(terrainSet, selectedProperty?.huntArea);
  const observations = aggregateCameraActivity(propertyCameras, propertyCameraChecks);
  const scoutPicks = terrainReview ? getScoutPicks(terrainReview, observations) : [];

  const aiScoutEnabled = useAiScoutEnabled();
  const [aiScoutConfigured, setAiScoutConfigured] = useState<boolean | null>(null);
  const [conditions, setConditions] = useState<AiScoutConditions>(EMPTY_AI_SCOUT_CONDITIONS);
  const [editingConditions, setEditingConditions] = useState(false);
  // Sky and pressure from the forecast ride along with the request (they have
  // no field of their own) and show in the conditions line.
  const [liveExtras, setLiveExtras] = useState<LiveExtras>({ source: "none", sky: "", pressure: "" });
  const units = useUnitPreferences();
  const [aiScoutStatus, setAiScoutStatus] = useState<"idle" | "loading" | "error">("idle");
  const [aiScoutError, setAiScoutError] = useState<string>("");
  const [aiScoutReport, setAiScoutReport] = useState<AiScoutReport | null>(null);

  useEffect(() => {
    let cancelled = false;

    checkAiScoutConfigured().then((configured) => {
      if (!cancelled) setAiScoutConfigured(configured);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fill today's conditions from the live forecast (the same one Today uses,
  // instantly from this device's snapshot when there is one) so asking is one
  // tap. Only blank fields are filled — anything the hunter typed stays.
  const weatherKey = terrainPoint ? `${terrainPoint.lat},${terrainPoint.lng}` : "";
  useEffect(() => {
    const point = selectedProperty
      ? resolvePropertyWeatherPoint(selectedProperty, propertyCameras, propertyPins)
      : null;
    if (!point) return;
    const key = `${point.lat},${point.lng}`;
    let active = true;

    const apply = (forecast: LiveForecast) => {
      setConditions((current) => ({
        ...current,
        windDirection: current.windDirection || forecast.current.windDirection,
        windSpeed: current.windSpeed || forecast.current.windSpeed,
        temperature: current.temperature || forecast.current.temperature,
        moonPhase: current.moonPhase || forecast.current.moonPhase,
      }));
      setLiveExtras({
        source: "live",
        sky: forecast.current.weather,
        pressure: forecast.pressure
          ? `pressure ${forecast.pressure.value} and ${forecast.pressure.trend}`
          : "",
      });
    };

    const snapshot = readForecastSnapshot(`${key}|${units.temperature}|${units.wind}`);
    if (snapshot) apply(snapshot);
    fetchLiveForecast(point, units).then((result) => {
      if (active && result.status === "ok") apply(result.forecast);
    });
    return () => {
      active = false;
    };
    // Re-run per property and unit choice; the point is derived from them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, weatherKey, units.temperature, units.wind]);

  // Today's moon phase (client-computed). Used to auto-fill the AI Scout
  // conditions when the hunter hasn't typed their own, and to show a movement
  // hint so the recommendation always reasons about lunar timing.
  const moon = useMoonPhase();

  // Reset the AI Scout output when the selected property changes. Done during
  // render by tracking the previous id rather than in an effect, per React's
  // "you might not need an effect" guidance.
  const [lastScoutPropertyId, setLastScoutPropertyId] = useState(selectedPropertyId);

  if (selectedPropertyId !== lastScoutPropertyId) {
    setLastScoutPropertyId(selectedPropertyId);
    setAiScoutReport(null);
    setAiScoutStatus("idle");
    setAiScoutError("");
    setConditions(EMPTY_AI_SCOUT_CONDITIONS);
    setLiveExtras({ source: "none", sky: "", pressure: "" });
  }

  function updateCondition(field: keyof AiScoutConditions, value: string) {
    setConditions((current) => ({ ...current, [field]: value }));
  }

  async function askAiScout() {
    if (!selectedProperty) return;

    setAiScoutStatus("loading");
    setAiScoutError("");

    try {
      const context = buildAiScoutRequestContext({
        property: selectedProperty,
        stands: propertyStands,
        cameras: propertyCameras,
        cameraChecks: propertyCameraChecks,
        hunts: propertyHunts,
        photoRecords: propertyPhotoRecords,
        deerProfiles: propertyDeerProfiles,
        // Fall back to today's detected moon phase when the hunter left it
        // blank, so AI Scout always has the lunar timing to reason about.
        conditions: {
          ...conditions,
          moonPhase: conditions.moonPhase || moon?.phase || "",
          notes: [
            conditions.notes.trim(),
            liveExtras.sky ? `Sky: ${liveExtras.sky}.` : "",
            liveExtras.pressure ? `Barometric ${liveExtras.pressure}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
        },
        scoutPicks,
      });
      const report = await requestAiScoutReport(context);

      setAiScoutReport(report);
      setAiScoutStatus("idle");
    } catch (error) {
      setAiScoutStatus("error");
      setAiScoutError(error instanceof Error ? error.message : "AI Scout request failed.");
    }
  }

  const conditionCells = [
    { label: "Wind", value: conditions.windDirection },
    { label: "Speed", value: conditions.windSpeed },
    {
      label: "Temp",
      value: /^-?\d+(\.\d+)?$/.test(conditions.temperature.trim())
        ? `${conditions.temperature.trim()}°`
        : conditions.temperature,
    },
    { label: "Moon", value: conditions.moonPhase || moon?.phase || "" },
  ];
  const extrasLine = [liveExtras.sky, liveExtras.pressure].filter(Boolean).join(" · ");

  return (
    <PageShell>
      <PageHeader
        eyebrow={selectedProperty ? `Assistant · ${selectedProperty.name}` : "Assistant"}
        title="AI Scout"
      />

      {state.properties.length === 0 ? (
        <EmptyState
          illustration={<TargetIcon size={28} />}
          title="No properties yet"
          description="Add a property and AI Scout can read its stands, sits and cameras."
          action={
            <Link href="/properties" className="di-link-btn di-link-btn--primary">
              Add property
            </Link>
          }
        />
      ) : null}

      {selectedProperty ? (
        <>
          {!aiScoutEnabled ? (
            <EmptyState
              illustration={<TargetIcon size={28} />}
              title="AI Scout is off"
              description="You turned AI Scout off in Settings. Today's verdict and stand check keep working; turn it back on there for written plans."
              action={
                <Link href="/settings" className="di-link-btn">
                  Open settings
                </Link>
              }
            />
          ) : aiScoutConfigured === null ? (
            <p style={mutedTextStyle}>Checking AI Scout…</p>
          ) : aiScoutConfigured === false ? (
            <EmptyState
              illustration={<TargetIcon size={28} />}
              title="AI Scout isn't set up yet"
              description="It needs an ANTHROPIC_API_KEY set on the server (see the README). Your saved data is fine, and Today's verdict and stand check keep working without it."
            />
          ) : (
            <div style={scoutStyle}>
              <section aria-label="Today's conditions">
                <div style={conditionGridStyle}>
                  {conditionCells.map((cell) => (
                    <div key={cell.label} style={conditionCellStyle}>
                      <span style={monoLabelStyle}>{cell.label}</span>
                      <span
                        style={{
                          ...conditionValueStyle,
                          ...(cell.value.length > 7 ? conditionLongValueStyle : null),
                        }}
                      >
                        {cell.value || "—"}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={conditionFootStyle}>
                  <span style={monoLabelStyle}>
                    {liveExtras.source === "live"
                      ? `Live weather${extrasLine ? ` · ${extrasLine}` : ""}`
                      : conditionsSummary(conditions, liveExtras)
                        ? "Your conditions"
                        : "Loading the forecast…"}
                  </span>
                  <button
                    type="button"
                    style={editButtonStyle}
                    aria-expanded={editingConditions}
                    onClick={() => setEditingConditions((current) => !current)}
                  >
                    {editingConditions ? "Done" : "Edit"}
                  </button>
                </div>

                {editingConditions ? (
                  <div style={conditionsGridStyle}>
                    <label style={fieldStyle}>
                      <span style={monoLabelStyle}>Wind direction</span>
                      <input
                        style={inputStyle}
                        value={conditions.windDirection}
                        onChange={(event) => updateCondition("windDirection", event.target.value)}
                        placeholder="e.g. NW"
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={monoLabelStyle}>Wind speed</span>
                      <input
                        style={inputStyle}
                        value={conditions.windSpeed}
                        onChange={(event) => updateCondition("windSpeed", event.target.value)}
                        placeholder="e.g. 8 mph"
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={monoLabelStyle}>Temperature</span>
                      <input
                        style={inputStyle}
                        value={conditions.temperature}
                        onChange={(event) => updateCondition("temperature", event.target.value)}
                        placeholder="e.g. 42°F"
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={monoLabelStyle}>Moon</span>
                      <input
                        style={inputStyle}
                        value={conditions.moonPhase}
                        onChange={(event) => updateCondition("moonPhase", event.target.value)}
                        placeholder={moon ? moon.phase : "e.g. Waning Gibbous"}
                      />
                    </label>
                  </div>
                ) : null}
              </section>

              <label style={fieldStyle}>
                <span style={monoLabelStyle}>Anything else? (optional)</span>
                <textarea
                  style={textareaStyle}
                  value={conditions.notes}
                  onChange={(event) => updateCondition("notes", event.target.value)}
                  placeholder="Pressure from a neighbor, acorns dropping, only have till 10am"
                  rows={2}
                />
              </label>

              <Button
                type="button"
                variant="primary"
                fullWidth
                onClick={askAiScout}
                disabled={aiScoutStatus === "loading"}
                style={askButtonStyle}
              >
                {aiScoutStatus === "loading" ? "Asking AI Scout…" : "Ask AI Scout"}
              </Button>
              <p style={leadStyle}>
                Reads every sit, camera check, buck photo and the terrain saved for{" "}
                {selectedProperty.name}, then writes where to sit, why, and what could go wrong.
              </p>

              {aiScoutStatus === "error" ? (
                <p style={aiScoutErrorStyle}>{aiScoutError}</p>
              ) : null}

              {aiScoutReport ? (
                <article style={reportStyle} aria-label="AI Scout recommendation">
                  <div style={reportHeadStyle}>
                    <span style={monoLabelStyle}>Recommended stand</span>
                    <span
                      style={{
                        ...monoLabelStyle,
                        color: confidenceColor(aiScoutReport.confidence),
                      }}
                    >
                      {aiScoutReport.confidence} confidence
                    </span>
                  </div>
                  <h2 style={standNameStyle}>{aiScoutReport.recommendedStandName}</h2>
                  {aiScoutReport.headline ? (
                    <p style={headlineStyle}>{aiScoutReport.headline}</p>
                  ) : null}
                  <p style={reasoningStyle}>{aiScoutReport.recommendedStandReasoning}</p>

                  {aiScoutReport.keyFactors.length > 0 ? (
                    <>
                      <h3 style={listTitleStyle}>Key factors</h3>
                      <ol style={numberedListStyle}>
                        {aiScoutReport.keyFactors.map((factor, index) => (
                          <li key={factor} style={numberedItemStyle}>
                            <span style={{ ...monoLabelStyle, color: "var(--accent-text)" }}>
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : null}

                  {aiScoutReport.risks.length > 0 ? (
                    <>
                      <h3 style={listTitleStyle}>Worth knowing</h3>
                      <ul style={numberedListStyle}>
                        {aiScoutReport.risks.map((risk) => (
                          <li key={risk} style={numberedItemStyle}>
                            <span style={{ ...monoLabelStyle, color: "var(--accent-2)" }}>!</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </article>
              ) : null}
            </div>
          )}

          <div style={footerActionStyle}>
            <Link href={`/properties/${selectedProperty.id}`} className="di-link-btn">
              Open {selectedProperty.name}
            </Link>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}

type LiveExtras = { source: "none" | "live"; sky: string; pressure: string };

// "NNE 8 mph · 60°F · Clear · pressure 30.1 and steady · Waxing gibbous"
function conditionsSummary(conditions: AiScoutConditions, extras: LiveExtras): string {
  const wind = [conditions.windDirection, conditions.windSpeed].filter(Boolean).join(" ");
  return [wind, conditions.temperature, extras.sky, extras.pressure, conditions.moonPhase]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

function confidenceColor(confidence: AiScoutReport["confidence"]): string {
  if (confidence === "high") return "var(--accent-text)";
  if (confidence === "medium") return "var(--text)";
  return "var(--accent-2)";
}

const mono = "var(--font-geist-mono), ui-monospace, monospace";

const scoutStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const monoLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontFamily: mono,
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const conditionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  borderTop: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)",
};

const conditionCellStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
  minWidth: 0,
  padding: "0.7rem 0.6rem",
  borderLeft: "1px solid var(--border)",
};

const conditionValueStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text)",
  fontFamily: "var(--font-display), sans-serif",
  fontSize: "1.55rem",
  lineHeight: 1,
  textOverflow: "ellipsis",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

// Moon phase names ("Waxing gibbous") wrap at a smaller size instead of
// being cut off.
const conditionLongValueStyle: CSSProperties = {
  fontSize: "1.05rem",
  lineHeight: 1.05,
  whiteSpace: "normal",
};

const conditionFootStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  minHeight: "44px",
  borderBottom: "1px solid var(--border)",
};

const editButtonStyle: CSSProperties = {
  ...monoLabelStyle,
  flex: "none",
  minHeight: "40px",
  padding: "0 0.25rem",
  border: 0,
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
};

const askButtonStyle: CSSProperties = {
  minHeight: "54px",
  fontSize: "1.3rem",
};

const reportStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const reportHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const standNameStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "2.4rem",
  lineHeight: 0.95,
};

const headlineStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "1.02rem",
  fontWeight: 600,
  lineHeight: 1.5,
};

const reasoningStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const listTitleStyle: CSSProperties = {
  margin: "1rem 0 0",
  paddingBottom: "0.6rem",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
  fontSize: "1.5rem",
};

const numberedListStyle: CSSProperties = {
  display: "grid",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const numberedItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.8rem minmax(0, 1fr)",
  alignItems: "baseline",
  gap: "0.5rem",
  padding: "0.85rem 0",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
  lineHeight: 1.5,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};







const mutedTextStyle: CSSProperties = {
  margin: "1rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.55,
};


const footerActionStyle: CSSProperties = {
  marginTop: "1.5rem",
};


const leadStyle: CSSProperties = {
  margin: "-0.4rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.88rem",
  lineHeight: 1.5,
};





const conditionsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
  gap: "0.9rem",
  marginTop: "1.1rem",
};

const inputStyle: CSSProperties = {
  minHeight: "48px",
  width: "100%",
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
};


const textareaStyle: CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontFamily: "inherit",
  resize: "vertical",
};

const aiScoutErrorStyle: CSSProperties = {
  margin: "0.9rem 0 0",
  padding: "0.75rem",
  border: "1px solid var(--danger-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  lineHeight: 1.5,
};


