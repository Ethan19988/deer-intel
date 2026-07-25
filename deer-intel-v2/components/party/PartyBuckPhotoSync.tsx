"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveParty } from "@/components/party/PartyProvider";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { usePartyBuckPhotos } from "@/lib/useParty";
import { deletePartyBuckPhoto, upsertPartyBuckPhoto } from "@/lib/partyClient";
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
// whose local original is gone or that fell out of the per-buck cap. Mounted in
// the layout beside PartyBuckSync.
export default function PartyBuckPhotoSync() {
  const { activeParty, buckSharingEnabled } = useActiveParty();
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
    const byProfile = new Map<string, PhotoTarget[]>();

    for (const photo of state.photoRecords) {
      if (!photo.deerProfileId || !photo.imageId) continue;
      const list = byProfile.get(photo.deerProfileId) ?? [];
      list.push({
        photoId: photo.id,
        sourceId: photo.deerProfileId,
        imageId: photo.imageId,
        photoDate: photo.photoDate,
        caption: photo.fileName || photo.notes || "",
      });
      byProfile.set(photo.deerProfileId, list);
    }

    const result: PhotoTarget[] = [];
    for (const list of byProfile.values()) {
      list.sort((a, b) => b.photoDate.localeCompare(a.photoDate));
      result.push(...list.slice(0, MAX_PHOTOS_PER_BUCK));
    }
    return result;
  }, [state.photoRecords]);

  useEffect(() => {
    if (!partyId || !userId) return;

    const mine = sharedPhotos.filter((p) => p.created_by === userId);

    if (!buckSharingEnabled) {
      for (const p of mine) {
        void deletePartyBuckPhoto(partyId, p.photo_id).catch(() => {});
      }
      return;
    }

    const alreadyShared = new Set(mine.map((p) => p.photo_id));

    // Share any target we haven't shared yet (and aren't mid-generating).
    for (const target of targets) {
      if (alreadyShared.has(target.photoId)) continue;
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
  }, [partyId, userId, buckSharingEnabled, targets, sharedPhotos]);

  return null;
}
