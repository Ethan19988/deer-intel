"use client";

import type { CSSProperties } from "react";
import {
  formatOfflineSize,
  type OfflineDownloadProgress,
  type OfflinePackPlan,
} from "@/lib/offlineMaps";

// The offline-download flow's confirm/progress/result notice. Shared so it can
// render both inside the Layers panel and inline next to the Hunt Area controls
// — wherever the save was started.
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

type OfflineDownloadStatusProps = {
  status: OfflineStatus;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function OfflineDownloadStatus({
  status,
  onConfirm,
  onCancel,
}: OfflineDownloadStatusProps) {
  if (status.phase === "preview") {
    return (
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
          <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (status.phase === "downloading") {
    const percent =
      status.progress.total > 0
        ? Math.round(
            (status.progress.completed / status.progress.total) * 100,
          )
        : 0;

    return (
      <div style={noticeStyle}>
        <p style={noticeTitleStyle}>Saving {status.targetLabel}…</p>
        <div
          style={progressTrackStyle}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={status.progress.total}
          aria-valuenow={status.progress.completed}
        >
          <div style={{ ...progressFillStyle, width: `${percent}%` }} />
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
    );
  }

  if (status.phase === "done") {
    return <p style={doneMessageStyle}>{status.message}</p>;
  }

  if (status.phase === "error") {
    return <p style={errorMessageStyle}>{status.message}</p>;
  }

  return null;
}

const noticeStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
  padding: "0.65rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
};

const noticeTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "0.9rem",
  fontWeight: 900,
};

const noticeBodyStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
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
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "var(--accent-fg)",
  cursor: "pointer",
  fontSize: "0.86rem",
  fontWeight: 850,
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: "42px",
  padding: "0.5rem 0.85rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: "0.86rem",
  fontWeight: 850,
};

const progressTrackStyle: CSSProperties = {
  width: "100%",
  height: "8px",
  overflow: "hidden",
  borderRadius: "999px",
  background: "var(--surface-3)",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "var(--accent)",
  transition: "width 140ms ease",
};

const doneMessageStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.84rem",
  fontWeight: 800,
};

const errorMessageStyle: CSSProperties = {
  margin: 0,
  color: "var(--danger-text)",
  fontSize: "0.84rem",
  fontWeight: 800,
};
