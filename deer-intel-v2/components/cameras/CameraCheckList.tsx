"use client";

import { useState, type CSSProperties } from "react";
import CameraCheckForm from "@/components/cameras/CameraCheckForm";
import PhotoRecordList from "@/components/photos/PhotoRecordList";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import {
  checkFormValuesFromCheck,
  createCameraCheckFromValues,
  EMPTY_CAMERA_CHECK_FORM_VALUES,
  type CameraCheckFormValues,
} from "@/lib/cameraCheckFormValues";
import {
  deleteCameraCheckFromState,
  formatCameraCheckDate,
  sortCameraChecksChronologically,
  updateCameraCheckInState,
} from "@/lib/cameraChecks";
import { updateDeerIntelStore } from "@/lib/deerIntelStore";
import type { WeatherPoint } from "@/lib/liveWeather";
import {
  formatWeatherTemperature,
  formatWeatherWind,
} from "@/lib/weather";
import { getPhotoRecordsForCheck } from "@/lib/photos";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";

type CameraCheckListProps = {
  checks: CameraCheck[];
  photoRecords?: PhotoRecord[];
  deerProfiles?: DeerProfile[];
  /** Hide Edit / Delete (e.g. a read-only summary). Default: shown. */
  readOnly?: boolean;
  /** Weather point for the edit form's live-weather fill. */
  weatherLocation?: WeatherPoint | null;
  /** Override how an edited check is saved; default writes to the store. */
  onUpdate?: (check: CameraCheck) => void;
  /** Override how a check is deleted; default removes it from the store. */
  onDelete?: (checkId: string) => void;
};

