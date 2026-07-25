"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveParty } from "@/components/party/PartyProvider";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { usePartyBucks } from "@/lib/useParty";
import { buildBuckSnapshot } from "@/lib/buckHitList";
import { deletePartyBuck, upsertPartyBuck } from "@/lib/partyClient";

// Headless: keeps the current user's shared hit list (party_bucks) in step with
// their local deer profiles while buck sharing is on, and clears it when off.
// Mounted once in the app layout so sharing works from any page, not only the
// Hit List screen. No-ops entirely unless signed in, in a party, and sharing.
export default function PartyBuckSync() {
  const { activeParty, buckSharingEnabled } = useActiveParty();
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
    if (!partyId || !userId) return;

    const mine = partyBucks.filter((b) => b.created_by === userId);

    if (!buckSharingEnabled) {
      for (const b of mine) {
        void deletePartyBuck(partyId, b.source_id).catch(() => {});
      }
      return;
    }

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

    const localIds = new Set(snapshots.map((s) => s.sourceId));
    for (const b of mine) {
      if (!localIds.has(b.source_id)) {
        void deletePartyBuck(partyId, b.source_id).catch(() => {});
      }
    }
  }, [partyId, userId, buckSharingEnabled, snapshots, partyBucks]);

  return null;
}
