"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import {
  deerSeenSummary,
  formatHuntDate,
  formatHuntTimeRange,
  huntOutcomeLabel,
  sortHuntsChronologically,
  yesNoLabel,
} from "@/lib/hunts";
import type { HuntLogEntry } from "@/types/hunt";

type HuntLogListProps = {
  hunts: HuntLogEntry[];
  emptyDescription?: string;
  getPropertyName?: (propertyId: string) => string;
  /** When given, each sit offers "Edit". */
  onEdit?: (hunt: HuntLogEntry) => void;
  /** When given, each sit offers "Delete" (with a confirm). */
  onDelete?: (huntId: string) => void;
  /** The sit being edited; its card is replaced by `editor`. */
  editingHuntId?: string | null;
  editor?: ReactNode;
};

export default function HuntLogList({
  hunts,
  emptyDescription = "No hunts logged yet.",
  getPropertyName,
  onEdit,
  onDelete,
  editingHuntId = null,
  editor = null,
}: HuntLogListProps) {
  const [confirmingHunt, setConfirmingHunt] = useState<HuntLogEntry | null>(
    null,
  );
  const chronologicalHunts = sortHuntsChronologically(hunts);

  if (chronologicalHunts.length === 0) {
    return <EmptyState description={emptyDescription} />;
  }

  return (
    <div style={listStyle}>
      {chronologicalHunts.map((hunt) =>
        hunt.id === editingHuntId && editor ? (
          <Card key={hunt.id} as="article" variant="subtle">
            <p style={eyebrowStyle}>Editing sit</p>
            {editor}
          </Card>
        ) : (
          <Card key={hunt.id} as="article" variant="subtle">
            <div style={headerStyle}>
              <div>
                <p style={eyebrowStyle}>{hunt.standName || "Stand"}</p>
                <h3 style={titleStyle}>{formatHuntDate(hunt.date)}</h3>
                {getPropertyName ? (
                  <p style={subtitleStyle}>{getPropertyName(hunt.propertyId)}</p>
                ) : null}
              </div>
              <Badge>{huntOutcomeLabel(hunt)}</Badge>
            </div>

            <div style={detailsGridStyle}>
              <HuntDetail label="Time" value={formatHuntTimeRange(hunt)} />
              <HuntDetail label="Wind" value={hunt.windDirection} />
              <HuntDetail label="Wind Speed" value={hunt.windSpeed} />
              <HuntDetail label="Temperature" value={hunt.temperature} />
              <HuntDetail label="Weather" value={hunt.weather} />
              <HuntDetail label="Moon" value={hunt.moonPhase} />
              <HuntDetail label="Deer Seen" value={deerSeenSummary(hunt)} />
              <HuntDetail
                label="Shot Opportunity"
                value={yesNoLabel(hunt.shotOpportunity)}
              />
              <HuntDetail label="Harvest" value={yesNoLabel(hunt.harvest)} />
            </div>

            {hunt.notes ? (
              <div style={notesStyle}>
                <p style={detailLabelStyle}>Notes</p>
                <p style={detailValueStyle}>{hunt.notes}</p>
              </div>
            ) : null}

            {onEdit || onDelete ? (
              <div style={actionsStyle}>
                {onEdit ? (
                  <button
                    type="button"
                    style={editButtonStyle}
                    onClick={() => onEdit(hunt)}
                    disabled={Boolean(editingHuntId)}
                  >
                    Edit
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    style={deleteButtonStyle}
                    onClick={() => setConfirmingHunt(hunt)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </Card>
        ),
      )}

      <ConfirmDialog
        open={confirmingHunt !== null}
        title="Delete this sit?"
        description={
          confirmingHunt
            ? `This removes the ${formatHuntDate(confirmingHunt.date)} sit at ${
                confirmingHunt.standName || "this stand"
              } from your hunt log. It can't be undone.`
            : ""
        }
        confirmLabel="Delete sit"
        confirmVariant="danger"
        onCancel={() => setConfirmingHunt(null)}
        onConfirm={() => {
          const huntId = confirmingHunt?.id;
          setConfirmingHunt(null);
          if (huntId) onDelete?.(huntId);
        }}
      />
    </div>
  );
}

function HuntDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value || "Not set"}</p>
    </div>
  );
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const headerStyle: CSSProperties = {
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

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.2rem",
  lineHeight: 1.25,
};

const subtitleStyle: CSSProperties = {
  margin: "0.3rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.95rem",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const notesStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.5rem",
  marginTop: "1rem",
  paddingTop: "0.75rem",
  borderTop: "1px solid var(--border)",
};

const editButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.4rem 1rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-strong, var(--border))",
  background: "transparent",
  color: "var(--text)",
  fontSize: "0.9rem",
  fontWeight: 700,
  cursor: "pointer",
};

const deleteButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.4rem 1rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--danger-border)",
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  fontSize: "0.9rem",
  fontWeight: 700,
  cursor: "pointer",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};
