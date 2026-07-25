"use client";

import { useEffect, useMemo } from "react";
import { divIcon } from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveParty } from "@/components/party/PartyProvider";
import { usePartyPins, usePartyRoster } from "@/lib/useParty";
import { deletePartyPin, upsertPartyPin } from "@/lib/partyClient";
import { pinMarkerSvg, type GlyphKey } from "@/lib/mapPinIcon";
import { pinToMapAsset } from "@/lib/propertyMap";
import type { MapAsset } from "@/lib/propertyMap";
import type { MapPin, PinType } from "@/types/mapPin";
import type { PartyPin } from "@/types/party";

// The "other" bucket covers sightings/vegetation, so pick a truer glyph there
// (mirrors PropertyMapAssetMarker so shared pins look like normal pins).
function glyphKeyForAsset(asset: MapAsset): GlyphKey {
  if (asset.layerId !== "other") return asset.layerId;
  const type = (asset.typeLabel ?? "").toLowerCase();
  if (/buck|doe|deer|sighting/.test(type)) return "deer";
  if (/veg/.test(type)) return "food";
  return "other";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function partyPinToAsset(pin: PartyPin): MapAsset {
  return pinToMapAsset({
    id: pin.source_id,
    propertyId: "",
    type: pin.type as PinType,
    lat: pin.lat,
    lng: pin.lng,
    createdAt: pin.created_at,
    name: pin.name,
    notes: pin.notes,
  });
}

/**
 * Shared map pins for the active party. Renders every *other* member's shared
 * pins live on the map, and — while "share my pins" is on — keeps the current
 * user's shared pins in sync with their local pins (`allPins`). Mount inside the
 * Leaflet MapContainer alongside the other party layers.
 */
export default function PartyPinsLayer({ allPins }: { allPins: MapPin[] }) {
  const { activeParty, pinSharingEnabled } = useActiveParty();
  const { user } = useAuth();
  const partyPins = usePartyPins(activeParty);
  const { nameById } = usePartyRoster(activeParty);

  const userId = user?.id ?? null;
  const partyId = activeParty?.id ?? null;

  const myShared = useMemo(
    () => (userId ? partyPins.filter((p) => p.created_by === userId) : []),
    [partyPins, userId],
  );
  const otherPins = useMemo(
    () => partyPins.filter((p) => p.created_by !== userId),
    [partyPins, userId],
  );

  // Keep my shared pins in step with my local pins while sharing is on; clear
  // them all when it's off. Upserts are idempotent, so the realtime echo of our
  // own writes settles without looping.
  useEffect(() => {
    if (!partyId || !userId) return;

    if (!pinSharingEnabled) {
      for (const sp of myShared) {
        void deletePartyPin(partyId, sp.source_id).catch(() => {});
      }
      return;
    }

    const sharedBySource = new Map(myShared.map((p) => [p.source_id, p]));

    for (const pin of allPins) {
      const shared = sharedBySource.get(pin.id);
      const name = pin.name ?? "";
      const notes = pin.notes ?? "";
      const changed =
        !shared ||
        shared.type !== pin.type ||
        shared.lat !== pin.lat ||
        shared.lng !== pin.lng ||
        shared.name !== name ||
        shared.notes !== notes;

      if (changed) {
        void upsertPartyPin(partyId, {
          sourceId: pin.id,
          type: pin.type,
          lat: pin.lat,
          lng: pin.lng,
          name,
          notes,
        }).catch(() => {});
      }
    }

    // Drop shared pins whose local original is gone.
    const localIds = new Set(allPins.map((p) => p.id));
    for (const sp of myShared) {
      if (!localIds.has(sp.source_id)) {
        void deletePartyPin(partyId, sp.source_id).catch(() => {});
      }
    }
  }, [partyId, userId, pinSharingEnabled, allPins, myShared]);

  const markers = useMemo(
    () =>
      otherPins.map((pin) => {
        const asset = partyPinToAsset(pin);
        const svg = pinMarkerSvg({
          color: asset.color,
          background: asset.background,
          glyphKey: glyphKeyForAsset(asset),
          width: 28,
        });
        const sharer = nameById.get(pin.created_by) ?? "A hunter";
        const icon = divIcon({
          className: "di-party-pin-icon",
          html:
            `<span class="di-party-pin-tag">${escapeHtml(sharer)}</span>` + svg,
          iconSize: [28, 40],
          iconAnchor: [14, 40],
          popupAnchor: [0, -38],
        });
        return { pin, asset, icon, sharer };
      }),
    [otherPins, nameById],
  );

  if (!activeParty) return null;

  return (
    <>
      {markers.map(({ pin, asset, icon, sharer }) => (
        <Marker key={pin.source_id} position={[pin.lat, pin.lng]} icon={icon}>
          <Popup>
            <strong>{asset.label}</strong>
            <br />
            {pin.type}
            <br />
            <span style={{ color: "#555" }}>Shared by {sharer}</span>
            {pin.notes ? (
              <>
                <br />
                {pin.notes}
              </>
            ) : null}
          </Popup>
        </Marker>
      ))}
    </>
  );
}
