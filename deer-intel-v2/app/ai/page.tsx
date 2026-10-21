"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { TargetIcon } from "@/components/ui/FieldIcons";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
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

  return (
    <PageShell>
      <Card as="section" variant="elevated" style={heroCardStyle}>
        <PageHeader
          icon={<TargetIcon size={26} />}
          eyebrow={selectedProperty ? selectedProperty.name : "Assistant"}
          title="AI Scout"
          description="Ask for a stand pick grounded in this property's saved stands, sits, camera checks, buck photos, and terrain read. Today's verdict, best stand, and buck activity live on the Today screen."
        />
      </Card>

      {state.properties.length === 0 ? (
        <Section eyebrow="Property" title="Add a property">
          <EmptyState
            illustration={<TargetIcon size={30} />}
            title="No properties yet"
            description="Add a property before AI Scout can read its stands, sits, and cameras."
            action={
              <Link href="/properties" style={primaryLinkStyle} className="di-navbtn">
                Add Property
              </Link>
            }
          />
        </Section>
      ) : null}

      {selectedProperty ? (
        <>
          <Section
            eyebrow="Assistant"
            title="AI Scout"
          >
            {!aiScoutEnabled ? (
              <EmptyState
                illustration={<TargetIcon size={30} />}
                title="AI Scout is turned off"
                description="You've turned off AI Scout recommendations in Settings → AI Scout. Today's verdict and stand check keep working. Turn it back on there whenever you want LLM recommendations."
              />
            ) : aiScoutConfigured === null ? (
              <Card as="div" variant="subtle">
                <p style={mutedTextStyle}>Checking AI Scout availability…</p>
              </Card>
            ) : aiScoutConfigured === false ? (
              <EmptyState
                illustration={<TargetIcon size={30} />}
                title="AI Scout isn't turned on yet"
                description="This property's saved data hasn't changed — AI Scout just needs an ANTHROPIC_API_KEY set as an environment variable on the server (see the README) before it can make real recommendations. Today's verdict and stand check keep working without it."
              />
            ) : (
              <Card as="div" variant="subtle">
                <p style={leadStyle}>
                  Today&apos;s verdict picks a stand by rules. AI Scout reads everything
                  saved for {selectedProperty.name} — every sit, camera check, buck photo,
                  and the terrain — and writes a plan: where to sit, why, and what could
                  go wrong.
                </p>

                <div style={conditionsSummaryStyle}>
                  <div>
                    <p style={labelStyle}>Today&apos;s conditions</p>
                    <p style={conditionsLineStyle}>
                      {conditionsSummary(conditions, liveExtras) || "Loading the forecast…"}
                    </p>
                    {liveExtras.source === "live" ? (
                      <p style={conditionsSourceStyle}>Filled in from the live forecast.</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    style={changeButtonStyle}
                    aria-expanded={editingConditions}
                    onClick={() => setEditingConditions((current) => !current)}
                  >
                    {editingConditions ? "Done" : "Change"}
                  </button>
                </div>

                {editingConditions ? (
                  <div style={conditionsGridStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Wind direction</span>
                      <input
                        style={inputStyle}
                        value={conditions.windDirection}
                        onChange={(event) => updateCondition("windDirection", event.target.value)}
                        placeholder="e.g. NW"
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Wind speed</span>
                      <input
                        style={inputStyle}
                        value={conditions.windSpeed}
                        onChange={(event) => updateCondition("windSpeed", event.target.value)}
                        placeholder="e.g. 8 mph"
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Temperature</span>
                      <input
                        style={inputStyle}
                        value={conditions.temperature}
                        onChange={(event) => updateCondition("temperature", event.target.value)}
                        placeholder="e.g. 42°F"
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Moon</span>
                      <input
                        style={inputStyle}
                        value={conditions.moonPhase}
                        onChange={(event) => updateCondition("moonPhase", event.target.value)}
                        placeholder={moon ? moon.phase : "e.g. Waning Gibbous"}
                      />
                    </label>
                  </div>
                ) : null}

                <label style={{ ...fieldStyle, marginTop: "0.9rem" }}>
                  <span style={labelStyle}>Anything else? (optional)</span>
                  <textarea
                    style={textareaStyle}
                    value={conditions.notes}
                    onChange={(event) => updateCondition("notes", event.target.value)}
                    placeholder="e.g. pressure from a neighbor, acorns dropping, only have till 10am"
                    rows={2}
                  />
                </label>

                <Button
                  type="button"
                  variant="primary"
                  onClick={askAiScout}
                  disabled={aiScoutStatus === "loading"}
                  style={{ marginTop: "1.1rem" }}
                >
                  {aiScoutStatus === "loading" ? "Asking AI Scout…" : "Ask AI Scout"}
                </Button>

                {aiScoutStatus === "error" ? (
                  <p style={aiScoutErrorStyle}>{aiScoutError}</p>
                ) : null}

                {aiScoutReport ? (
                  <div style={aiScoutReportStyle}>
                    <div style={simpleHeaderStyle}>
                      <div>
                        <p style={eyebrowStyle}>Recommended Stand</p>
                        <h2 style={cardTitleStyle}>{aiScoutReport.recommendedStandName}</h2>
                      </div>
                      <Badge variant={confidenceBadgeVariant(aiScoutReport.confidence)}>
                        {aiScoutReport.confidence} confidence
                      </Badge>
                    </div>
                    <p style={mutedTextStyle}>{aiScoutReport.headline}</p>
                    <p style={mutedTextStyle}>{aiScoutReport.recommendedStandReasoning}</p>

                    {aiScoutReport.keyFactors.length > 0 ? (
                      <>
                        <p style={{ ...detailLabelStyle, marginTop: "1rem" }}>Key Factors</p>
                        <ul style={bulletListStyle}>
                          {aiScoutReport.keyFactors.map((factor) => (
                            <li key={factor} style={bulletItemStyle}>
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}

                    {aiScoutReport.risks.length > 0 ? (
                      <>
                        <p style={{ ...detailLabelStyle, marginTop: "1rem" }}>Worth Knowing</p>
                        <ul style={bulletListStyle}>
                          {aiScoutReport.risks.map((risk) => (
                            <li key={risk} style={bulletItemStyle}>
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            )}
          </Section>

          <div style={footerActionStyle}>
            <Link href={`/properties/${selectedProperty.id}`} style={primaryLinkStyle} className="di-navbtn">
              Open Property Command Center
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

function confidenceBadgeVariant(confidence: AiScoutReport["confidence"]) {
  if (confidence === "high") return "success" as const;
  if (confidence === "medium") return "default" as const;

  return "warning" as const;
}

// The PageHeader now carries the golden-hour band itself (di-section-hero), so
// this wrapper card just passes through without its own surface/padding.
const heroCardStyle: CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  boxShadow: "none",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const labelStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontSize: "0.85rem",
  fontWeight: 800,
};

const bulletListStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  margin: 0,
  paddingLeft: "1.25rem",
};

const bulletItemStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "1.04rem",
  lineHeight: 1.55,
};

const simpleHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const cardTitleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text)",
  fontSize: "1.55rem",
  lineHeight: 1.2,
};

const mutedTextStyle: CSSProperties = {
  margin: "0.7rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const footerActionStyle: CSSProperties = {
  marginTop: "1.75rem",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  marginTop: "1rem",
  padding: "0.7rem 0.9rem",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};

const leadStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "0.98rem",
  lineHeight: 1.55,
};

const conditionsSummaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  marginTop: "1rem",
  padding: "0.75rem 0.85rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
};

const conditionsLineStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  color: "var(--text)",
  fontSize: "0.98rem",
  fontWeight: 800,
  lineHeight: 1.4,
};

const conditionsSourceStyle: CSSProperties = {
  margin: "0.15rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.78rem",
};

const changeButtonStyle: CSSProperties = {
  flex: "none",
  minHeight: "40px",
  padding: "0 0.85rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "0.88rem",
  fontWeight: 800,
  cursor: "pointer",
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

const aiScoutReportStyle: CSSProperties = {
  marginTop: "1.25rem",
  paddingTop: "1.1rem",
  borderTop: "1px solid var(--border)",
};

