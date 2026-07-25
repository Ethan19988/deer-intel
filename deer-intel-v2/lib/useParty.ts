"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  clearMyLocation,
  fetchLocations,
  listMembers,
  listPartyBucks,
  listPartyBuckPhotos,
  listPartyPins,
  subscribeToLocations,
  subscribeToPartyBucks,
  subscribeToPartyBuckPhotos,
  subscribeToPartyPins,
  upsertMyLocation,
} from "@/lib/partyClient";
import { findContainingArea, type GeofenceArea } from "@/lib/geofence";
import type {
  MemberLocation,
  Party,
  PartyBuck,
  PartyBuckPhoto,
  PartyMember,
  PartyPin,
} from "@/types/party";

// While inside the geofence we refresh the live dot on this cadence (a moving
// hunter still updates often enough to be useful without hammering the DB).
const UPSERT_INTERVAL_MS = 12_000;

// A dot is considered gone if it hasn't refreshed within this window — covers
// the case where someone's phone/app dies in the field without cleanly clearing
// their row (e.g. iOS suspending a backgrounded PWA). See the note in the Party
// UI: reliable enter/exit needs the app open, so treat a missing/stale dot as
// "unknown", never as a guarantee of safety.
const STALE_MS = 90_000;

type SharingState = {
  // The app is actively watching GPS for this party.
  active: boolean;
  // The user is currently standing inside a shared hunt area.
  inArea: boolean;
  // Which saved area they're in, for display.
  areaName: string | null;
};

/**
 * Geofenced live-location sharing for one party. While `enabled` and signed in,
 * this watches GPS and, whenever the hunter is inside one of `areas` (their
 * saved hunt-area polygons), publishes their dot to the party — refreshing it on
 * a fixed cadence and clearing it the moment they step outside the area, stop
 * sharing, or leave the screen.
 *
 * Foreground only: browsers can't run geofencing when the app is fully closed
 * (especially iOS), so this is reliable while Deer Intel is open — which is the
 * real in-the-field case — and must not be treated as a safety guarantee when
 * the app is closed.
 */
export function usePartyLocationSharing(opts: {
  party: Party | null;
  areas: GeofenceArea[];
  enabled: boolean;
  heading: number | null;
}): SharingState {
  const { party, areas, enabled, heading } = opts;
  const { user, configured } = useAuth();

  const [state, setState] = useState<SharingState>({
    active: false,
    inArea: false,
    areaName: null,
  });

  // Live values the GPS callback reads without restarting the watch.
  const areasRef = useRef<GeofenceArea[]>(areas);
  const headingRef = useRef<number | null>(heading);
  areasRef.current = areas;
  headingRef.current = heading;

  const partyId = party?.id ?? null;
  const canShare = configured && !!user && !!partyId && enabled;

  useEffect(() => {
    if (!canShare || !partyId) {
      setState({ active: false, inArea: false, areaName: null });
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ active: false, inArea: false, areaName: null });
      return;
    }

    setState((s) => ({ ...s, active: true }));

    let wasInArea = false;
    let lastUpsert = 0;
    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) return;

        const { latitude, longitude, accuracy } = position.coords;
        const area = findContainingArea(latitude, longitude, areasRef.current);

        if (area) {
          const now = Date.now();
          const justEntered = !wasInArea;
          wasInArea = true;
          setState({ active: true, inArea: true, areaName: area.name });

          // Publish immediately on entry, then throttle while inside.
          if (justEntered || now - lastUpsert >= UPSERT_INTERVAL_MS) {
            lastUpsert = now;
            void upsertMyLocation(partyId, {
              lat: latitude,
              lng: longitude,
              heading: headingRef.current,
              accuracy: accuracy ?? null,
              areaName: area.name,
            }).catch(() => {
              // Best-effort; a dropped update just means a slightly stale dot.
            });
          }
        } else if (wasInArea) {
          // Left the area — drop the dot exactly once on the transition.
          wasInArea = false;
          lastUpsert = 0;
          setState({ active: true, inArea: false, areaName: null });
          void clearMyLocation(partyId).catch(() => {});
        } else {
          setState({ active: true, inArea: false, areaName: null });
        }
      },
      () => {
        // Keep the last state on a transient GPS error rather than flapping.
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      // Stop broadcasting the moment sharing is turned off / unmounted.
      void clearMyLocation(partyId).catch(() => {});
    };
  }, [canShare, partyId]);

  return state;
}

