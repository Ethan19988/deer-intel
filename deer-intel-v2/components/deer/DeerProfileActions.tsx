"use client";

import { useId, useState, type CSSProperties } from "react";
import DeerProfileForm from "@/components/deer/DeerProfileForm";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { updateDeerIntelStore } from "@/lib/deerIntelStore";
import type { DeerProfileFormValues } from "@/lib/deerProfileFormValues";
import {
  deerProfileFormValuesFromProfile,
  deerProfileStatus,
  deleteDeerProfile,
  mergeDeerProfiles,
  setDeerProfileStatus,
  updateDeerProfileFromValues,
} from "@/lib/deerProfiles";
import { formatDateInput } from "@/lib/huntFormValues";
import type { DeerProfile } from "@/types/deerProfile";

type Dialog = "status" | "merge" | "delete" | null;
type OffListStatus = "harvested" | "retired";

// Manage one buck from his hit-list card: edit his profile, take him off the
// list (harvested / retired) or put him back, fold a duplicate into another
// buck, or delete him. Every change is a pure transform in lib/deerProfiles.
export default function DeerProfileActions({
  profile,
  otherProfiles,
  onMerged,
}: {
  profile: DeerProfile;
  /** The property's other bucks, the choices for "Merge into…". */
  otherProfiles: DeerProfile[];
  /** After a merge, so the list can open the buck he was folded into. */
  onMerged?: (targetId: string) => void;
}) {
  const fieldId = useId();
  const [editValues, setEditValues] = useState<DeerProfileFormValues | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [offListStatus, setOffListStatus] = useState<OffListStatus>("harvested");
  const [statusDate, setStatusDate] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const name = profile.nickname.trim() || "this buck";
  const active = deerProfileStatus(profile) === "active";
  const mergeTarget =
    otherProfiles.find((item) => item.id === mergeTargetId) ?? otherProfiles[0];

  function close() {
    setDialog(null);
  }

  function saveEdit() {
    if (!editValues) return;
    updateDeerIntelStore((state) =>
      updateDeerProfileFromValues(state, profile.id, editValues),
    );
    setEditValues(null);
  }

  function openStatus() {
    setOffListStatus("harvested");
    setStatusDate(formatDateInput(new Date()));
    setDialog("status");
  }

  function saveStatus() {
    updateDeerIntelStore((state) =>
      setDeerProfileStatus(state, profile.id, offListStatus, statusDate),
    );
    close();
  }

  function reactivate() {
    updateDeerIntelStore((state) => setDeerProfileStatus(state, profile.id, "active"));
  }

  function openMerge() {
    setMergeTargetId(otherProfiles[0]?.id ?? "");
    setDialog("merge");
  }

  function saveMerge() {
    if (!mergeTarget) return;
    const targetId = mergeTarget.id;
    updateDeerIntelStore((state) => mergeDeerProfiles(state, profile.id, targetId));
    close();
    onMerged?.(targetId);
  }

  function saveDelete() {
    updateDeerIntelStore((state) => deleteDeerProfile(state, profile.id));
    close();
  }

  if (editValues) {
    return (
      <div style={editWrapStyle}>
        <p style={labelStyle}>Edit {name}</p>
        <DeerProfileForm
          values={editValues}
          onChange={setEditValues}
          onSubmit={saveEdit}
          onCancel={() => setEditValues(null)}
          submitLabel="Save changes"
          expanded
        />
      </div>
    );
  }

  return (
    <>
      <div style={rowStyle} role="group" aria-label={`Manage ${name}`}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setEditValues(deerProfileFormValuesFromProfile(profile))}
          style={actionStyle}
        >
          Edit
        </Button>
        {active ? (
          <Button type="button" variant="secondary" onClick={openStatus} style={actionStyle}>
            Harvested / retired
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={reactivate} style={actionStyle}>
            Back on hit list
          </Button>
        )}
        {otherProfiles.length > 0 ? (
          <Button type="button" variant="secondary" onClick={openMerge} style={actionStyle}>
            Merge into…
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDialog("delete")}
          style={{ ...actionStyle, color: "var(--danger-text)" }}
        >
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={dialog === "status"}
        title={`Take ${name} off the hit list?`}
        description="He moves to the Harvested group at the bottom and stops counting as an active buck. His photos and history stay."
        confirmLabel={offListStatus === "harvested" ? "Mark harvested" : "Mark retired"}
        onConfirm={saveStatus}
        onCancel={close}
      >
        <div style={fieldStackStyle}>
          <div style={choiceRowStyle} role="radiogroup" aria-label="Status">
            {(["harvested", "retired"] as const).map((status) => (
              <label key={status} style={choiceStyle}>
                <input
                  type="radio"
                  name={`${fieldId}-status`}
                  checked={offListStatus === status}
                  onChange={() => setOffListStatus(status)}
                />
                {status === "harvested" ? "Harvested" : "Retired (gone / no longer hunting him)"}
              </label>
            ))}
          </div>
          <label style={fieldStyle}>
            <span style={labelStyle}>Date</span>
            <input
              type="date"
              value={statusDate}
              onChange={(event) => setStatusDate(event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "merge"}
        title={`Merge ${name} into…`}
        description={`Every photo and sit tagged ${name} moves to the buck you pick, his notes are added to that buck's, and the ${name} profile is removed.`}
        confirmLabel={mergeTarget ? `Merge into ${mergeTarget.nickname}` : "Merge"}
        onConfirm={saveMerge}
        onCancel={close}
      >
        <label style={fieldStyle}>
          <span style={labelStyle}>Same buck as</span>
          <select
            value={mergeTarget?.id ?? ""}
            onChange={(event) => setMergeTargetId(event.target.value)}
            style={inputStyle}
          >
            {otherProfiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nickname}
                {deerProfileStatus(item) === "active" ? "" : ` (${deerProfileStatus(item)})`}
              </option>
            ))}
          </select>
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "delete"}
        title={`Delete ${name}?`}
        description="His profile is removed. His photos stay on their cameras and his sits stay in the log — they're just untagged."
        confirmLabel="Delete buck"
        confirmVariant="danger"
        onConfirm={saveDelete}
        onCancel={close}
      />
    </>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const actionStyle: CSSProperties = {
  minHeight: "38px",
  padding: "0.5rem 0.75rem",
  fontSize: "1rem",
};

const editWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
};

const fieldStackStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
};

const choiceRowStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
};

const choiceStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.55rem",
  color: "var(--text)",
  cursor: "pointer",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.72rem",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "46px",
  padding: "0.8rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
};
