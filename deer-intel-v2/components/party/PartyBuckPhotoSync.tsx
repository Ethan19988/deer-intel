"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveParty } from "@/components/party/PartyProvider";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { getPhotoDeerProfileIds } from "@/lib/photos";
import { usePartyBuckPhotos } from "@/lib/useParty";
import {
  deleteAllMySharedRows,
  deletePartyBuckPhoto,
  updatePartyBuckPhotoCaption,
  upsertPartyBuckPhoto,
} from "@/lib/partyClient";
import {
  buckPhotoCaption,
  readShareApplied,
  shareAction,
  writeShareApplied,
} from "@/lib/partySharing";
import { getPhotoImage } from "@/lib/imageStore";
import { imageBlobToThumbnailDataUrl } from "@/lib/imageProcessing";

// At most this many photos are shared per buck — the crew wants a look at the
// deer, not the member's whole roll.
const MAX_PHOTOS_PER_BUCK = 4;

type PhotoTarget = {
  photoId: string;
  sourceId: string;
  imageId: string;
  photoDate: string;
  caption: string;
};

// Headless: while buck sharing is on, publishes small thumbnails of each shared
// buck's linked photos so other members can see them. Generates a thumbnail from
// the local image only for photos not already shared (dedup), and prunes ones
// whose local original is gone or that fell out of the per-buck cap. Withdraws
// them all once when sharing is turned off. Mounted in the layout beside
// PartyBuckSync.
export default function PartyBuckPhotoSync() {
  const { activeParty, buckSharingEnabled, sharingReady } = useActiveParty();
  const { user } = useAuth();
  const state = useDeerIntelStore();
  // Keys only — we never need every peer's data URL just to dedup our own.
  const sharedPhotos = usePartyBuckPhotos(activeParty, false);

  const partyId = activeParty?.id ?? null;
  const userId = user?.id ?? null;

  // Photos currently being turned into thumbnails, so overlapping effect runs
  // don't generate/upload the same one twice.
  const inFlight = useRef<Set<string>>(new Set());

  // The set of local photos that should be shared: up to N most-recent linked,
  // image-backed photos per tracked buck.
  const targets = useMemo<PhotoTarget[]>(() => {
    const nicknameById = new Map(
      state.deerProfiles.map((profile) => [profile.id, profile.nickname]),
    );
    const byProfile = new Map<string, PhotoTarget[]>();

    for (const photo of state.photoRecords) {
      // Sharing is keyed by photo id (one share per photo), so a multi-buck
      // photo is shared under its primary (first) linked buck.
      const primaryProfileId = getPhotoDeerProfileIds(photo)[0];
      if (!primaryProfileId || !photo.imageId) continue;
      const list = byProfile.get(primaryProfileId) ?? [];
      list.push({
        photoId: photo.id,
        sourceId: primaryProfileId,
        imageId: photo.imageId,
        photoDate: photo.photoDate,
        caption: buckPhotoCaption(nicknameById.get(primaryProfileId) ?? "", photo.photoDate),
      });
      byProfile.set(primaryProfileId, list);
    }

    const result: PhotoTarget[] = [];
    for (const list of byProfile.values()) {
      list.sort((a, b) => b.photoDate.localeCompare(a.photoDate));
      result.push(...list.slice(0, MAX_PHOTOS_PER_BUCK));
    }
    return result;
  }, [state.photoRecords, state.deerProfiles]);

  useEffect(() => {
    // Until cloud sync has settled, local data may be stale or another
    // account's: don't add or remove anything.
    if (!partyId || !userId || !sharingReady) return;

    const action = shareAction(
      buckSharingEnabled,
      readShareApplied("buckPhotos", userId, partyId),
    );

    if (action === "idle") return;

    if (action === "withdraw") {
      void deleteAllMySharedRows("party_buck_photos", partyId)
        .then(() => writeShareApplied("buckPhotos", userId, partyId, false))
        .catch(() => {});
      return;
    }

    writeShareApplied("buckPhotos", userId, partyId, true);

    const mine = sharedPhotos.filter((p) => p.created_by === userId);
    const sharedById = new Map(mine.map((p) => [p.photo_id, p]));

    // Share any target we haven't shared yet (and aren't mid-generating).
    for (const target of targets) {
      const shared = sharedById.get(target.photoId);
      if (shared) {
        // Older builds captioned with the file name or notes: replace it.
        if (shared.caption !== target.caption && !inFlight.current.has(target.photoId)) {
          void updatePartyBuckPhotoCaption(partyId, target.photoId, target.caption).catch(
            () => {},
          );
        }
        continue;
      }
      if (inFlight.current.has(target.photoId)) continue;

      inFlight.current.add(target.photoId);
      void (async () => {
        try {
          const blob = await getPhotoImage(target.imageId);
          const dataUrl = blob ? await imageBlobToThumbnailDataUrl(blob) : null;
          if (dataUrl) {
            await upsertPartyBuckPhoto(partyId, {
              photoId: target.photoId,
              sourceId: target.sourceId,
              dataUrl,
              photoDate: target.photoDate,
              caption: target.caption,
            });
          }
        } catch {
          // Best-effort; a failed thumbnail just isn't shared.
        } finally {
          inFlight.current.delete(target.photoId);
        }
      })();
    }

    // Prune shares whose local original is gone or fell out of the cap.
    const targetIds = new Set(targets.map((t) => t.photoId));
    for (const p of mine) {
      if (!targetIds.has(p.photo_id)) {
        void deletePartyBuckPhoto(partyId, p.photo_id).catch(() => {});
      }
    }
  }, [partyId, userId, sharingReady, buckSharingEnabled, targets, sharedPhotos]);

  return null;
}
