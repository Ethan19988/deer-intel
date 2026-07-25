"use client";

import { useMemo } from "react";
import { divIcon } from "leaflet";
import { Marker } from "react-leaflet";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveParty } from "@/components/party/PartyProvider";
import {
  usePartyLocationSharing,
  usePartyLocations,
  usePartyRoster,
} from "@/lib/useParty";
import type { GeofenceArea } from "@/lib/geofence";

// A steady, distinct palette for party members' dots so each person keeps the
// same colour across a session. The hunter's own dot stays the familiar blue
// (UserLocationMarker); these are everyone else in the party.
const MEMBER_COLORS = [
  "#e8590c", // blaze orange
  "#2f9e44", // green
  "#9c36b5", // purple
  "#1971c2", // steel blue
  "#e03131", // red
  "#f08c00", // amber
  "#0c8599", // teal
];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the party's live "blue dots" on the map and, when sharing is on,
 * publishes the current hunter's own dot whenever they're inside a shared hunt
 * area. Mount this inside the Leaflet MapContainer, alongside UserLocationMarker.
 *
 * `areas` are the geofences (the active property's drawn hunt-area polygons) and
 * `heading` is the live device heading passed through to the published dot.
 */
export default function PartyMembersLayer({
  areas,
  heading,
}: {
  areas: GeofenceArea[];
  heading: number | null;
}) {
  const { activeParty, sharingEnabled } = useActiveParty();
  const { user } = useAuth();

  // Publish my own dot while inside the geofence (no-op unless sharing is on).
  usePartyLocationSharing({
    party: activeParty,
    areas,
    enabled: sharingEnabled,
    heading,
  });

  // Everyone else's live dots + a name lookup.
  const locations = usePartyLocations(activeParty, user?.id ?? null);
  const { nameById } = usePartyRoster(activeParty);

  const markers = useMemo(
    () =>
      locations.map((loc) => {
        const color = colorFor(loc.user_id);
        const name = nameById.get(loc.user_id) ?? "Hunter";
        const icon = divIcon({
          className: "di-party-member-icon",
          html:
            `<span class="di-party-member-dot" style="background:${color}"></span>` +
            `<span class="di-party-member-label">${escapeHtml(name)}</span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        return { loc, icon };
      }),
    [locations, nameById],
  );

  if (!activeParty) return null;

  return (
    <>
      {markers.map(({ loc, icon }) => (
        <Marker
          key={loc.user_id}
          position={[loc.lat, loc.lng]}
          icon={icon}
          interactive={false}
          keyboard={false}
          zIndexOffset={800}
        />
      ))}
    </>
  );
}
