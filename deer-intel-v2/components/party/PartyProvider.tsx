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
  ACCOUNT_SETTING,
  booleanSetting,
  stringSetting,
  useAccountSettings,
  writeAccountSetting,
} from "@/lib/accountSettings";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { writeShareApplied } from "@/lib/partySharing";
import {
  createParty as apiCreateParty,
  joinParty as apiJoinParty,
  leaveParty as apiLeaveParty,
  listMyParties,
} from "@/lib/partyClient";
import type { Party } from "@/types/party";

// Which party the map is currently showing, and whether live location sharing
// is on: per device (live GPS is about this phone). Persisted so the choice
// survives reloads (matches the "deer-intel:*" keys).
const ACTIVE_PARTY_KEY = "deer-intel:active-party";
const SHARING_KEY = "deer-intel:party-sharing";
// Pin / buck sharing are account-level settings (lib/accountSettings), synced
// across the account's devices so two devices never fight over the shares.
// These per-device keys from older builds are only a fallback until the
// account setting is first chosen.
const LEGACY_PIN_SHARING_KEY = "deer-intel:party-pin-sharing";
const LEGACY_BUCK_SHARING_KEY = "deer-intel:party-buck-sharing";

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
  // Auto-share one property's map pins with the active party (account-level).
  pinSharingEnabled: boolean;
  setPinSharingEnabled: (on: boolean) => void;
  // The property whose pins are shared (account-level), or null.
  pinSharePropertyId: string | null;
  setPinSharePropertyId: (propertyId: string) => void;
  // Auto-share the tracked-buck hit list with the active party (account-level).
  buckSharingEnabled: boolean;
  setBuckSharingEnabled: (on: boolean) => void;
  // True once cloud sync has settled for the signed-in account (and no
  // account switch is pending): only then may this device add or remove
  // shared rows.
  sharingReady: boolean;
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
  const { configured, user, reconciled, accountSwitch } = useAuth();
  const available = configured && !!user;
  const userId = user?.id ?? null;
  const sharingReady = available && reconciled && accountSwitch === null;
  const accountSettings = useAccountSettings(userId);
  const store = useDeerIntelStore();

  const [parties, setParties] = useState<Party[]>([]);
  const [activePartyId, setActivePartyIdState] = useState<string | null>(null);
  const [sharingEnabled, setSharingEnabledState] = useState(false);
  const [legacyPinSharing, setLegacyPinSharing] = useState(false);
  const [legacyBuckSharing, setLegacyBuckSharing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore persisted preferences once on mount.
  useEffect(() => {
    setActivePartyIdState(readStored(ACTIVE_PARTY_KEY));
    setSharingEnabledState(readStored(SHARING_KEY) === "true");
    setLegacyPinSharing(readStored(LEGACY_PIN_SHARING_KEY) === "true");
    setLegacyBuckSharing(readStored(LEGACY_BUCK_SHARING_KEY) === "true");
  }, []);

  const pinSharingEnabled = booleanSetting(
    accountSettings,
    ACCOUNT_SETTING.partyPinSharing,
    legacyPinSharing,
  );
  const buckSharingEnabled = booleanSetting(
    accountSettings,
    ACCOUNT_SETTING.partyBuckSharing,
    legacyBuckSharing,
  );

  // The shared property must still exist; otherwise fall back to the one
  // selected on this device (until one is chosen, which then syncs).
  const chosenPinProperty = stringSetting(accountSettings, ACCOUNT_SETTING.partyPinPropertyId);
  const pinSharePropertyId = store.properties.some((p) => p.id === chosenPinProperty)
    ? (chosenPinProperty ?? null)
    : store.selectedPropertyId || null;

  const setActivePartyId = useCallback((id: string | null) => {
    setActivePartyIdState(id);
    writeStored(ACTIVE_PARTY_KEY, id);
  }, []);

  const setSharingEnabled = useCallback((on: boolean) => {
    setSharingEnabledState(on);
    writeStored(SHARING_KEY, on ? "true" : "false");
  }, []);

  const setPinSharingEnabled = useCallback(
    (on: boolean) => {
      setLegacyPinSharing(on);
      writeStored(LEGACY_PIN_SHARING_KEY, on ? "true" : "false");
      if (!userId) return;
      // Turned off here: withdraw from the active party even if this device
      // never had it on itself.
      if (!on && activePartyId) writeShareApplied("pins", userId, activePartyId, true);
      if (on && pinSharePropertyId && !chosenPinProperty) {
        writeAccountSetting(userId, ACCOUNT_SETTING.partyPinPropertyId, pinSharePropertyId);
      }
      writeAccountSetting(userId, ACCOUNT_SETTING.partyPinSharing, on);
    },
    [userId, activePartyId, pinSharePropertyId, chosenPinProperty],
  );

  // Pin sharing turned on before the shared property was an account setting
  // (or before this device synced it): pin the property this device shares,
  // so every device of the account converges on the same one.
  useEffect(() => {
    if (!sharingReady || !userId || !pinSharingEnabled) return;
    if (chosenPinProperty || !pinSharePropertyId) return;
    writeAccountSetting(userId, ACCOUNT_SETTING.partyPinPropertyId, pinSharePropertyId);
  }, [sharingReady, userId, pinSharingEnabled, chosenPinProperty, pinSharePropertyId]);

  const setPinSharePropertyId = useCallback(
    (propertyId: string) => {
      if (!userId || !propertyId) return;
      writeAccountSetting(userId, ACCOUNT_SETTING.partyPinPropertyId, propertyId);
    },
    [userId],
  );

  const setBuckSharingEnabled = useCallback(
    (on: boolean) => {
      setLegacyBuckSharing(on);
      writeStored(LEGACY_BUCK_SHARING_KEY, on ? "true" : "false");
      if (!userId) return;
      if (!on && activePartyId) {
        writeShareApplied("bucks", userId, activePartyId, true);
        writeShareApplied("buckPhotos", userId, activePartyId, true);
      }
      writeAccountSetting(userId, ACCOUNT_SETTING.partyBuckSharing, on);
    },
    [userId, activePartyId],
  );

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
      pinSharePropertyId,
      setPinSharePropertyId,
      buckSharingEnabled,
      setBuckSharingEnabled,
      sharingReady,
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
      pinSharePropertyId,
      setPinSharePropertyId,
      buckSharingEnabled,
      setBuckSharingEnabled,
      sharingReady,
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
