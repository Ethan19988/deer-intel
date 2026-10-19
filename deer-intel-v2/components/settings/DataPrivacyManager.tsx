"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SHARING_DISCLOSURE } from "@/components/SharedSightingsManager";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  readSharingChoice,
  withdrawSightings,
  writeSharingChoice,
  type SharingChoice,
} from "@/lib/sharedSightings";
import { getSupabaseClient } from "@/lib/supabaseClient";

// localStorage keys that hold the hunter's saved records. Kept in sync with
// lib/deerIntelStore (state + legacy properties) and lib/cloudSync (sync meta).
// Cleared schema-agnostically (remove + reload) so this never has to construct a
// state object as the store's shape evolves.
const RECORD_STORAGE_KEYS = [
  "deer-intel:state",
  "deer-intel:properties",
  "deer-intel:sync-meta",
];

type DataPrivacyManagerProps = {
  recordCount: number;
  cloudActive: boolean;
};

export default function DataPrivacyManager({
  recordCount,
  cloudActive,
}: DataPrivacyManagerProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const { user } = useAuth();
  const [sharing, setSharing] = useState<SharingChoice>("unasked");

  useEffect(() => {
    if (!user) return;
    const sync = () => setSharing(readSharingChoice(user.id));
    sync();
    window.addEventListener("deer-intel:sharing-changed", sync);
    return () => window.removeEventListener("deer-intel:sharing-changed", sync);
  }, [user]);

  async function setSharingOn(on: boolean) {
    if (!user) return;
    writeSharingChoice(user.id, on ? "on" : "off");
    // Turning it off also removes everything this account already shared.
    const client = getSupabaseClient();
    if (!on && client) await withdrawSightings(client, user.id).catch(() => undefined);
  }

  function handleClearAll() {
    try {
      for (const key of RECORD_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage failures; the reload below still lands on whatever the
      // store can read back.
    }
    // Full reload to a fresh, empty store rather than reconstructing state here.
    window.location.href = "/";
  }

  return (
    <div style={wrapStyle}>
      <div>
        <p style={headingStyle}>Where your data lives</p>
        <ul style={listStyle}>
          <li>
            Everything you save (properties, cameras, stands, hunts, deer, map
            pins, photos) is stored <strong>on this device</strong>, in this
            browser.
          </li>
          <li>
            {cloudActive
              ? "You're signed in, so your data is also backed up to your private cloud account and synced across your devices."
              : "No account or cloud sync is connected, so nothing leaves this device unless you export a backup."}
          </li>
          <li>
            Deer Intel runs <strong>no ads, analytics, or tracking</strong>.
          </li>
        </ul>
      </div>

      {user ? (
        <div>
          <p style={headingStyle}>Shared movement learning</p>
          <p style={sharingTextStyle}>{SHARING_DISCLOSURE}</p>
          <label style={toggleRowStyle}>
            <input
              type="checkbox"
              checked={sharing === "on"}
              onChange={(event) => void setSharingOn(event.target.checked)}
              style={checkboxStyle}
            />
            <span>Share anonymous sightings</span>
          </label>
          <p style={sharingNoteStyle}>
            Turning this off deletes what this account already shared.
          </p>
        </div>
      ) : null}

      <div>
        <p style={headingStyle}>What gets sent to third parties</p>
        <ul style={listStyle}>
          <li>
            <strong>Live weather:</strong> a property&apos;s coordinates go to
            Open-Meteo to fetch the forecast.
          </li>
          <li>
            <strong>Address search:</strong> what you type goes to OpenStreetMap
            (Nominatim) to find a place.
          </li>
          <li>
            <strong>Map tiles:</strong> the map view is requested from Esri,
            USGS, and OpenStreetMap tile servers.
          </li>
          <li>
            <strong>AI Scout:</strong> only if enabled, property context is sent
            to Anthropic to generate recommendations.
          </li>
        </ul>
      </div>

      <div style={dangerZoneStyle}>
        <p style={dangerHeadingStyle}>Danger zone</p>
        <p style={mutedStyle}>
          Permanently delete the {recordCount.toLocaleString()}{" "}
          {recordCount === 1 ? "record" : "records"} saved in this browser.
          Export a backup first if you might want this data again — this
          can&apos;t be undone.
          {cloudActive
            ? " You're signed in to cloud sync, so your cloud backup will download again on reload. Sign out first to keep this device empty."
            : ""}
        </p>
        <div style={actionsStyle}>
          <Button
            type="button"
            variant="danger"
            onClick={() => setConfirmClear(true)}
          >
            Clear All Local Data
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Delete all local data?"
        description={`This permanently deletes the ${recordCount.toLocaleString()} ${
          recordCount === 1 ? "record" : "records"
        } saved in this browser (properties, cameras, stands, hunts, deer, pins, and photos).${
          cloudActive
            ? " You're signed in to cloud sync, so this data will re-download from your cloud backup on reload — sign out first if you want this device to stay empty."
            : " This can't be undone unless you have a backup."
        } Offline map tiles and your app preferences are not affected.`}
        confirmLabel="Delete Everything"
        confirmVariant="danger"
        onConfirm={handleClearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

const sharingTextStyle: CSSProperties = {
  margin: "0 0 0.6rem",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const toggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  minHeight: "44px",
  fontWeight: 700,
  cursor: "pointer",
};

const checkboxStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  minHeight: "22px",
  accentColor: "var(--accent)",
};

const sharingNoteStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  color: "var(--text-faint)",
  fontSize: "0.85rem",
};

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "1.25rem",
};

const headingStyle: CSSProperties = {
  margin: "0 0 0.4rem",
  fontSize: "0.95rem",
  fontWeight: 850,
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: "1.1rem",
  display: "grid",
  gap: "0.35rem",
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.5,
};

const dangerZoneStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  padding: "0.9rem 1rem",
  border: "1px solid var(--danger-border)",
  borderRadius: "12px",
  background: "var(--danger-bg)",
};

const dangerHeadingStyle: CSSProperties = {
  margin: 0,
  color: "var(--danger-text)",
  fontSize: "0.78rem",
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.55,
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.6rem",
};
