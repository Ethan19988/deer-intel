"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  createParty as apiCreateParty,
  joinParty as apiJoinParty,
  leaveParty as apiLeaveParty,
  listMyParties,
} from "@/lib/partyClient";
import type { Party } from "@/types/party";

// Which party the map is currently showing, and whether live sharing is on.
// Persisted so the choice survives reloads (matches the "deer-intel:*" keys).
const ACTIVE_PARTY_KEY = "deer-intel:active-party";
const SHARING_KEY = "deer-intel:party-sharing";
const PIN_SHARING_KEY = "deer-intel:party-pin-sharing";
const BUCK_SHARING_KEY = "deer-intel:party-buck-sharing";

type PartyContextValue = {
  // True when Supabase is configured and the user is signed in — parties need
  // an account, so the UI shows a sign-in nudge otherwise.
  available: boolean;
  parties: Party[];
  activeParty: Party | null;
  activePartyId: string | null;
  setActivePartyId: (id: string | null) => void;
  // Live location sharing master switch (per device).
  sharingEnabled: boolean;
  setSharingEnabled: (on: boolean) => void;
  // Auto-share dropped map pins with the active party (per device).
  pinSharingEnabled: boolean;
  setPinSharingEnabled: (on: boolean) => void;
  // Auto-share the tracked-buck hit list with the active party (per device).
  buckSharingEnabled: boolean;
  setBuckSharingEnabled: (on: boolean) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createParty: (name: string, displayName: string) => Promise<Party>;
  joinParty: (inviteCode: string, displayName: string) => Promise<Party>;
  leaveParty: (partyId: string) => Promise<void>;
};

const PartyContext = createContext<PartyContextValue | null>(null);

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Best-effort persistence.
  }
}

export function PartyProvider({ children }: { children: ReactNode }) {
  const { configured, user } = useAuth();
  const available = configured && !!user;

  const [parties, setParties] = useState<Party[]>([]);
  const [activePartyId, setActivePartyIdState] = useState<string | null>(null);
  const [sharingEnabled, setSharingEnabledState] = useState(false);
  const [pinSharingEnabled, setPinSharingEnabledState] = useState(false);
  const [buckSharingEnabled, setBuckSharingEnabledState] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore persisted preferences once on mount.
  useEffect(() => {
    setActivePartyIdState(readStored(ACTIVE_PARTY_KEY));
    setSharingEnabledState(readStored(SHARING_KEY) === "true");
    setPinSharingEnabledState(readStored(PIN_SHARING_KEY) === "true");
    setBuckSharingEnabledState(readStored(BUCK_SHARING_KEY) === "true");
  }, []);

  const setActivePartyId = useCallback((id: string | null) => {
    setActivePartyIdState(id);
    writeStored(ACTIVE_PARTY_KEY, id);
  }, []);

  const setSharingEnabled = useCallback((on: boolean) => {
    setSharingEnabledState(on);
    writeStored(SHARING_KEY, on ? "true" : "false");
  }, []);

  const setPinSharingEnabled = useCallback((on: boolean) => {
    setPinSharingEnabledState(on);
    writeStored(PIN_SHARING_KEY, on ? "true" : "false");
  }, []);

  const setBuckSharingEnabled = useCallback((on: boolean) => {
    setBuckSharingEnabledState(on);
    writeStored(BUCK_SHARING_KEY, on ? "true" : "false");
  }, []);

  const refresh = useCallback(async () => {
    if (!available) {
      setParties([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const rows = await listMyParties();
      setParties(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your parties.");
    } finally {
      setLoading(false);
    }
  }, [available]);

  // Load parties whenever sign-in state changes; clear them on sign-out.
  useEffect(() => {
    if (!available) {
      setParties([]);
      setError(null);
      return;
    }
    void refresh();
  }, [available, refresh]);

  const createParty = useCallback(
    async (name: string, displayName: string) => {
      const party = await apiCreateParty(name, displayName);
      await refresh();
      setActivePartyId(party.id);
      return party;
    },
    [refresh, setActivePartyId],
  );

  const joinParty = useCallback(
    async (inviteCode: string, displayName: string) => {
      const party = await apiJoinParty(inviteCode, displayName);
      await refresh();
      setActivePartyId(party.id);
      return party;
    },
    [refresh, setActivePartyId],
  );

  const leaveParty = useCallback(
    async (partyId: string) => {
      await apiLeaveParty(partyId);
      if (activePartyId === partyId) setActivePartyId(null);
      await refresh();
    },
    [activePartyId, refresh, setActivePartyId],
  );

  const activeParty = useMemo(
    () => parties.find((p) => p.id === activePartyId) ?? null,
    [parties, activePartyId],
  );

  const value = useMemo<PartyContextValue>(
    () => ({
      available,
      parties,
      activeParty,
      activePartyId,
      setActivePartyId,
      sharingEnabled,
      setSharingEnabled,
      pinSharingEnabled,
      setPinSharingEnabled,
      buckSharingEnabled,
      setBuckSharingEnabled,
      loading,
      error,
      refresh,
      createParty,
      joinParty,
      leaveParty,
    }),
    [
      available,
      parties,
      activeParty,
      activePartyId,
      setActivePartyId,
      sharingEnabled,
      setSharingEnabled,
      pinSharingEnabled,
      setPinSharingEnabled,
      buckSharingEnabled,
      setBuckSharingEnabled,
      loading,
      error,
      refresh,
      createParty,
      joinParty,
      leaveParty,
    ],
  );

  return <PartyContext.Provider value={value}>{children}</PartyContext.Provider>;
}

export function useActiveParty(): PartyContextValue {
  const ctx = useContext(PartyContext);
  if (!ctx) {
    throw new Error("useActiveParty must be used within a PartyProvider.");
  }
  return ctx;
}
