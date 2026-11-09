"use client";

import { useEffect, useMemo } from "react";
import { divIcon } from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveParty } from "@/components/party/PartyProvider";
import { usePartyPins, usePartyRoster } from "@/lib/useParty";
import { deleteAllMySharedRows, deletePartyPin, upsertPartyPin } from "@/lib/partyClient";
import { clampPartyText, PARTY_TEXT_LIMITS } from "@/lib/partyLimits";
import {
  isKnownPinType,
  pinsToShare,
  readShareApplied,
  shareAction,
  writeShareApplied,
} from "@/lib/partySharing";
import { pinMarkerSvg, type GlyphKey } from "@/lib/mapPinIcon";
import { pinToMapAsset } from "@/lib/propertyMap";
import type { MapAsset } from "@/lib/propertyMap";
import type { MapPin } from "@/types/mapPin";
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

// Only rows of a known type reach here (see otherPins).
function partyPinToAsset(pin: PartyPin & { type: MapPin["type"] }): MapAsset {
  return pinToMapAsset({
    id: pin.source_id,
    propertyId: "",
    type: pin.type,
    lat: pin.lat,
    lng: pin.lng,
    createdAt: pin.created_at,
    name: pin.name ?? "",
    notes: pin.notes ?? "",
  });
}

/**
 * Shared map pins for the active party. Renders every *other* member's shared
 * pins live on the map, and — while "share my pins" is on — keeps the current
 * user's shared pins in sync with the shared property's local pins (from
 * `allPins`; notes are never shared). Mount inside the Leaflet MapContainer
 * alongside the other party layers.
 */
export default function PartyPinsLayer({ allPins }: { allPins: MapPin[] }) {
  const { activeParty, pinSharingEnabled, pinSharePropertyId, sharingReady } =
    useActiveParty();
  const { user } = useAuth();
  const partyPins = usePartyPins(activeParty);
  const { nameById } = usePartyRoster(activeParty);

  const userId = user?.id ?? null;
  const partyId = activeParty?.id ?? null;

  const myShared = useMemo(
    () => (userId ? partyPins.filter((p) => p.created_by === userId) : []),
    [partyPins, userId],
  );
  // Rows with a type this build doesn't know (a newer build, or a bad write)
  // are skipped rather than crashing the map.
  const otherPins = useMemo(
    () =>
      partyPins.filter(
        (p): p is PartyPin & { type: MapPin["type"] } =>
          p.created_by !== userId &&
          isKnownPinType(p.type) &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng),
      ),
    [partyPins, userId],
  );

  // One property's pins (the account's chosen shared property), never notes.
  const sharedPins = useMemo(
    () => pinsToShare(allPins, pinSharePropertyId),
    [allPins, pinSharePropertyId],
  );

  // Keep my shared pins in step with the shared property's local pins while
  // sharing is on; withdraw them once when it's turned off. Steady "off" on
  // this device leaves the rows alone (another of this account's devices may
  // be sharing). Upserts are idempotent, so the realtime echo of our own
  // writes settles without looping.
  useEffect(() => {
    // Until cloud sync has settled, local data may be stale or another
    // account's: don't add or remove anything.
    if (!partyId || !userId || !sharingReady) return;

    const action = shareAction(pinSharingEnabled, readShareApplied("pins", userId, partyId));

    if (action === "idle") return;

    if (action === "withdraw") {
      void deleteAllMySharedRows("party_pins", partyId)
        .then(() => writeShareApplied("pins", userId, partyId, false))
        .catch(() => {});
      return;
    }

    writeShareApplied("pins", userId, partyId, true);

    const sharedBySource = new Map(myShared.map((p) => [p.source_id, p]));

    for (const pin of sharedPins) {
      const shared = sharedBySource.get(pin.id);
      const name = clampPartyText(pin.name, PARTY_TEXT_LIMITS.pinName);
      const changed =
        !shared ||
        shared.type !== pin.type ||
        shared.lat !== pin.lat ||
        shared.lng !== pin.lng ||
        shared.name !== name ||
        // Older builds shared notes; clear them.
        (shared.notes ?? "") !== "";

      if (changed) {
        void upsertPartyPin(partyId, {
          sourceId: pin.id,
          type: pin.type,
          lat: pin.lat,
          lng: pin.lng,
          name,
          notes: "",
        }).catch(() => {});
      }
    }

    // Drop shared pins that are no longer part of the share: deleted locally,
    // or on another property than the shared one.
    const sharedIds = new Set(sharedPins.map((p) => p.id));
    for (const sp of myShared) {
      if (!sharedIds.has(sp.source_id)) {
        void deletePartyPin(partyId, sp.source_id).catch(() => {});
      }
    }
  }, [partyId, userId, sharingReady, pinSharingEnabled, sharedPins, myShared]);

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
