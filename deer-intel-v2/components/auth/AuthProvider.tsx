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
  createEmptyDeerIntelState,
  saveDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { backupLocalImages } from "@/lib/imageStore";
import {
  getSupabaseClient,
  isAuthRequired,
  isCloudSyncConfigured,
} from "@/lib/supabaseClient";
import {
  clearSyncMeta,
  decideReconcile,
  detectAccountSwitch,
  hasMeaningfulData,
  pullRemoteState,
  pushRemoteState,
  readDeviceOwner,
  readSyncMeta,
  serializeState,
  writeDeviceOwner,
  writeSyncMeta,
  type AccountSwitch,
} from "@/lib/cloudSync";
import type { DeerIntelState } from "@/types/deerIntelStore";

type AuthStatus = "loading" | "signed-in" | "signed-out";
type SyncStatus = "idle" | "reconciling" | "syncing" | "synced" | "error";

export type AuthUser = { id: string; email: string | null };

type ActionResult = { error?: string; needsConfirmation?: boolean };

// A different account signed in on a device that holds someone else's data.
// Nothing syncs until the hunter picks one of the two choices.
export type PendingAccountSwitch = AccountSwitch & {
  // The account signing in already has real data in its cloud.
  remoteHasData: boolean;
};

export type AccountSwitchChoice = "load-account" | "move-device-data";

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
  accountSwitch: PendingAccountSwitch | null;
  resolveAccountSwitch: (choice: AccountSwitchChoice) => Promise<void>;
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
  const [accountSwitch, setAccountSwitch] =
    useState<PendingAccountSwitch | null>(null);

  // Serialized snapshot of the state we believe is in sync with the cloud.
  // Kept in a ref so applying a pulled state can suppress the echo push. It is
  // null until the first reconcile establishes a baseline, which also gates the
  // push effect so we never upload stale local data before pulling.
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  const reconciledUserIdRef = useRef<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest local state, for callbacks (focus refresh, sign-out) that must see
  // edits made after they were created.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Apply a state we pulled from the cloud without triggering a push back up.
  // The store normalizes what it saves, so the baseline is the saved form;
  // otherwise the difference would look like an edit and echo a push.
  const applyRemoteState = useCallback(
    (remote: DeerIntelState): DeerIntelState => {
      const saved = saveDeerIntelStore(remote);
      lastSyncedSnapshotRef.current = serializeState(saved);
      return saved;
    },
    [],
  );

  const recordSynced = useCallback(
    (snapshot: string, userId: string, serverTime?: string) => {
      const syncedAt = serverTime || new Date().toISOString();
      lastSyncedSnapshotRef.current = snapshot;
      writeSyncMeta({ updatedAt: syncedAt, pendingLocalEdits: false, userId });
      // The local data now belongs to this account (survives sign-out).
      writeDeviceOwner({ userId });
      setLastSyncedAt(syncedAt);
    },
    [],
  );

  // Remember (across reloads) that this device holds edits the cloud lacks.
  const markPendingEdits = useCallback((userId: string) => {
    const meta = readSyncMeta();
    if (meta?.pendingLocalEdits && meta.userId === userId) return;
    writeSyncMeta({
      updatedAt: meta?.updatedAt ?? "",
      pendingLocalEdits: true,
      userId,
    });
  }, []);

  const hasUnpushedEdits = useCallback(
    () =>
      lastSyncedSnapshotRef.current !== null &&
      serializeState(stateRef.current) !== lastSyncedSnapshotRef.current,
    [],
  );

  // First sync after a user signs in: compare local vs cloud and pick a safe
  // action. Runs once per user id.
  const reconcile = useCallback(
    async (activeUser: AuthUser) => {
      const currentState = state;
      setSyncStatus("reconciling");
      setSyncMessage("Syncing with the cloud…");

      try {
        const remote = await pullRemoteState(activeUser.id);
        const localMeta = readSyncMeta();

        // This device holds another account's data: don't push it into this
        // account or pull over it. Leave the baseline unset (which gates the
        // push effect and focus refresh) until the hunter chooses.
        const switched = detectAccountSwitch(
          currentState,
          readDeviceOwner(),
          localMeta,
          activeUser.id,
        );

        if (switched) {
          // Pin the owner (it may only have been known from sync meta) so the
          // prompt comes back after a reload or sign-out until resolved.
          writeDeviceOwner({
            userId: switched.previousUserId,
            unsyncedEdits: switched.unsyncedEdits,
          });
          lastSyncedSnapshotRef.current = null;
          setAccountSwitch({
            ...switched,
            remoteHasData: !!remote && hasMeaningfulData(remote.state),
          });
          setSyncStatus("idle");
          setSyncMessage(
            "This device has another account's data. Choose what to load before syncing.",
          );
          return;
        }

        setAccountSwitch(null);
        const decision = decideReconcile(currentState, localMeta, remote);

        if (decision.action === "pull") {
          const saved = applyRemoteState(decision.state);
          recordSynced(serializeState(saved), activeUser.id, remote?.updatedAt);
        } else if (decision.action === "push") {
          const snapshot = serializeState(currentState);
          const savedAt = await pushRemoteState(activeUser.id, currentState);
          recordSynced(snapshot, activeUser.id, savedAt);
        } else {
          lastSyncedSnapshotRef.current = serializeState(currentState);
          writeDeviceOwner({ userId: activeUser.id });
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
        setAccountSwitch(null);
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

    markPendingEdits(user.id);

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);

    pushTimerRef.current = setTimeout(async () => {
      pushTimerRef.current = null;
      setSyncStatus("syncing");
      setSyncMessage("Saving changes to the cloud…");

      try {
        const savedAt = await pushRemoteState(user.id, state);
        recordSynced(snapshot, user.id, savedAt);
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
  }, [state, user, recordSynced, markPendingEdits]);

  // Pull newer cloud data when the tab regains focus (covers other devices).
  const refreshFromCloud = useCallback(async () => {
    if (!user) return;

    // Wait for the first reconcile; it decides the starting point.
    if (reconciledUserIdRef.current !== user.id) return;
    if (lastSyncedSnapshotRef.current === null) return;

    try {
      // This device has edits the cloud hasn't received (debounce still
      // running, offline, or a failed push). Send them now instead of pulling,
      // which would silently replace them.
      if (hasUnpushedEdits()) {
        if (pushTimerRef.current) {
          clearTimeout(pushTimerRef.current);
          pushTimerRef.current = null;
        }
        const pending = stateRef.current;
        const snapshot = serializeState(pending);
        setSyncStatus("syncing");
        setSyncMessage("Saving changes to the cloud…");
        const savedAt = await pushRemoteState(user.id, pending);
        recordSynced(snapshot, user.id, savedAt);
        setSyncStatus("synced");
        setSyncMessage("All changes saved to the cloud.");
        return;
      }

      const remote = await pullRemoteState(user.id);
      if (!remote) return;

      const remoteSnapshot = serializeState(remote.state);
      if (remoteSnapshot === lastSyncedSnapshotRef.current) return;

      const localMeta = readSyncMeta();
      const remoteTime = Date.parse(remote.updatedAt) || 0;
      const localTime = Date.parse(localMeta?.updatedAt ?? "") || 0;

      // An edit may have landed while the pull was in flight; keep it.
      if (hasUnpushedEdits()) return;

      if (remoteTime > localTime) {
        const saved = applyRemoteState(remote.state);
        recordSynced(serializeState(saved), user.id, remote.updatedAt);
        setSyncStatus("synced");
        setSyncMessage("Loaded newer data from the cloud.");
      }
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(`Cloud refresh failed: ${errorMessage(error)}`);
    }
  }, [user, applyRemoteState, recordSynced, hasUnpushedEdits]);

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

    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }

    // Save the last few seconds of edits before the session goes away.
    let unsyncedEdits = false;
    if (user && hasUnpushedEdits()) {
      try {
        await pushRemoteState(user.id, stateRef.current);
      } catch {
        // Local data stays on this device either way.
        unsyncedEdits = true;
      }
    } else if (user && lastSyncedSnapshotRef.current !== null) {
      // An earlier push failed (offline) and nothing changed since.
      const meta = readSyncMeta();
      unsyncedEdits = meta?.userId === user.id && meta?.pendingLocalEdits === true;
    }

    // Remember whose data stays on this device so a different account signing
    // in next is asked before anything syncs. Skipped while an account switch
    // is unresolved: the data still belongs to the previous owner.
    if (user && lastSyncedSnapshotRef.current !== null) {
      writeDeviceOwner({ userId: user.id, unsyncedEdits });
    }

    if (supabase) await supabase.auth.signOut();

    // Keep local data on this device; just forget the sync bookkeeping so the
    // next sign-in reconciles cleanly.
    clearSyncMeta();
    reconciledUserIdRef.current = null;
    lastSyncedSnapshotRef.current = null;
    setAccountSwitch(null);
  }, [user, hasUnpushedEdits]);

  const syncNow = useCallback(async () => {
    if (!user) return;

    await reconcile(user);
  }, [user, reconcile]);

  // The hunter's answer to the account-switch prompt.
  const resolveAccountSwitch = useCallback(
    async (choice: AccountSwitchChoice) => {
      if (!user || !accountSwitch) return;

      setSyncStatus("syncing");
      setSyncMessage(
        choice === "load-account"
          ? "Loading this account's data…"
          : "Moving this device's data into this account…",
      );

      try {
        if (choice === "load-account") {
          // Replace local data with this account's cloud copy (or a fresh
          // start when it has none). The previous account's synced data stays
          // in its own cloud backup.
          const remote = await pullRemoteState(user.id);
          const saved = applyRemoteState(
            remote?.state ?? createEmptyDeerIntelState(),
          );
          recordSynced(serializeState(saved), user.id, remote?.updatedAt);
          setSyncMessage("Loaded this account's data.");
        } else {
          const pending = stateRef.current;
          const snapshot = serializeState(pending);
          const savedAt = await pushRemoteState(user.id, pending);
          recordSynced(snapshot, user.id, savedAt);
          // Photo bytes were backed up under the previous account; copy them
          // into this one too so its other devices can see them.
          void backupLocalImages().catch(() => undefined);
          setSyncMessage("Moved this device's data into this account.");
        }

        setAccountSwitch(null);
        setSyncStatus("synced");
      } catch (error) {
        // Leave the prompt up so the hunter can retry; nothing was replaced.
        setSyncStatus("error");
        setSyncMessage(`Couldn't finish: ${errorMessage(error)}`);
      }
    },
    [user, accountSwitch, applyRemoteState, recordSynced],
  );

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
      accountSwitch,
      resolveAccountSwitch,
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
      accountSwitch,
      resolveAccountSwitch,
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
