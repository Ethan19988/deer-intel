"use client";

import type { CSSProperties } from "react";
import {
  formatOfflineSize,
  type OfflineDownloadProgress,
  type OfflineMapPack,
  type OfflinePackPlan,
} from "@/lib/offlineMaps";

export type OfflineStatus =
  | { phase: "idle"; message?: string }
  | { phase: "preview"; plan: OfflinePackPlan; targetLabel: string }
  | {
      phase: "downloading";
      progress: OfflineDownloadProgress;
      targetLabel: string;
    }
  | { phase: "done"; message: string }
  | { phase: "error"; message: string };

type OfflineMapsPanelProps = {
  supported: boolean;
  layerLabel: string;
  packs: OfflineMapPack[];
  canSaveHuntArea: boolean;
  status: OfflineStatus;
  onSaveView: () => void;
  onSaveHuntArea: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
};

export default function OfflineMapsPanel({
  supported,
  layerLabel,
  packs,
  canSaveHuntArea,
  status,
  onSaveView,
  onSaveHuntArea,
  onConfirm,
  onCancel,
  onDelete,
}: OfflineMapsPanelProps) {
  if (!supported) {
    return (
      <p style={unsupportedStyle}>
        This browser can&apos;t store offline maps. Open Deer Intel over HTTPS in
        a modern browser to save maps for the field.
      </p>
    );
  }

  const totalBytes = packs.reduce((sum, pack) => sum + pack.sizeBytes, 0);
  const isBusy = status.phase === "downloading";

  return (
    <div style={wrapStyle}>
      <p style={helpStyle}>
        Save the <strong>{layerLabel}</strong> map for a spot so it still loads
        with no signal in the field.
      </p>

      <div style={buttonRowStyle}>
        <button
          type="button"
          style={actionButtonStyle}
          disabled={isBusy}
          onClick={onSaveView}
        >
          Save this view
        </button>
        <button
          type="button"
          style={{
            ...actionButtonStyle,
            ...(canSaveHuntArea && !isBusy ? null : disabledButtonStyle),
          }}
          disabled={!canSaveHuntArea || isBusy}
          onClick={onSaveHuntArea}
        >
          Save hunt area
        </button>
      </div>

      {!canSaveHuntArea ? (
        <p style={hintStyle}>
          <strong>Save hunt area</strong> turns on once you&apos;ve drawn a hunt
          area for this property (use <strong>Hunt Area → Add Area Points</strong>
          in the map panel). Until then, use <strong>Save this view</strong> to
          save whatever&apos;s on screen.
        </p>
      ) : null}

      {status.phase === "preview" ? (
        <div style={noticeStyle}>
          <p style={noticeTitleStyle}>Save {status.targetLabel}?</p>
          <p style={noticeBodyStyle}>
            {status.plan.tileCount.toLocaleString()} tiles · about{" "}
            {formatOfflineSize(status.plan.estimatedBytes)} · zoom{" "}
            {status.plan.minZoom}–{status.plan.maxZoom}
            {status.plan.clamped
              ? " (trimmed to keep the download reasonable)"
              : ""}
          </p>
          <div style={noticeButtonRowStyle}>
            <button type="button" style={confirmButtonStyle} onClick={onConfirm}>
              Download
            </button>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {status.phase === "downloading" ? (
        <div style={noticeStyle}>
          <p style={noticeTitleStyle}>Saving {status.targetLabel}…</p>
          <div
            style={progressTrackStyle}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={status.progress.total}
            aria-valuenow={status.progress.completed}
          >
            <div
              style={{
                ...progressFillStyle,
                width: `${
                  status.progress.total > 0
                    ? Math.round(
                        (status.progress.completed / status.progress.total) *
                          100,
                      )
                    : 0
                }%`,
              }}
            />
          </div>
          <p style={noticeBodyStyle}>
            {status.progress.completed.toLocaleString()} /{" "}
            {status.progress.total.toLocaleString()} tiles ·{" "}
            {formatOfflineSize(status.progress.bytes)}
            {status.progress.failed > 0
              ? ` · ${status.progress.failed} skipped`
              : ""}
          </p>
          <div style={noticeButtonRowStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
              Stop
            </button>
          </div>
        </div>
      ) : null}

      {status.phase === "done" ? (
        <p style={doneMessageStyle}>{status.message}</p>
      ) : null}

      {status.phase === "error" ? (
        <p style={errorMessageStyle}>{status.message}</p>
      ) : null}

      {packs.length > 0 ? (
        <div style={packListStyle}>
          <div style={packListHeaderStyle}>
            <span>Saved maps</span>
            <span>{formatOfflineSize(totalBytes)}</span>
          </div>
          {packs.map((pack) => (
            <div key={pack.id} style={packRowStyle}>
              <div style={packInfoStyle}>
                <p style={packTitleStyle}>
                  {pack.propertyName} · {pack.targetLabel}
                </p>
                <p style={packMetaStyle}>
                  {pack.layerLabel} · {pack.tileCount.toLocaleString()} tiles ·{" "}
                  {formatOfflineSize(pack.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Delete saved map for ${pack.propertyName} ${pack.targetLabel}`}
                style={deleteButtonStyle}
                onClick={() => onDelete(pack.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={emptyStyle}>No maps saved for offline use yet.</p>
      )}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
};

const helpStyle: CSSProperties = {
  margin: 0,
  color: "#4c5a4c",
  fontSize: "0.86rem",
  lineHeight: 1.45,
};

const hintStyle: CSSProperties = {
  margin: 0,
  padding: "0.5rem 0.6rem",
  border: "1px solid rgba(17, 23, 17, 0.1)",
  borderRadius: "8px",
  background: "#f6f7f3",
  color: "#4c5a4c",
  fontSize: "0.82rem",
  lineHeight: 1.45,
};

const buttonRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.5rem",
};

const actionButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.5rem 0.6rem",
  border: "1px solid rgba(47, 109, 58, 0.4)",
  borderRadius: "8px",
  background: "#f0f7ee",
  color: "#17331b",
  cursor: "pointer",
  fontSize: "0.88rem",
  fontWeight: 850,
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const noticeStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
  padding: "0.65rem",
  border: "1px solid rgba(17, 23, 17, 0.12)",
  borderRadius: "8px",
  background: "white",
};

const noticeTitleStyle: CSSProperties = {
  margin: 0,
  color: "#172017",
  fontSize: "0.9rem",
  fontWeight: 900,
};

const noticeBodyStyle: CSSProperties = {
  margin: 0,
  color: "#4c5a4c",
  fontSize: "0.82rem",
  lineHeight: 1.4,
};

const noticeButtonRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
};

const confirmButtonStyle: CSSProperties = {
  minHeight: "42px",
  padding: "0.5rem 0.85rem",
  border: "1px solid #2f6d3a",
  borderRadius: "8px",
  background: "#2f6d3a",
  color: "white",
  cursor: "pointer",
  fontSize: "0.86rem",
  fontWeight: 850,
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: "42px",
  padding: "0.5rem 0.85rem",
  border: "1px solid rgba(17, 23, 17, 0.16)",
  borderRadius: "8px",
  background: "white",
  color: "#172017",
  cursor: "pointer",
  fontSize: "0.86rem",
  fontWeight: 850,
};

const progressTrackStyle: CSSProperties = {
  width: "100%",
  height: "8px",
  overflow: "hidden",
  borderRadius: "999px",
  background: "#dfe6da",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "#2f6d3a",
  transition: "width 140ms ease",
};

const doneMessageStyle: CSSProperties = {
  margin: 0,
  color: "#237a3d",
  fontSize: "0.84rem",
  fontWeight: 800,
};

const errorMessageStyle: CSSProperties = {
  margin: 0,
  color: "#b23127",
  fontSize: "0.84rem",
  fontWeight: 800,
};

const packListStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const packListHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  color: "#566157",
  fontSize: "0.76rem",
  fontWeight: 900,
  textTransform: "uppercase",
};

const packRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.6rem",
  padding: "0.5rem 0.55rem",
  border: "1px solid rgba(17, 23, 17, 0.1)",
  borderRadius: "8px",
  background: "white",
};

const packInfoStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
  minWidth: 0,
};

const packTitleStyle: CSSProperties = {
  margin: 0,
  overflow: "hidden",
  color: "#172017",
  fontSize: "0.86rem",
  fontWeight: 850,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const packMetaStyle: CSSProperties = {
  margin: 0,
  color: "#5f6653",
  fontSize: "0.78rem",
};

const deleteButtonStyle: CSSProperties = {
  flex: "0 0 auto",
  minHeight: "38px",
  padding: "0.4rem 0.7rem",
  border: "1px solid #f2c4bf",
  borderRadius: "8px",
  background: "#fce8e6",
  color: "#b23127",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 850,
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "#7c8478",
  fontSize: "0.82rem",
};

const unsupportedStyle: CSSProperties = {
  margin: 0,
  color: "#7c8478",
  fontSize: "0.84rem",
  lineHeight: 1.45,
};
