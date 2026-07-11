"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  clearAllOfflineTiles,
  deleteOfflinePack,
  formatOfflineSize,
  offlineMapsSupported,
  useOfflineMapPacks,
} from "@/lib/offlineMaps";

// Manage the map tiles saved for offline field use. Downloading happens on the
// map (it needs the current view/hunt area); this is the place to see how much
// space they take and clear them off the device.
export default function OfflineMapsManager() {
  const packs = useOfflineMapPacks();
  // Resolved after mount so the server and first client render agree (the
  // browser capability check needs `window`).
  const [supported, setSupported] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setSupported(offlineMapsSupported());
  }, []);

  const totalBytes = packs.reduce((sum, pack) => sum + pack.sizeBytes, 0);
  const totalTiles = packs.reduce((sum, pack) => sum + pack.tileCount, 0);

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteOfflinePack(id);
    } finally {
      setBusyId(null);
    }
  }

  async function handleClearAll() {
    setBusyId("__all__");
    try {
      await clearAllOfflineTiles();
    } finally {
      setBusyId(null);
      setConfirmClear(false);
    }
  }

  if (!supported) {
    return (
      <p style={mutedStyle}>
        This browser can&apos;t store offline maps. Open Deer Intel over HTTPS in
        a modern browser to save maps for the field.
      </p>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={summaryRowStyle}>
        <div>
          <p style={summaryValueStyle}>{formatOfflineSize(totalBytes)}</p>
          <p style={summaryLabelStyle}>
            {packs.length} saved {packs.length === 1 ? "map" : "maps"} ·{" "}
            {totalTiles.toLocaleString()} tiles on this device
          </p>
        </div>
        {packs.length > 0 ? (
          <Button
            type="button"
            variant="danger"
            onClick={() => setConfirmClear(true)}
            disabled={busyId !== null}
          >
            Clear All
          </Button>
        ) : null}
      </div>

      <p style={mutedStyle}>
        Downloaded map tiles let the map open with no signal in the field. Save a
        new area from the <Link href="/map" style={linkStyle}>Map</Link> using
        &ldquo;Save this view&rdquo; or the hunt-area controls.
      </p>

      {packs.length > 0 ? (
        <div style={listStyle}>
          {packs.map((pack) => {
            const busy = busyId === pack.id;

            return (
              <div key={pack.id} style={rowStyle}>
                <div style={infoStyle}>
                  <p style={titleStyle}>
                    {pack.propertyName} · {pack.targetLabel}
                  </p>
                  <p style={metaStyle}>
                    {pack.layerLabel} · {pack.tileCount.toLocaleString()} tiles ·{" "}
                    {formatOfflineSize(pack.sizeBytes)} · saved{" "}
                    {formatSavedDate(pack.createdAt)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => handleDelete(pack.id)}
                  disabled={busyId !== null}
                  aria-label={`Delete saved map for ${pack.propertyName} ${pack.targetLabel}`}
                >
                  {busy ? "Deleting…" : "Delete"}
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={emptyStyle}>No maps saved for offline use yet.</p>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear all offline maps?"
        description={`This deletes all ${packs.length} saved ${
          packs.length === 1 ? "map" : "maps"
        } (${formatOfflineSize(
          totalBytes,
        )}) from this device. Your properties, cameras, stands, and hunt log are not affected — only the downloaded map tiles. You can re-download areas from the Map anytime.`}
        confirmLabel="Clear All"
        confirmVariant="danger"
        onConfirm={handleClearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

function formatSavedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
};

const summaryRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "0.75rem",
};

const summaryValueStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.6rem",
  fontWeight: 900,
  lineHeight: 1.1,
};

const summaryLabelStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.55,
};

const linkStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontWeight: 800,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.65rem 0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface)",
};

const infoStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  overflow: "hidden",
  fontSize: "0.92rem",
  fontWeight: 850,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.8rem",
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.88rem",
};
