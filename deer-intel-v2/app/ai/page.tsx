"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import {
  EMPTY_AI_SCOUT_CONDITIONS,
  buildAiScoutRequestContext,
} from "@/lib/aiScoutContext";
import { checkAiScoutConfigured, requestAiScoutReport } from "@/lib/aiScoutClient";
import { useAiScoutEnabled } from "@/lib/aiScoutPreferences";
import {
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  getDeerIntelligenceHubSummary,
  type DeerHubItem,
} from "@/lib/deerIntelligenceHub";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { getScoutPicks } from "@/lib/terrainMovementData";
import { boundsOfHuntArea, useTerrainSet } from "@/lib/useTerrainSet";
import { TERRAIN_STYLE } from "@/lib/terrainMovement";
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
  const hub = selectedProperty
    ? getDeerIntelligenceHubSummary({
        property: selectedProperty,
        cameras: propertyCameras,
        cameraChecks: propertyCameraChecks,
        stands: propertyStands,
        hunts: propertyHunts,
        photoRecords: propertyPhotoRecords,
        deerProfiles: propertyDeerProfiles,
        pins: propertyPins,
      })
    : null;

  // Terrain-predicted scouting spots for this property, if a LiDAR read covers
  // its location. Surfaced as its own section and fed into the AI Scout context
  // so the LLM can weigh terrain against the hunter's saved stands.
  const terrainPoint = selectedProperty
    ? resolvePropertyWeatherPoint(selectedProperty, propertyCameras, propertyPins)
    : null;
  const terrainSet = useTerrainSet(
    terrainPoint,
    selectedProperty?.name,
    boundsOfHuntArea(selectedProperty?.huntArea),
  );
  const scoutPicks = terrainSet ? getScoutPicks(terrainSet) : [];

  function selectProperty(propertyId: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: propertyId,
    }));
  }

  const aiScoutEnabled = useAiScoutEnabled();
  const [aiScoutConfigured, setAiScoutConfigured] = useState<boolean | null>(null);
  const [conditions, setConditions] = useState<AiScoutConditions>(EMPTY_AI_SCOUT_CONDITIONS);
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
          eyebrow="Deer Intelligence"
          title="Deer Intelligence Hub"
          description="A simple readout for what matters right now on one property. No charts, no AI calls, just plain hunting information from your saved Deer Intel data."
          meta={
            <>
              <Badge variant="success">Rule Based</Badge>
              <Badge>No AI Calls Yet</Badge>
            </>
          }
        />
      </Card>

      <Section eyebrow="Property" title="Choose Property">
        {state.properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            description="Add a property before Deer Intel can build an intelligence hub."
            action={
              <Link href="/properties" style={primaryLinkStyle}>
                Add Property
              </Link>
            }
          />
        ) : (
          <Card as="div" variant="subtle">
            <label style={fieldStyle}>
              <span style={labelStyle}>Property</span>
              <select
                style={selectStyle}
                value={selectedPropertyId}
                onChange={(event) => selectProperty(event.target.value)}
              >
                {state.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
          </Card>
        )}
      </Section>

      {hub && selectedProperty ? (
        <>
          <Section eyebrow="1" title="What's Happening">
            <Card as="div" variant="subtle">
              <ul style={bulletListStyle}>
                {hub.whatsHappening.map((insight) => (
                  <li key={insight} style={bulletItemStyle}>
                    {insight}
                  </li>
                ))}
              </ul>
            </Card>
          </Section>

          <Section eyebrow="2" title="Best Stand">
            <Card as="article" variant="subtle">
              <div style={simpleHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Recommended Stand</p>
                  <h2 style={cardTitleStyle}>{hub.bestStand.name}</h2>
                </div>
                <Badge variant={hub.bestStand.href ? "success" : "warning"}>
                  One Pick
                </Badge>
              </div>
              <p style={mutedTextStyle}>{hub.bestStand.reason}</p>
              {hub.bestStand.href ? (
                <Link href={hub.bestStand.href} style={primaryLinkStyle}>
                  Open Stand
                </Link>
              ) : null}
            </Card>
          </Section>

          <Section eyebrow="3" title="Recent Buck Activity">
            <Card as="article" variant="subtle">
              <div style={simpleHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Latest Mature Buck</p>
                  <h2 style={cardTitleStyle}>{hub.recentBuckActivity.title}</h2>
                </div>
                <Badge>{hub.recentBuckActivity.date}</Badge>
              </div>
              <div style={detailGridStyle}>
                <HubDetail label="Camera" value={hub.recentBuckActivity.camera} />
                <HubDetail
                  label="Property"
                  value={hub.recentBuckActivity.property}
                />
                <HubDetail label="Date" value={hub.recentBuckActivity.date} />
                <HubDetail label="Time" value={hub.recentBuckActivity.time} />
              </div>
              <p style={mutedTextStyle}>{hub.recentBuckActivity.detail}</p>
              {hub.recentBuckActivity.href ? (
                <Link href={hub.recentBuckActivity.href} style={primaryLinkStyle}>
                  Open Camera
                </Link>
              ) : null}
            </Card>
          </Section>

          <Section eyebrow="4" title="Needs Attention">
            {hub.needsAttention.length === 0 ? (
              <EmptyState description="Nothing urgent stands out right now." />
            ) : (
              <div style={attentionGridStyle}>
                {hub.needsAttention.map((item) => (
                  <AttentionCard key={`${item.title}-${item.detail}`} item={item} />
                ))}
              </div>
            )}
          </Section>

          <Section eyebrow="5" title="Property Snapshot">
            <div style={snapshotGridStyle}>
              <StatCard
                label="Cameras"
                value={hub.snapshot.cameras}
                detail="Camera sites"
              />
              <StatCard
                label="Stands"
                value={hub.snapshot.stands}
                detail="Stand sites"
              />
              <StatCard
                label="Deer Profiles"
                value={hub.snapshot.deerProfiles}
                detail="Tracked deer"
              />
              <StatCard
                label="Hunts"
                value={hub.snapshot.hunts}
                detail="Hunt log entries"
              />
              <StatCard
                label="Photos"
                value={hub.snapshot.photos}
                detail="Photo records"
              />
            </div>
          </Section>

          {terrainSet ? (
            <Section
              eyebrow="Terrain"
              title="Scout Picks"
              action={<Badge variant="success">LiDAR read</Badge>}
            >
              <Card as="div" variant="subtle">
                <p style={mutedTextStyle}>
                  Predicted spots from the terrain read of {terrainSet.areaName} —
                  where deer likely bed, travel, and cross, ranked as places to
                  scout. Open the map&apos;s Terrain layer to see them on the ground.
                </p>
                <ol style={scoutPickListStyle}>
                  {scoutPicks.slice(0, 5).map((pick) => (
                    <li key={pick.id} style={scoutPickItemStyle}>
                      <span
                        style={{
                          ...scoutPickDotStyle,
                          background: TERRAIN_STYLE[pick.kind].color,
                        }}
                        aria-hidden="true"
                      />
                      <div>
                        <p style={scoutPickTitleStyle}>{pick.title}</p>
                        <p style={scoutPickReasonStyle}>{pick.reason}</p>
                        {pick.windNote ? (
                          <p style={scoutPickWindStyle}>🌬️ {pick.windNote}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
                <Link href="/map" style={primaryLinkStyle}>
                  Open Terrain Map
                </Link>
              </Card>
            </Section>
          ) : null}

          <Section
            eyebrow="6"
            title="AI Scout"
            action={
              <Badge variant={aiScoutConfigured && aiScoutEnabled ? "success" : "warning"}>
                Beta
              </Badge>
            }
          >
            {!aiScoutEnabled ? (
              <EmptyState
                title="AI Scout is turned off"
                description="You've turned off AI Scout recommendations in Settings → AI Scout. The rule-based insights above keep working. Turn it back on there whenever you want LLM recommendations."
              />
            ) : aiScoutConfigured === null ? (
              <Card as="div" variant="subtle">
                <p style={mutedTextStyle}>Checking AI Scout availability…</p>
              </Card>
            ) : aiScoutConfigured === false ? (
              <EmptyState
                title="AI Scout isn't turned on yet"
                description="This property's saved data hasn't changed — AI Scout just needs an ANTHROPIC_API_KEY set as an environment variable on the server (see the README) before it can make real recommendations. Everything else above keeps working without it."
              />
            ) : (
              <Card as="div" variant="subtle">
                <p style={mutedTextStyle}>
                  Tell AI Scout today&apos;s conditions and it will read this property&apos;s
                  saved stands, hunts, camera checks, and buck photos to recommend where to
                  hunt — grounded only in what you&apos;ve actually logged.
                </p>

                <div style={conditionsGridStyle}>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Wind Direction</span>
                    <input
                      style={inputStyle}
                      value={conditions.windDirection}
                      onChange={(event) => updateCondition("windDirection", event.target.value)}
                      placeholder="e.g. NW"
                    />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Wind Speed</span>
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
                    <span style={labelStyle}>Moon Phase</span>
                    <input
                      style={inputStyle}
                      value={conditions.moonPhase}
                      onChange={(event) => updateCondition("moonPhase", event.target.value)}
                      placeholder={moon ? moon.phase : "e.g. Waning Gibbous"}
                    />
                    {moon ? (
                      <span style={moonHintStyle}>
                        Tonight: {moon.phase} · {moon.illumination}% lit —{" "}
                        {moon.movement}
                      </span>
                    ) : null}
                  </label>
                </div>

                <label style={{ ...fieldStyle, marginTop: "0.9rem" }}>
                  <span style={labelStyle}>Anything else worth knowing today</span>
                  <textarea
                    style={textareaStyle}
                    value={conditions.notes}
                    onChange={(event) => updateCondition("notes", event.target.value)}
                    placeholder="e.g. hunting pressure nearby, first cold front, food source changing"
                    rows={2}
                  />
                </label>

                <button
                  type="button"
                  style={{
                    ...primaryButtonStyle,
                    ...(aiScoutStatus === "loading" ? disabledButtonStyle : null),
                  }}
                  onClick={askAiScout}
                  disabled={aiScoutStatus === "loading"}
                >
                  {aiScoutStatus === "loading" ? "Asking AI Scout…" : "Ask AI Scout"}
                </button>

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
            <Link href={`/properties/${selectedProperty.id}`} style={primaryLinkStyle}>
              Open Property Command Center
            </Link>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}

function confidenceBadgeVariant(confidence: AiScoutReport["confidence"]) {
  if (confidence === "high") return "success" as const;
  if (confidence === "medium") return "default" as const;

  return "warning" as const;
}

function AttentionCard({ item }: { item: DeerHubItem }) {
  const content = (
    <>
      <h3 style={attentionTitleStyle}>{item.title}</h3>
      <p style={mutedTextStyle}>{item.detail}</p>
    </>
  );

  if (!item.href) {
    return (
      <Card as="article" variant="subtle">
        {content}
      </Card>
    );
  }

  return (
    <Link href={item.href} style={attentionLinkStyle}>
      {content}
    </Link>
  );
}

function HubDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value}</p>
    </div>
  );
}

const heroCardStyle: CSSProperties = {
  padding: "1.5rem",
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

const selectStyle: CSSProperties = {
  minHeight: "48px",
  width: "100%",
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
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
  letterSpacing: 0,
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

const detailGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text)",
  lineHeight: 1.45,
};

const attentionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const attentionTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "1.08rem",
  lineHeight: 1.25,
};

const attentionLinkStyle: CSSProperties = {
  display: "block",
  padding: "1.15rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
  textDecoration: "none",
};

const snapshotGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "1rem",
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
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};

const conditionsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.9rem",
  marginTop: "1.1rem",
};

const inputStyle: CSSProperties = {
  minHeight: "48px",
  width: "100%",
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
};

const moonHintStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.82rem",
  lineHeight: 1.4,
};

const textareaStyle: CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontFamily: "inherit",
  resize: "vertical",
};

const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  marginTop: "1.1rem",
  padding: "0.7rem 1.1rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.65,
  cursor: "not-allowed",
};

const aiScoutErrorStyle: CSSProperties = {
  margin: "0.9rem 0 0",
  padding: "0.75rem",
  border: "1px solid var(--danger-border)",
  borderRadius: "8px",
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  lineHeight: 1.5,
};

const aiScoutReportStyle: CSSProperties = {
  marginTop: "1.25rem",
  paddingTop: "1.1rem",
  borderTop: "1px solid var(--border)",
};

const scoutPickListStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
  margin: "1.1rem 0 0",
  padding: 0,
  listStyle: "none",
};

const scoutPickItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.7rem",
};

const scoutPickDotStyle: CSSProperties = {
  flex: "0 0 auto",
  width: "14px",
  height: "14px",
  marginTop: "0.3rem",
  borderRadius: "4px",
  boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.2)",
};

const scoutPickTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "1.05rem",
  fontWeight: 850,
  lineHeight: 1.25,
};

const scoutPickReasonStyle: CSSProperties = {
  margin: "0.3rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const scoutPickWindStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "var(--accent-text)",
  fontSize: "0.92rem",
  fontWeight: 700,
  lineHeight: 1.4,
};
