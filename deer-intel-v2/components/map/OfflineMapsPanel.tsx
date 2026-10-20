"use client";

import type { CSSProperties } from "react";
import { formatOfflineSize, type OfflineMapPack } from "@/lib/offlineMaps";
import OfflineDownloadStatus, {
  type OfflineStatus,
} from "@/components/map/OfflineDownloadStatus";

export type { OfflineStatus };

type OfflineMapsPanelProps = {
  supported: boolean;
  layerLabel: string;
  packs: OfflineMapPack[];
  status: OfflineStatus;
  onSaveView: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
};

export default function OfflineMapsPanel({
  supported,
  layerLabel,
  packs,
  status,
  onSaveView,
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

      <button
        type="button"
        className="di-layer-action"
        style={{ ...actionButtonStyle, ...(isBusy ? disabledButtonStyle : null) }}
        disabled={isBusy}
        onClick={onSaveView}
      >
        Save this view
      </button>

      <p style={hintStyle}>
        To save your <strong>hunt area</strong>, use{" "}
        <strong>Save this area offline</strong> under the Hunt Area controls on
        the map.
      </p>

      <OfflineDownloadStatus
        status={status}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />

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
  color: "var(--text-muted)",
  fontSize: "0.86rem",
  lineHeight: 1.45,
};

const hintStyle: CSSProperties = {
  margin: 0,
  padding: "0.5rem 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text-muted)",
  fontSize: "0.82rem",
  lineHeight: 1.45,
};

const actionButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "0.5rem 0.6rem",
  border: "1px solid var(--accent-tint-border)",
  borderRadius: "8px",
  background: "var(--accent-tint)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: "0.88rem",
  fontWeight: 850,
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const packListStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const packListHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  color: "var(--text-muted)",
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
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
};

const packInfoStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
  minWidth: 0,
};

const packTitleStyle: CSSProperties = {
  margin: 0,
  overflow: "hidden",
  color: "var(--text)",
  fontSize: "0.86rem",
  fontWeight: 850,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const packMetaStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.78rem",
};

const deleteButtonStyle: CSSProperties = {
  flex: "0 0 auto",
  minHeight: "38px",
  padding: "0.4rem 0.7rem",
  border: "1px solid var(--danger-border)",
  borderRadius: "8px",
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 850,
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.82rem",
};

const unsupportedStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.84rem",
  lineHeight: 1.45,
};
