"use client";

import { useEffect, useMemo, useState } from "react";
import { divIcon } from "leaflet";
import { Circle, Marker, useMapEvents } from "react-leaflet";

type LiveLocation = {
  lat: number;
  lng: number;
  accuracy: number;
};

// A pulsing "blue dot" that shows the hunter's live GPS position on the map,
// updated continuously via watchPosition — the same live-location dot you get
// in Google Maps. The translucent halo shows the reported accuracy radius.
//
// When `follow` is on, the map recenters on every position update so the dot
// stays put as the hunter walks. Panning the map by hand releases follow (via
// `onUserPan`) so looking around never fights the auto-recenter.
export default function UserLocationMarker({
  enabled,
  follow,
  onUserPan,
}: {
  enabled: boolean;
  follow: boolean;
  onUserPan: () => void;
}) {
  const [location, setLocation] = useState<LiveLocation | null>(null);
  // A hand-pan (mouse or touch drag) releases follow so the user can look
  // around freely; our own setView recenters don't fire dragstart, so they're
  // never mistaken for user input.
  const map = useMapEvents({
    dragstart() {
      if (enabled && follow) onUserPan();
    },
  });

  useEffect(() => {
    if (!enabled) {
      setLocation(null);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        // Keep the last known dot rather than flashing it off on a transient
        // error (a brief signal drop, a denied one-off read, etc.).
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  // Keep the dot centered as new positions arrive while following, holding the
  // current zoom so only the pan tracks the hunter.
  useEffect(() => {
    if (!enabled || !follow || !location) return;

    map.setView([location.lat, location.lng], map.getZoom());
  }, [enabled, follow, location, map]);

  const dotIcon = useMemo(
    () =>
      divIcon({
        className: "di-user-location-icon",
        html: '<span class="di-user-location-dot"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    [],
  );

  if (!enabled || !location) return null;

  return (
    <>
      <Circle
        center={[location.lat, location.lng]}
        radius={location.accuracy}
        pathOptions={{
          color: "#1a73e8",
          weight: 1,
          fillColor: "#1a73e8",
          fillOpacity: 0.12,
        }}
      />
      <Marker
        position={[location.lat, location.lng]}
        icon={dotIcon}
        interactive={false}
        keyboard={false}
        zIndexOffset={1000}
      />
    </>
  );
}