// Saved checks, oldest first, each with Edit (the check form, pre-filled, in
// place of the card) and Delete (with a confirm) so a typo'd count or date can
// be fixed. Saves go straight to the store unless the parent overrides them.
export default function CameraCheckList({
  checks,
  photoRecords = [],
  deerProfiles = [],
  readOnly = false,
  weatherLocation = null,
  onUpdate,
  onDelete,
}: CameraCheckListProps) {
  const [editingCheckId, setEditingCheckId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<CameraCheckFormValues>(
    EMPTY_CAMERA_CHECK_FORM_VALUES,
  );
  const [confirmingCheck, setConfirmingCheck] = useState<CameraCheck | null>(
    null,
  );
  const chronologicalChecks = sortCameraChecksChronologically(checks);
  const editingCheck =
    chronologicalChecks.find((check) => check.id === editingCheckId) ?? null;

  function startEditing(check: CameraCheck) {
    setEditValues(checkFormValuesFromCheck(check));
    setEditingCheckId(check.id);
  }

  function cancelEditing() {
    setEditingCheckId(null);
    setEditValues(EMPTY_CAMERA_CHECK_FORM_VALUES);
  }

  function saveEditing() {
    if (!editingCheck) return;

    const updated = createCameraCheckFromValues({
      id: editingCheck.id,
      propertyId: editingCheck.propertyId,
      cameraId: editingCheck.cameraId,
      values: editValues,
    });
    // A cleared date can't be saved; leave the form open to fix it.
    if (!updated) return;

    if (onUpdate) onUpdate(updated);
    else updateDeerIntelStore((state) => updateCameraCheckInState(state, updated));
    cancelEditing();
  }

  function deleteCheck(checkId: string) {
    if (onDelete) onDelete(checkId);
    else updateDeerIntelStore((state) => deleteCameraCheckFromState(state, checkId));
    if (editingCheckId === checkId) cancelEditing();
  }

  if (chronologicalChecks.length === 0) {
    return (
      <EmptyState description="No camera checks yet. Save the first check above." />
    );
  }

  return (
    <div style={listStyle}>
      {chronologicalChecks.map((check) => {
        const checkPhotoRecords = getPhotoRecordsForCheck(
          photoRecords,
          check.id,
        );

        if (check.id === editingCheckId) {
          return (
            <Card key={check.id} as="article" variant="subtle">
              <p style={eyebrowStyle}>Editing check</p>
              <div style={editorStyle}>
                <CameraCheckForm
                  values={editValues}
                  weatherLocation={weatherLocation}
                  onChange={setEditValues}
                  onSubmit={saveEditing}
                  onCancel={cancelEditing}
                  submitLabel="Save changes"
                />
              </div>
            </Card>
          );
        }

        return (
          <Card key={check.id} as="article" variant="subtle">
            <div style={headerStyle}>
              <div>
                <p style={eyebrowStyle}>Camera Check</p>
                <h3 style={titleStyle}>{formatCameraCheckDate(check.date)}</h3>
              </div>
              <Badge>{wildlifeTotal(check)} sightings</Badge>
            </div>

            <div style={detailsGridStyle}>
              <CheckDetail
                label="Battery"
                value={formatPercent(check.batteryPercent)}
              />
              <CheckDetail
                label="SD Card"
                value={formatPercent(check.sdCardPercent)}
              />
              <CheckDetail
                label="Signal"
                value={formatPercent(check.signalStrength)}
              />
              <CheckDetail
                label="Temperature"
                value={formatWeatherTemperature(
                  check.weatherSnapshot.temperature,
                )}
              />
              <CheckDetail
                label="Wind"
                value={formatWeatherWind(check.weatherSnapshot)}
              />
              <CheckDetail
                label="Weather"
                value={check.weatherSnapshot.conditions}
              />
              <CheckDetail label="Moon" value={check.weatherSnapshot.moonPhase} />
              <CheckDetail label="Bucks" value={String(check.bucks)} />
              <CheckDetail label="Does" value={String(check.does)} />
              <CheckDetail label="Fawns" value={String(check.fawns)} />
              <CheckDetail label="Turkeys" value={String(check.turkeys)} />
              <CheckDetail label="Bears" value={String(check.bears)} />
              <CheckDetail label="Coyotes" value={String(check.coyotes)} />
            </div>

            {check.otherWildlife || check.notes ? (
              <div style={notesStyle}>
                {check.otherWildlife ? (
                  <>
                    <p style={detailLabelStyle}>Other Wildlife</p>
                    <p style={detailValueStyle}>{check.otherWildlife}</p>
                  </>
                ) : null}
                {check.notes ? (
                  <>
                    <p style={detailLabelStyle}>Notes</p>
                    <p style={detailValueStyle}>{check.notes}</p>
                  </>
                ) : null}
              </div>
            ) : null}

            {checkPhotoRecords.length > 0 ? (
              <div style={photoRecordsStyle}>
                <p style={detailLabelStyle}>Photo Records</p>
                <PhotoRecordList
                  photoRecords={checkPhotoRecords}
                  deerProfiles={deerProfiles}
                />
              </div>
            ) : null}

            {readOnly ? null : (
              <div style={actionsStyle}>
                <button
                  type="button"
                  style={editButtonStyle}
                  onClick={() => startEditing(check)}
                  disabled={Boolean(editingCheckId)}
                  aria-label={`Edit the ${formatCameraCheckDate(check.date)} check`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  style={deleteButtonStyle}
                  onClick={() => setConfirmingCheck(check)}
                  aria-label={`Delete the ${formatCameraCheckDate(check.date)} check`}
                >
                  Delete
                </button>
              </div>
            )}
          </Card>
        );
      })}

      <ConfirmDialog
        open={confirmingCheck !== null}
        title="Delete this check?"
        description={
          confirmingCheck
            ? `This removes the ${formatCameraCheckDate(
                confirmingCheck.date,
              )} camera check and its counts. Photos filed under it are kept. It can't be undone.`
            : ""
        }
        confirmLabel="Delete check"
        confirmVariant="danger"
        onCancel={() => setConfirmingCheck(null)}
        onConfirm={() => {
          const checkId = confirmingCheck?.id;
          setConfirmingCheck(null);
          if (checkId) deleteCheck(checkId);
        }}
      />
    </div>
  );
}

function CheckDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value || "Not set"}</p>
    </div>
  );
}

function wildlifeTotal(check: CameraCheck) {
  return (
    check.bucks +
    check.does +
    check.fawns +
    check.turkeys +
    check.bears +
    check.coyotes
  );
}

function formatPercent(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) return "";
  if (trimmedValue.endsWith("%")) return trimmedValue;
  if (!Number.isNaN(Number(trimmedValue))) return `${trimmedValue}%`;

  return trimmedValue;
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
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.2rem",
  lineHeight: 1.25,
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(110px, 100%), 1fr))",
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

const photoRecordsStyle: CSSProperties = {
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const editorStyle: CSSProperties = {
  marginTop: "0.75rem",
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
  border: "1px solid var(--border-strong)",
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