/**
 * Subscribe to every live dot in a party. Returns the members currently inside
 * the shared area (fresh rows only), updated in real time via Supabase Realtime.
 * Pass the current user id via `excludeUserId` to keep your own dot out (the map
 * already renders you via UserLocationMarker).
 */
export function usePartyLocations(
  party: Party | null,
  excludeUserId?: string | null,
): MemberLocation[] {
  const { configured } = useAuth();
  const [locations, setLocations] = useState<MemberLocation[]>([]);
  // A ticking clock so stale dots drop out even with no new Realtime events.
  const [now, setNow] = useState(() => Date.now());

  const partyId = party?.id ?? null;

  useEffect(() => {
    if (!configured || !partyId) {
      setLocations([]);
      return;
    }

    let cancelled = false;

    const load = () => {
      void fetchLocations(partyId)
        .then((rows) => {
          if (!cancelled) setLocations(rows);
        })
        .catch(() => {});
    };

    load();
    const unsubscribe = subscribeToLocations(partyId, load);
    const tick = setInterval(() => setNow(Date.now()), 20_000);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(tick);
    };
  }, [configured, partyId]);

  return useMemo(
    () =>
      locations.filter((loc) => {
        if (excludeUserId && loc.user_id === excludeUserId) return false;
        const updated = Date.parse(loc.updated_at) || 0;
        return now - updated <= STALE_MS;
      }),
    [locations, excludeUserId, now],
  );
}

/**
 * The roster (members + display names) of a party, refreshed when the party
 * changes. Returned as a Map of user_id -> display name for quick lookups when
 * labelling live dots.
 */
export function usePartyRoster(party: Party | null): {
  members: PartyMember[];
  nameById: Map<string, string>;
} {
  const { configured } = useAuth();
  const [members, setMembers] = useState<PartyMember[]>([]);
  const partyId = party?.id ?? null;

  useEffect(() => {
    if (!configured || !partyId) {
      setMembers([]);
      return;
    }

    let cancelled = false;
    void listMembers(partyId)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [configured, partyId]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m.user_id, m.display_name);
    return map;
  }, [members]);

  return { members, nameById };
}

/**
 * Every shared pin in a party, kept live via Realtime. Returns all members'
 * pins (including the caller's own); callers filter by created_by as needed.
 */
export function usePartyPins(party: Party | null): PartyPin[] {
  const { configured } = useAuth();
  const [pins, setPins] = useState<PartyPin[]>([]);
  const partyId = party?.id ?? null;

  useEffect(() => {
    if (!configured || !partyId) {
      setPins([]);
      return;
    }

    let cancelled = false;
    const load = () => {
      void listPartyPins(partyId)
        .then((rows) => {
          if (!cancelled) setPins(rows);
        })
        .catch(() => {});
    };

    load();
    const unsubscribe = subscribeToPartyPins(partyId, load);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [configured, partyId]);

  return pins;
}

/**
 * Every shared buck (hit-list card) in a party, kept live via Realtime. Returns
 * all members' bucks; callers filter by created_by as needed.
 */
export function usePartyBucks(party: Party | null): PartyBuck[] {
  const { configured } = useAuth();
  const [bucks, setBucks] = useState<PartyBuck[]>([]);
  const partyId = party?.id ?? null;

  useEffect(() => {
    if (!configured || !partyId) {
      setBucks([]);
      return;
    }

    let cancelled = false;
    const load = () => {
      void listPartyBucks(partyId)
        .then((rows) => {
          if (!cancelled) setBucks(rows);
        })
        .catch(() => {});
    };

    load();
    const unsubscribe = subscribeToPartyBucks(partyId, load);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [configured, partyId]);

  return bucks;
}

/**
 * Shared buck-photo thumbnails for a party, live via Realtime. Pass
 * `withData=false` (the sync's dedup path) to fetch keys only and skip the heavy
 * data URLs.
 */
export function usePartyBuckPhotos(
  party: Party | null,
  withData = true,
): PartyBuckPhoto[] {
  const { configured } = useAuth();
  const [photos, setPhotos] = useState<PartyBuckPhoto[]>([]);
  const partyId = party?.id ?? null;

  useEffect(() => {
    if (!configured || !partyId) {
      setPhotos([]);
      return;
    }

    let cancelled = false;
    const load = () => {
      void listPartyBuckPhotos(partyId, withData)
        .then((rows) => {
          if (!cancelled) setPhotos(rows);
        })
        .catch(() => {});
    };

    load();
    const unsubscribe = subscribeToPartyBuckPhotos(partyId, load);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [configured, partyId, withData]);

  return photos;
}
