"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  heading,
  onUserPan,
}: {
  enabled: boolean;
  follow: boolean;
  // Live device heading (degrees, 0 = N) while the compass is on, or null. When
  // set, a translucent blue cone fans out from the dot in the facing direction.
  heading: number | null;
  onUserPan: () => void;
}) {
  const [location, setLocation] = useState<LiveLocation | null>(null);
  // While a zoom gesture is running, hold off on recentering. On iOS Safari a
  // pinch doesn't commit its new zoom until it ends, so a GPS fix that lands
  // mid-pinch would call setView with the *old* zoom and cancel the pinch — the
  // map "resets" the instant you try to zoom in while following your location.
  // We recenter again on zoomend so following stays tight once the zoom lands.
  const isZoomingRef = useRef(false);
  // Newest fix, read by the zoomend handler without re-subscribing the events.
  const latestLocationRef = useRef<LiveLocation | null>(null);
  useEffect(() => {
    latestLocationRef.current = location;
  }, [location]);
  // A hand-pan (mouse or touch drag) releases follow so the user can look
  // around freely; our own setView recenters don't fire dragstart, so they're
  // never mistaken for user input.
  const map = useMapEvents({
    dragstart() {
      if (enabled && follow) onUserPan();
    },
    zoomstart() {
      isZoomingRef.current = true;
    },
    zoomend() {
      isZoomingRef.current = false;
      // Snap back onto the hunter now the zoom has committed, using the newest
      // fix — the one we skipped mid-pinch would otherwise leave the dot off
      // center until the next fix arrives.
      const latest = latestLocationRef.current;
      if (enabled && follow && latest) {
        map.setView([latest.lat, latest.lng], map.getZoom());
      }
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
    // Mid-zoom, hold position — recentering now would fight the gesture (and on
    // iOS reset the zoom). zoomend recenters onto the latest fix once it lands.
    if (isZoomingRef.current) return;

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

  // The facing cone is its own marker so re-rotating it (as the heading updates)
  // never recreates the dot and restarts its pulse animation.
  const beamIcon = useMemo(
    () =>
      heading === null
        ? null
        : divIcon({
            className: "di-user-location-beam-icon",
            html: `<span class="di-user-location-beam" style="transform: rotate(${heading}deg)"></span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
    [heading],
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
      {beamIcon ? (
        <Marker
          position={[location.lat, location.lng]}
          icon={beamIcon}
          interactive={false}
          keyboard={false}
          zIndexOffset={900}
        />
      ) : null}
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
