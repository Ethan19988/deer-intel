"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  saveDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  getSupabaseClient,
  isAuthRequired,
  isCloudSyncConfigured,
} from "@/lib/supabaseClient";
import {
  clearSyncMeta,
  decideReconcile,
  pullRemoteState,
  pushRemoteState,
  readSyncMeta,
  serializeState,
  writeSyncMeta,
} from "@/lib/cloudSync";
import type { DeerIntelState } from "@/types/deerIntelStore";

type AuthStatus = "loading" | "signed-in" | "signed-out";
type SyncStatus = "idle" | "reconciling" | "syncing" | "synced" | "error";

export type AuthUser = { id: string; email: string | null };

type ActionResult = { error?: string; needsConfirmation?: boolean };

type AuthContextValue = {
  configured: boolean;
  authRequired: boolean;
  status: AuthStatus;
  user: AuthUser | null;
  syncStatus: SyncStatus;
  syncMessage: string | null;
  lastSyncedAt: string | null;
  signInWithPassword: (email: string, password: string) => Promise<ActionResult>;
  signUp: (email: string, password: string) => Promise<ActionResult>;
  signInWithMagicLink: (email: string) => Promise<ActionResult>;
  signInWithGitHub: () => Promise<ActionResult>;
  sendPasswordReset: (email: string) => Promise<ActionResult>;
  updatePassword: (password: string) => Promise<ActionResult>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 1500;

function toAuthUser(session: Session | null): AuthUser | null {
  if (!session?.user) return null;

  return { id: session.user.id, email: session.user.email ?? null };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  return "Something went wrong. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isCloudSyncConfigured();
  const authRequired = isAuthRequired();
  const state = useDeerIntelStore();

  const [status, setStatus] = useState<AuthStatus>(
    configured ? "loading" : "signed-out",
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Serialized snapshot of the state we believe is in sync with the cloud.
  // Kept in a ref so applying a pulled state can suppress the echo push. It is
  // null until the first reconcile establishes a baseline, which also gates the
  // push effect so we never upload stale local data before pulling.
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  const reconciledUserIdRef = useRef<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply a state we pulled from the cloud without triggering a push back up.
  const applyRemoteState = useCallback((remote: DeerIntelState) => {
    lastSyncedSnapshotRef.current = serializeState(remote);
    saveDeerIntelStore(remote);
  }, []);

  const recordSynced = useCallback((snapshot: string) => {
    const now = new Date().toISOString();
    lastSyncedSnapshotRef.current = snapshot;
    writeSyncMeta({ updatedAt: now, lastSyncedSnapshot: snapshot });
    setLastSyncedAt(now);
  }, []);

  // First sync after a user signs in: compare local vs cloud and pick a safe
  // action. Runs once per user id.
  const reconcile = useCallback(
    async (activeUser: AuthUser) => {
      const currentState = state;
      setSyncStatus("reconciling");
      setSyncMessage("Syncing with the cloud…");

      try {
        const remote = await pullRemoteState(activeUser.id);
        const decision = decideReconcile(currentState, readSyncMeta(), remote);

        if (decision.action === "pull") {
          applyRemoteState(decision.state);
          recordSynced(serializeState(decision.state));
        } else if (decision.action === "push") {
          const snapshot = serializeState(currentState);
          await pushRemoteState(activeUser.id, currentState);
          recordSynced(snapshot);
        } else {
          lastSyncedSnapshotRef.current = serializeState(currentState);
          setLastSyncedAt(readSyncMeta()?.updatedAt ?? null);
        }

        setSyncStatus("synced");
        setSyncMessage(decision.reason);
      } catch (error) {
        setSyncStatus("error");
        setSyncMessage(`Cloud sync failed: ${errorMessage(error)}`);
      }
    },
    [state, applyRemoteState, recordSynced],
  );

  // Track the Supabase session. Resetting sync state on sign-out happens here,
  // inside the auth-change callback (an external subscription), rather than in a
  // reactive effect body.
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let active = true;

    function applySession(session: Session | null) {
      const nextUser = toAuthUser(session);
      setUser(nextUser);
      setStatus(session ? "signed-in" : "signed-out");

      if (!nextUser) {
        reconciledUserIdRef.current = null;
        lastSyncedSnapshotRef.current = null;
        setSyncStatus("idle");
        setSyncMessage(null);
        setLastSyncedAt(null);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (active) applySession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => applySession(session),
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Run reconcile once whenever a (new) user signs in.
  useEffect(() => {
    if (!user) return;
    if (reconciledUserIdRef.current === user.id) return;

    reconciledUserIdRef.current = user.id;
    void reconcile(user);
    // reconcile intentionally captures the state at sign-in time; ongoing
    // changes are handled by the push effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Push local edits to the cloud (debounced) once signed in and reconciled.
  useEffect(() => {
    if (!user) return;
    if (reconciledUserIdRef.current !== user.id) return;
    // Wait for the initial reconcile to set a baseline before pushing, so we
    // never overwrite newer cloud data with stale local data on sign-in.
    if (lastSyncedSnapshotRef.current === null) return;

    const snapshot = serializeState(state);
    if (snapshot === lastSyncedSnapshotRef.current) return;

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);

    pushTimerRef.current = setTimeout(async () => {
      setSyncStatus("syncing");
      setSyncMessage("Saving changes to the cloud…");

      try {
        await pushRemoteState(user.id, state);
        recordSynced(snapshot);
        setSyncStatus("synced");
        setSyncMessage("All changes saved to the cloud.");
      } catch (error) {
        setSyncStatus("error");
        setSyncMessage(`Cloud save failed: ${errorMessage(error)}`);
      }
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [state, user, recordSynced]);

  // Pull newer cloud data when the tab regains focus (covers other devices).
  const refreshFromCloud = useCallback(async () => {
    if (!user) return;

    try {
      const remote = await pullRemoteState(user.id);
      if (!remote) return;

      const remoteSnapshot = serializeState(remote.state);
      if (remoteSnapshot === lastSyncedSnapshotRef.current) return;

      const localMeta = readSyncMeta();
      const remoteTime = Date.parse(remote.updatedAt) || 0;
      const localTime = Date.parse(localMeta?.updatedAt ?? "") || 0;

      // Only adopt the cloud copy when it is newer than our last local change,
      // so we never stomp on unsaved edits made on this device.
      if (remoteTime > localTime) {
        applyRemoteState(remote.state);
        recordSynced(remoteSnapshot);
        setSyncStatus("synced");
        setSyncMessage("Loaded newer data from the cloud.");
      }
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(`Cloud refresh failed: ${errorMessage(error)}`);
    }
  }, [user, applyRemoteState, recordSynced]);

  useEffect(() => {
    if (!user) return;

    function handleFocus() {
      void refreshFromCloud();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") void refreshFromCloud();
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user, refreshFromCloud]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<ActionResult> => {
      const supabase = getSupabaseClient();
      if (!supabase) return { error: "Cloud sync is not configured." };

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      return error ? { error: error.message } : {};
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<ActionResult> => {
      const supabase = getSupabaseClient();
      if (!supabase) return { error: "Cloud sync is not configured." };

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) return { error: error.message };

      // When email confirmation is on, Supabase returns a user but no session.
      return { needsConfirmation: !data.session };
    },
    [],
  );

  const signInWithMagicLink = useCallback(
    async (email: string): Promise<ActionResult> => {
      const supabase = getSupabaseClient();
      if (!supabase) return { error: "Cloud sync is not configured." };

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      return error ? { error: error.message } : {};
    },
    [],
  );

  const signInWithGitHub = useCallback(async (): Promise<ActionResult> => {
    const supabase = getSupabaseClient();
    if (!supabase) return { error: "Cloud sync is not configured." };

    // Redirects the whole page to GitHub and back; the session is picked up on
    // return via detectSessionInUrl in the Supabase client config.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });

    return error ? { error: error.message } : {};
  }, []);

  const sendPasswordReset = useCallback(
    async (email: string): Promise<ActionResult> => {
      const supabase = getSupabaseClient();
      if (!supabase) return { error: "Cloud sync is not configured." };

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/reset-password`
            : undefined,
      });

      return error ? { error: error.message } : {};
    },
    [],
  );

  const updatePassword = useCallback(
    async (password: string): Promise<ActionResult> => {
      const supabase = getSupabaseClient();
      if (!supabase) return { error: "Cloud sync is not configured." };

      const { error } = await supabase.auth.updateUser({ password });

      return error ? { error: error.message } : {};
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);

    if (supabase) await supabase.auth.signOut();

    // Keep local data on this device; just forget the sync bookkeeping so the
    // next sign-in reconciles cleanly.
    clearSyncMeta();
    reconciledUserIdRef.current = null;
    lastSyncedSnapshotRef.current = null;
  }, []);

  const syncNow = useCallback(async () => {
    if (!user) return;

    await reconcile(user);
  }, [user, reconcile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      authRequired,
      status,
      user,
      syncStatus,
      syncMessage,
      lastSyncedAt,
      signInWithPassword,
      signUp,
      signInWithMagicLink,
      signInWithGitHub,
      sendPasswordReset,
      updatePassword,
      signOut,
      syncNow,
    }),
    [
      configured,
      authRequired,
      status,
      user,
      syncStatus,
      syncMessage,
      lastSyncedAt,
      signInWithPassword,
      signUp,
      signInWithMagicLink,
      signInWithGitHub,
      sendPasswordReset,
      updatePassword,
      signOut,
      syncNow,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
