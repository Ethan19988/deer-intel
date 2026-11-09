"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import StandWindBackdrop from "@/components/stands/StandWindBackdrop";
import StandForm from "@/components/stands/StandForm";
import WindPicker from "@/components/stands/WindPicker";
import { findStandLocation } from "@/lib/accessScent";
import { SUGGEST_REACH_M, suggestStandWinds } from "@/lib/standWindSuggest";
import type { MapPin } from "@/types/mapPin";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  hasUnreadableWindText,
  windMarksFromText,
  windTextForSave,
  type WindMarks,
} from "@/lib/windPicker";
import { hasStandDetails, standDetailLabels } from "@/lib/standDetails";
import {
  formatCoordinate,
  standFormValuesFromStand,
  type StandFormValues,
} from "@/lib/standFormValues";
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
  /**
   * When given, the card offers "Edit stand" (the full form). Returns a
   * message when the form can't be saved, else null.
   */
  onSave?: (stand: Stand, values: StandFormValues) => string | null;
  /**
   * The stand's map pin as the page resolved it (lib/standSave
   * standLocationPin). Undefined = look it up here from `pins`.
   */
  locationPin?: MapPin | null;
  /** Why the next sit's check sank this stand on time, e.g. "Evening sit — this is a morning stand". */
  timingNote?: string;
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
  onSave,
  locationPin,
  timingNote,
}: StandCardProps) {
  const [editingMarks, setEditingMarks] = useState<WindMarks | null>(null);
  const [editValues, setEditValues] = useState<StandFormValues | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Collapsed to one row by default; a full card is about a phone screen tall.
  const [expanded, setExpanded] = useState(false);
  const bodyId = `stand-body-${stand.id}`;
  const location =
    locationPin !== undefined ? locationPin : findStandLocation(stand, pins);
  const savedLocation = location
    ? { lat: formatCoordinate(location.lat), lng: formatCoordinate(location.lng) }
    : null;
  const detailLabels = standDetailLabels(stand);
  // Pin-promoted stands start as "Other" with nothing else set: nudge for the
  // basics the hunter knows and the map can't.
  const needsBasics = stand.standType === "Other" && !hasStandDetails(stand);
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
    // Unchanged lists keep their saved text word-for-word (lib/windPicker).
    onSaveWinds(stand.id, windTextForSave(stand, editingMarks));
    setEditingMarks(null);
  }

  function openEdit() {
    setEditingMarks(null);
    setEditError(null);
    setEditValues(standFormValuesFromStand(stand, location));
  }

  function saveEdit() {
    if (!editValues || !onSave) return;
    const problem = onSave(stand, editValues);
    setEditError(problem);
    if (!problem) setEditValues(null);
  }

  const unreadableWinds = [stand.bestWinds, stand.avoidWinds].filter(hasUnreadableWindText);

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
        {/* The name gets the row's full width (wrapping to two lines before
            any ellipsis); type and badges wrap on the line under it. */}
        <span style={summaryTextStyle}>
          <span style={titleStyle}>{stand.name}</span>
          <span style={summaryMetaStyle}>
            <span style={eyebrowStyle}>
              {stand.standType}
              {stand.bestTime && stand.bestTime !== "all"
                ? ` · ${stand.bestTime.toUpperCase()}`
                : ""}
            </span>
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
        </span>
        <span
          aria-hidden="true"
          style={{ ...chevronStyle, ...(expanded ? chevronOpenStyle : null) }}
        >
          ›
        </span>
      </button>

      {expanded && editValues ? (
        <div id={bodyId} style={bodyStyle}>
          <div style={editWrapStyle}>
            <StandForm
              mode="edit"
              values={editValues}
              onChange={setEditValues}
              onSubmit={saveEdit}
              onCancel={() => {
                setEditValues(null);
                setEditError(null);
              }}
              error={editError}
              savedLocation={savedLocation}
            />
          </div>
        </div>
      ) : expanded ? (
        <div id={bodyId} style={bodyStyle}>
          <div style={openRowStyle}>
            {onSave ? (
              <button type="button" style={editButtonStyle} onClick={openEdit}>
                Edit stand
              </button>
            ) : null}
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

          {timingNote ? (
            <p style={timingNoteStyle} role="note">
              {timingNote}
            </p>
          ) : null}

          {needsBasics && onSave ? (
            <div style={nudgeStyle} role="note">
              <p style={nudgeTextStyle}>
                Type, best time and setup aren&apos;t set yet.
              </p>
              <button type="button" style={nudgeButtonStyle} onClick={openEdit}>
                Set them
              </button>
            </div>
          ) : null}

          <StandSuccessLine
            standId={stand.id}
            standName={stand.name}
            propertyId={stand.propertyId}
          />

          <dl style={factsStyle}>
            <div style={factStyle}>
              <dt style={factLabelStyle}>Location</dt>
              <dd style={factValueStyle}>
                {location ? (
                  <span style={monoStyle}>
                    {savedLocation?.lat}, {savedLocation?.lng}
                  </span>
                ) : onSave ? (
                  <button type="button" style={inlineLinkStyle} onClick={openEdit}>
                    Not on the map — add location
                  </button>
                ) : (
                  "Not on the map"
                )}
              </dd>
            </div>
            {detailLabels.map((detail) => (
              <div key={detail.label} style={factStyle}>
                <dt style={factLabelStyle}>{detail.label}</dt>
                <dd style={factValueStyle}>{detail.value}</dd>
              </div>
            ))}
          </dl>

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
              {unreadableWinds.length > 0 ? (
                <p style={windWarnStyle} role="note">
                  {unreadableWinds.map((text) => `“${text}”`).join(" and ")}{" "}
                  {unreadableWinds.length > 1 ? "have" : "has"} words the compass
                  can&apos;t show. Saving keeps it unless you change that
                  list&apos;s directions, which rewrites it as directions only.
                </p>
              ) : null}
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
              <StandDetail label="Best winds" value={stand.bestWinds} />
              <StandDetail label="Avoid winds" value={stand.avoidWinds} />
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
            <StandDetail label="Access route" value={stand.accessRouteNotes} />
            <StandDetail label="Exit route" value={stand.exitRouteNotes} />
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

const editWrapStyle: CSSProperties = {
  paddingTop: "0.9rem",
};

const editButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.5rem 0.85rem",
  border: "1px solid var(--border-strong, var(--border))",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "var(--text)",
  fontSize: "0.85rem",
  fontWeight: 700,
  cursor: "pointer",
};

const timingNoteStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  padding: "0.5rem 0.7rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--warning-border)",
  background: "var(--warning-bg)",
  color: "var(--warning-text)",
  fontSize: "0.88rem",
  fontWeight: 700,
};

const nudgeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginBottom: "0.75rem",
  padding: "0.55rem 0.75rem",
  borderRadius: "var(--radius-sm)",
  border: "1px dashed var(--accent)",
  background: "var(--accent-tint)",
};

const nudgeTextStyle: CSSProperties = {
  margin: 0,
  flex: "1 1 12rem",
  color: "var(--accent-text)",
  fontSize: "0.88rem",
  lineHeight: 1.45,
};

const nudgeButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.4rem 0.85rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--accent)",
  background: "var(--surface)",
  color: "var(--accent-text)",
  fontSize: "0.85rem",
  fontWeight: 800,
  cursor: "pointer",
};

const factsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(9.5rem, 100%), 1fr))",
  gap: "0.5rem",
  margin: "0.9rem 0 0",
};

const factStyle: CSSProperties = {
  minWidth: 0,
  padding: "0.45rem 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
};

const factLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.66rem",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
};

const factValueStyle: CSSProperties = {
  margin: "0.15rem 0 0",
  color: "var(--text)",
  fontSize: "0.9rem",
  lineHeight: 1.4,
  overflowWrap: "anywhere",
};

const monoStyle: CSSProperties = {
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.8rem",
};

const inlineLinkStyle: CSSProperties = {
  minHeight: "44px",
  padding: 0,
  border: "none",
  background: "none",
  color: "var(--accent-text)",
  fontSize: "0.9rem",
  fontWeight: 700,
  textAlign: "left",
  cursor: "pointer",
};

const windWarnStyle: CSSProperties = {
  margin: 0,
  padding: "0.5rem 0.65rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--warning-border)",
  background: "var(--warning-bg)",
  color: "var(--warning-text)",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

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
  gap: "0.3rem",
  flex: "1 1 auto",
  minWidth: 0,
};

// Type + badges on the line under the name, wrapping as needed.
const summaryMetaStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.3rem 0.4rem",
  minWidth: 0,
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

// Up to two lines; an ellipsis only past that.
const titleStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  overflowWrap: "anywhere",
  color: "var(--text)",
  fontSize: "1.05rem",
  fontWeight: 600,
  lineHeight: 1.25,
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
