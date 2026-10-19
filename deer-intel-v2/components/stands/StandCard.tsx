"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import StandWindBackdrop from "@/components/stands/StandWindBackdrop";
import WindPicker from "@/components/stands/WindPicker";
import { findStandLocation } from "@/lib/accessScent";
import { SUGGEST_REACH_M, suggestStandWinds } from "@/lib/standWindSuggest";
import type { MapPin } from "@/types/mapPin";
import Button from "@/components/ui/Button";
import {
  windMarksFromText,
  windTextFromMarks,
  type WindMarks,
} from "@/lib/windPicker";
import StandIntelligencePanel from "@/components/stands/StandIntelligencePanel";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { StandIcon } from "@/components/ui/FieldIcons";
import type { StandIntelligenceSummary } from "@/lib/standIntelligence";
import { getStandWindCheck } from "@/lib/standWind";
import type { Stand } from "@/types/stand";

type StandCardProps = {
  stand: Stand;
  intelligence?: StandIntelligenceSummary;
  /** Current wind direction (compass point) for a live "wind today" check. */
  todayWind?: string;
  /** When given, the card offers "Set winds" with the tap-to-set compass. */
  onSaveWinds?: (standId: string, winds: { bestWinds: string; avoidWinds: string }) => void;
  /** This property's map pins: puts the stand's ground behind the wind picker. */
  pins?: MapPin[];
};

const WIND_BADGE_VARIANT = {
  good: "success",
  avoid: "danger",
  marginal: "warning",
} as const;

export default function StandCard({
  stand,
  intelligence,
  todayWind,
  onSaveWinds,
  pins = [],
}: StandCardProps) {
  const [editingMarks, setEditingMarks] = useState<WindMarks | null>(null);
  const location = findStandLocation(stand, pins);
  const suggestion = suggestStandWinds(stand, pins);
  const hasWinds = Boolean(stand.bestWinds.trim() || stand.avoidWinds.trim());

  // Opening the picker on a stand with no winds yet starts from the map's
  // suggestion, so a good setup is often just "Save".
  function openWinds() {
    setEditingMarks(
      !hasWinds && suggestion.marks
        ? suggestion.marks
        : windMarksFromText(stand.bestWinds, stand.avoidWinds),
    );
  }

  // A link to /stands#stand-<id> (e.g. from Stand check's "No wind notes")
  // opens this stand's wind picker directly.
  useEffect(() => {
    if (!onSaveWinds || typeof window === "undefined") return;
    if (window.location.hash !== `#stand-${stand.id}`) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openWinds();
    // openWinds reads the same stand fields listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSaveWinds, stand.id, stand.bestWinds, stand.avoidWinds]);

  function saveWinds() {
    if (!editingMarks || !onSaveWinds) return;
    onSaveWinds(stand.id, windTextFromMarks(editingMarks));
    setEditingMarks(null);
  }

  const windCheck = getStandWindCheck(stand, todayWind);
  const windVariant =
    windCheck.status in WIND_BADGE_VARIANT
      ? WIND_BADGE_VARIANT[windCheck.status as keyof typeof WIND_BADGE_VARIANT]
      : null;

  return (
    <Card className="di-card-lift" style={cardStyle} id={`stand-${stand.id}`}>
      <div style={headerStyle}>
        <div style={leadStyle}>
          <span style={iconBadgeStyle} aria-hidden="true">
            <StandIcon size={20} />
          </span>
          <div>
            <p style={eyebrowStyle}>{stand.standType} Stand</p>
            <h3 style={titleStyle}>{stand.name}</h3>
          </div>
        </div>
        <div style={actionsStyle}>
          {windVariant ? (
            <Badge variant={windVariant}>{windCheck.label}</Badge>
          ) : null}
          <Badge>{stand.standType}</Badge>
          <Link
            href={`/properties/${stand.propertyId}/assets/${stand.id}`}
            style={openLinkStyle}
            className="di-navbtn"
          >
            Open Stand
          </Link>
        </div>
      </div>

      {editingMarks ? (
        <div style={windEditorStyle}>
          <WindPicker
            marks={editingMarks}
            onChange={setEditingMarks}
            currentWind={todayWind}
            backdrop={
              location ? (
                <StandWindBackdrop center={location} pins={pins} reachM={SUGGEST_REACH_M} />
              ) : undefined
            }
          />
          <div style={suggestBoxStyle}>
            <p style={suggestTextStyle}>{suggestion.reason}</p>
            {suggestion.marks ? (
              <button
                type="button"
                style={suggestButtonStyle}
                onClick={() => setEditingMarks(suggestion.marks)}
              >
                Use suggested winds
              </button>
            ) : (
              <Link href="/map" style={suggestButtonStyle} className="di-navbtn">
                Open map
              </Link>
            )}
          </div>
          <div style={windActionsStyle}>
            <Button type="button" variant="secondary" onClick={() => setEditingMarks(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveWinds}>
              Save winds
            </Button>
          </div>
        </div>
      ) : (
        <div style={detailsGridStyle}>
          <StandDetail label="Best Winds" value={stand.bestWinds} />
          <StandDetail label="Avoid Winds" value={stand.avoidWinds} />
          {onSaveWinds ? (
            <button
              type="button"
              onClick={openWinds}
              style={setWindsButtonStyle}
            >
              {hasWinds ? "Change winds" : "Set winds"}
            </button>
          ) : null}
        </div>
      )}

      <div style={notesGridStyle}>
        <StandDetail label="Access Route" value={stand.accessRouteNotes} />
        <StandDetail label="Exit Route" value={stand.exitRouteNotes} />
        <StandDetail label="Notes" value={stand.notes} />
      </div>

      {intelligence ? (
        <div style={intelligenceWrapStyle}>
          <CollapsibleSection
            title="Stand Intelligence"
            description="Wind, pressure, hunts, and related camera activity"
            variant="bare"
          >
            <StandIntelligencePanel
              propertyId={stand.propertyId}
              summary={intelligence}
            />
          </CollapsibleSection>
        </div>
      ) : null}
    </Card>
  );
}

function StandDetail({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailTileStyle}>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value || "Not set"}</p>
    </div>
  );
}

const windEditorStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  marginTop: "1rem",
  padding: "1rem 0.75rem",
  borderRadius: "14px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
};

const suggestBoxStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  padding: "0.65rem 0.75rem",
  borderRadius: "10px",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
};

const suggestTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

const suggestButtonStyle: CSSProperties = {
  justifySelf: "start",
  minHeight: "38px",
  display: "inline-flex",
  alignItems: "center",
  padding: "0.35rem 0.85rem",
  borderRadius: "8px",
  border: "1px solid var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  fontSize: "0.85rem",
  fontWeight: 800,
  textDecoration: "none",
  cursor: "pointer",
};

const windActionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.5rem",
};

const setWindsButtonStyle: CSSProperties = {
  gridColumn: "1 / -1",
  minHeight: "44px",
  borderRadius: "12px",
  border: "1px dashed var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  fontSize: "0.95rem",
  fontWeight: 800,
  cursor: "pointer",
};

const cardStyle: CSSProperties = {
  background: "var(--surface-2)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const leadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.7rem",
  minWidth: 0,
};

const iconBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.5rem",
  height: "2.5rem",
  flex: "none",
  borderRadius: "12px",
  background: "var(--accent-tint)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.25rem",
  lineHeight: 1.25,
};

const openLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.5rem 0.65rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontSize: "0.85rem",
  fontWeight: 700,
  textDecoration: "none",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const notesGridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const intelligenceWrapStyle: CSSProperties = {
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const detailTileStyle: CSSProperties = {
  padding: "0.6rem 0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface)",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.7rem",
  fontWeight: 800,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text)",
  lineHeight: 1.5,
};
