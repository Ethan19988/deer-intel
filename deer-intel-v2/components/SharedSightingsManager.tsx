"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import Button from "@/components/ui/Button";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { getSeasonContext, useSeasonCalendar } from "@/lib/seasonCalendar";
import {
  buildSightingRows,
  contributeSightings,
  readSharingChoice,
  regionForPoint,
  writeSharingChoice,
  type SharingChoice,
} from "@/lib/sharedSightings";
import { getSupabaseClient } from "@/lib/supabaseClient";

export const SHARING_DISCLOSURE =
  "Share anonymous sighting times and weather from your trail-cam photos to improve deer movement predictions for hunters in your county. Your photos, notes, and locations never leave your device. You can turn this off anytime in Settings.";

// Asks each signed-in account once, right away, whether to share anonymous
// sightings, then quietly contributes new timed deer photos while it's on.
// Nothing is sent until the person chooses "Turn on".
export default function SharedSightingsManager() {
  const { user, configured } = useAuth();
  const state = useDeerIntelStore();
  const seasonPrefs = useSeasonCalendar();
  const [choice, setChoice] = useState<SharingChoice | null>(null);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChoice(null);
      return;
    }
    const sync = () => setChoice(readSharingChoice(user.id));
    sync();
    window.addEventListener("deer-intel:sharing-changed", sync);
    return () => window.removeEventListener("deer-intel:sharing-changed", sync);
  }, [user]);

  // Contribute whenever sharing is on and the photo set changes.
  const photoCount = state.photoRecords.length;
  useEffect(() => {
    const client = getSupabaseClient();
    if (!user || choice !== "on" || !client) return;
    let cancelled = false;

    (async () => {
      for (const property of state.properties) {
        if (cancelled) return;
        const point = resolvePropertyWeatherPoint(
          property,
          state.cameras.filter((camera) => camera.propertyId === property.id),
          state.pins.filter((pin) => pin.propertyId === property.id),
        );
        if (!point) continue;
        const region = await regionForPoint(point.lat, point.lng);
        const rows = buildSightingRows(
          state.photoRecords.filter((photo) => photo.propertyId === property.id),
          region,
          (date) => getSeasonContext(date, seasonPrefs, point.lat).phase,
        );
        if (rows.length) await contributeSightings(client, user.id, rows);
      }
    })().catch(() => {
      // Sharing is best-effort; it retries on the next change or visit.
    });

    return () => {
      cancelled = true;
    };
    // Re-run when photos are added, not on every unrelated state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, choice, photoCount, state.properties.length]);

  if (!configured || !user || choice !== "unasked") return null;

  return (
    <div role="dialog" aria-labelledby="share-title" style={backdropStyle}>
      <div style={sheetStyle}>
        <h2 id="share-title" style={titleStyle}>
          Help predict deer movement
        </h2>
        <p style={bodyStyle}>{SHARING_DISCLOSURE}</p>
        <div style={actionsStyle}>
          <Button type="button" variant="secondary" onClick={() => writeSharingChoice(user.id, "off")}>
            Not now
          </Button>
          <Button type="button" onClick={() => writeSharingChoice(user.id, "on")}>
            Turn on
          </Button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: "1rem",
  background: "rgba(8, 12, 8, 0.55)",
};

const sheetStyle: CSSProperties = {
  width: "100%",
  maxWidth: "460px",
  display: "grid",
  gap: "0.75rem",
  padding: "1.25rem",
  borderRadius: "20px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "var(--shadow-md)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.4rem",
  fontWeight: 800,
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.95rem",
  lineHeight: 1.5,
};

const actionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.5rem",
};
