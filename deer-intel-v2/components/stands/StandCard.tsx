"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import StandWindBackdrop from "@/components/stands/StandWindBackdrop";
import WindPicker from "@/components/stands/WindPicker";
import { findStandLocation } from "@/lib/accessScent";
import { SUGGEST_REACH_M, suggestStandWinds } from "@/lib/standWindSuggest";
import type { MapPin } from "@/types/mapPin";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  windMarksFromText,
  windTextFromMarks,
  type WindMarks,
} from "@/lib/windPicker";
import StandIntelligencePanel from "@/components/stands/StandIntelligencePanel";
import { StandSuccessLine } from "@/components/insights/StandSuccess";
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
  /** Current wind speed ("2 mph"): under 3 mph the fit reads "Light & variable". */
  todayWindSpeed?: string;
  /** When given, the card offers "Set winds" with the tap-to-set compass. */
  onSaveWinds?: (standId: string, winds: { bestWinds: string; avoidWinds: string }) => void;
  /** This property's map pins: puts the stand's ground behind the wind picker. */
  pins?: MapPin[];
  /** When given, the card offers "Delete stand" (with a confirm). */
  onDelete?: (standId: string) => void;
  /** Same name as another stand here, and this copy carries no winds. */
  likelyDuplicate?: boolean;
  /** The next sit's pick (Today verdict): shows a small "Best sit" badge. */
  bestSit?: boolean;
};

const WIND_BADGE_VARIANT = {
  good: "success",
  avoid: "danger",
  marginal: "warning",
} as const;

// The collapsed row's wind fit: short enough to sit beside the name on a phone.
const SHORT_WIND_LABEL: Record<keyof typeof WIND_BADGE_VARIANT, string> = {
  good: "Good wind",
  avoid: "Wrong wind",
  marginal: "Off wind",
};

