"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveParty } from "@/components/party/PartyProvider";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { usePartyBucks } from "@/lib/useParty";
import { buildBuckSnapshot } from "@/lib/buckHitList";
import { deleteAllMySharedRows, deletePartyBuck, upsertPartyBuck } from "@/lib/partyClient";
import { readShareApplied, shareAction, writeShareApplied } from "@/lib/partySharing";

// Headless: keeps the current user's shared hit list (party_bucks) in step with
// their local deer profiles while buck sharing is on, and withdraws it once
// when sharing is turned off. Mounted once in the app layout so sharing works
// from any page, not only the Hit List screen. No-ops entirely unless signed
// in, synced, in a party, and sharing (or just turned it off).
export default function PartyBuckSync() {
  const { activeParty, buckSharingEnabled, sharingReady } = useActiveParty();
  const { user } = useAuth();
  const state = useDeerIntelStore();
  const partyBucks = usePartyBucks(activeParty);

  const partyId = activeParty?.id ?? null;
  const userId = user?.id ?? null;

  const snapshots = useMemo(
    () => state.deerProfiles.map((profile) => buildBuckSnapshot(profile, state)),
    [state],
  );

  useEffect(() => {
    // Until cloud sync has settled, local data may be stale or another
    // account's: don't add or remove anything.
    if (!partyId || !userId || !sharingReady) return;

    const action = shareAction(
      buckSharingEnabled,
      readShareApplied("bucks", userId, partyId),
    );

    if (action === "idle") return;

    if (action === "withdraw") {
      // Turned off (on this device or another of this account's): withdraw
      // once. Steady "off" leaves the party's rows alone.
      void deleteAllMySharedRows("party_bucks", partyId)
        .then(() => writeShareApplied("bucks", userId, partyId, false))
        .catch(() => {});
      return;
    }

    writeShareApplied("bucks", userId, partyId, true);

    const mine = partyBucks.filter((b) => b.created_by === userId);
    const bySource = new Map(mine.map((b) => [b.source_id, b]));

    for (const snap of snapshots) {
      const shared = bySource.get(snap.sourceId);
      const changed =
        !shared ||
        shared.nickname !== snap.nickname ||
        shared.estimated_age !== snap.estimatedAge ||
        shared.status !== snap.status ||
        shared.property_name !== snap.propertyName ||
        shared.sighting_count !== snap.sightingCount ||
        shared.cameras !== snap.cameras ||
        shared.most_recent !== snap.mostRecent ||
        shared.common_time !== snap.commonTime ||
        shared.common_area !== snap.commonArea ||
        shared.notable !== snap.notable;

      if (changed) {
        void upsertPartyBuck(partyId, snap).catch(() => {});
      }
    }

    // Drop shared bucks whose local profile is gone (deleted on this account).
    const localIds = new Set(snapshots.map((s) => s.sourceId));
    for (const b of mine) {
      if (!localIds.has(b.source_id)) {
        void deletePartyBuck(partyId, b.source_id).catch(() => {});
      }
    }
  }, [partyId, userId, sharingReady, buckSharingEnabled, snapshots, partyBucks]);

  return null;
}