export default function StandCard({
  stand,
  intelligence,
  todayWind,
  todayWindSpeed,
  onSaveWinds,
  pins = [],
  onDelete,
  likelyDuplicate = false,
  bestSit = false,
}: StandCardProps) {
  const [editingMarks, setEditingMarks] = useState<WindMarks | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Collapsed to one row by default; a full card is about a phone screen tall.
  const [expanded, setExpanded] = useState(false);
  const bodyId = `stand-body-${stand.id}`;
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
  // expands this card and opens its wind picker directly; /stands?stand=<id>
  // just expands it. Runs once on mount, and clears the hash once it's used:
  // saving winds changes the stand, and re-checking a still-present hash then
  // would pop the picker right back open.
  const canSaveWinds = Boolean(onSaveWinds);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hashMatch = window.location.hash === `#stand-${stand.id}`;
    const queryMatch =
      new URLSearchParams(window.location.search).get("stand") === stand.id;
    if (!hashMatch && !queryMatch) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(true);
    requestAnimationFrame(() =>
      document
        .getElementById(`stand-${stand.id}`)
        ?.scrollIntoView({ block: "start" }),
    );
    if (!hashMatch || !canSaveWinds) return;
    openWinds();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    // Mount-only on purpose (see above); openWinds reads the stand as it is now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveWinds() {
    if (!editingMarks || !onSaveWinds) return;
    onSaveWinds(stand.id, windTextFromMarks(editingMarks));
    setEditingMarks(null);
  }

  const intelligenceBlock = intelligence ? (
    <div style={intelligenceWrapStyle}>
      <CollapsibleSection
        title="Stand Intelligence"
        description="Success rates, wind, pressure, hunts, and related camera activity"
        variant="bare"
      >
        <StandIntelligencePanel
          propertyId={stand.propertyId}
          summary={intelligence}
          stand={{ id: stand.id, name: stand.name }}
        />
      </CollapsibleSection>
    </div>
  ) : null;

  const windCheck = getStandWindCheck(stand, todayWind, todayWindSpeed);
  const windVariant =
    windCheck.status in WIND_BADGE_VARIANT
      ? WIND_BADGE_VARIANT[windCheck.status as keyof typeof WIND_BADGE_VARIANT]
      : null;

  return (
    <Card style={cardStyle} id={`stand-${stand.id}`}>
      <button
        type="button"
        style={summaryStyle}
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((open) => !open)}
      >
        <span style={iconBadgeStyle} aria-hidden="true">
          <StandIcon size={18} />
        </span>
        <span style={summaryTextStyle}>
          <span style={titleStyle}>{stand.name}</span>
          <span style={eyebrowStyle}>{stand.standType}</span>
        </span>
        <span style={summaryBadgesStyle}>
          {bestSit ? <Badge style={bestSitBadgeStyle}>Best sit</Badge> : null}
          {windVariant ? (
            <Badge variant={windVariant} title={windCheck.label}>
              {windCheck.calm
                ? "Calm"
                : SHORT_WIND_LABEL[windCheck.status as keyof typeof WIND_BADGE_VARIANT]}
            </Badge>
          ) : null}
          {likelyDuplicate && onDelete ? (
            <Badge variant="warning">Duplicate?</Badge>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          style={{ ...chevronStyle, ...(expanded ? chevronOpenStyle : null) }}
        >
          ›
        </span>
      </button>

      {expanded ? (
        <div id={bodyId} style={bodyStyle}>
          <div style={openRowStyle}>
            {windVariant ? (
              <Badge variant={windVariant}>{windCheck.label}</Badge>
            ) : null}
            <Link
              href={`/properties/${stand.propertyId}/assets/${stand.id}`}
              style={openLinkStyle}
              className="di-navbtn"
            >
              Open Stand
            </Link>
          </div>

          <StandSuccessLine
            standId={stand.id}
            standName={stand.name}
            propertyId={stand.propertyId}
          />

          {likelyDuplicate && onDelete ? (
            <div style={duplicateStyle} role="note">
              <p style={duplicateTextStyle}>
                <strong>Looks like a duplicate.</strong> Another stand here has the
                same name, and this copy has no winds set.
              </p>
              <button type="button" style={deleteButtonStyle} onClick={() => setConfirmingDelete(true)}>
                Delete this copy
              </button>
            </div>
          ) : null}

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

          {onDelete && !likelyDuplicate ? (
            <button
              type="button"
              style={deleteLinkStyle}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete stand
            </button>
          ) : null}

          {intelligenceBlock}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${stand.name}?`}
        description="This removes the stand from Deer Intel. Logged sits stay in your hunt log, and any map pin stays on the map."
        confirmLabel="Delete stand"
        confirmVariant="danger"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete?.(stand.id);
        }}
      />
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

// Blaze orange is kept for the one thing that matters: the stand to sit.
const bestSitBadgeStyle: CSSProperties = {
  background: "var(--accent-2-tint)",
  border: "1px solid var(--accent-2-tint-border)",
  color: "var(--accent-2-text)",
};

const windEditorStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  marginTop: "1rem",
  padding: "1rem 0.75rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
};

const suggestBoxStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  padding: "0.65rem 0.75rem",
  borderRadius: "var(--radius-sm)",
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
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  fontSize: "0.85rem",
  fontWeight: 800,
  textDecoration: "none",
  cursor: "pointer",
};

const duplicateStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginTop: "0.9rem",
  padding: "0.65rem 0.8rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--warning-border)",
  background: "var(--warning-bg)",
};

const duplicateTextStyle: CSSProperties = {
  margin: 0,
  flex: "1 1 14rem",
  color: "var(--warning-text)",
  fontSize: "0.88rem",
  lineHeight: 1.45,
};

const deleteButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "0.4rem 0.85rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--danger-border)",
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  fontSize: "0.85rem",
  fontWeight: 800,
  cursor: "pointer",
};

const deleteLinkStyle: CSSProperties = {
  display: "block",
  marginTop: "0.75rem",
  padding: "0.3rem 0",
  border: "none",
  background: "none",
  color: "var(--danger-text)",
  fontSize: "0.85rem",
  fontWeight: 700,
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
  borderRadius: "var(--radius-sm)",
  border: "1px dashed var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  fontSize: "0.95rem",
  fontWeight: 800,
  cursor: "pointer",
};

const cardStyle: CSSProperties = {
  padding: 0,
  background: "var(--surface-2)",
};

// The collapsed card: one tappable row (name, type, wind fit, best sit, chevron).
const summaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.65rem",
  width: "100%",
  minHeight: "56px",
  padding: "0.5rem 0.85rem",
  border: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
};

const summaryTextStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
  flex: "1 1 auto",
  minWidth: 0,
};

const summaryBadgesStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "0.3rem",
  flex: "0 1 auto",
};

const chevronStyle: CSSProperties = {
  flex: "none",
  color: "var(--text-muted)",
  fontSize: "1.3rem",
  lineHeight: 1,
  transition: "transform 160ms ease",
};

const chevronOpenStyle: CSSProperties = {
  transform: "rotate(90deg)",
};

const bodyStyle: CSSProperties = {
  padding: "0.25rem 1.15rem 1.15rem",
  borderTop: "1px solid var(--border)",
};

const openRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.5rem",
  flexWrap: "wrap",
  padding: "0.75rem 0",
};



const iconBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.1rem",
  height: "2.1rem",
  flex: "none",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-tint)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
};


const eyebrowStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.68rem",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text)",
  fontSize: "1.05rem",
  fontWeight: 600,
  lineHeight: 1.25,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const openLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.5rem 0.65rem",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
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
  borderRadius: "var(--radius-sm)",
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
