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
import { backupLocalImages, startPhotoUploadQueue } from "@/lib/imageStore";
import { readAllLandTags, replaceAllLandTags, useLandTags } from "@/lib/landTags";
import {
  getSupabaseClient,
  isAuthRequired,
  isCloudSyncConfigured,
} from "@/lib/supabaseClient";
import {
  buildSyncBase,
  decideReconcile,
  detectAccountSwitch,
  hasMeaningfulData,
  mergeSyncedStates,
  overwriteRemoteState,
  pullRemoteState,
  readDeviceOwner,
  readSyncMeta,
  saveWithMerge,
  serializeState,
  splitLandTags,
  syncMetaForUser,
  withLandTags,
  writeDeviceOwner,
  writeSyncMeta,
  type AccountSwitch,
  type SyncedState,
} from "@/lib/cloudSync";

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
  // Parcel land tags live in their own localStorage key but sync in the same
  // cloud row as the records.
  const landTags = useLandTags();

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
  // Cloud saves run one at a time so each sees the version the previous one
  // left behind.
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  // Run `task` after every cloud save/refresh already queued, so a pull never
  // overlaps a save (and can't apply a row older than one just pushed).
  // `task` must not await anything that is itself queued here.
  const runExclusive = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const result = saveChainRef.current.then(task, task);
    saveChainRef.current = result.catch(() => undefined);
    return result;
  }, []);

  // What this device would upload right now: records plus land tags.
  const currentSynced = useCallback(
    (): SyncedState => withLandTags(stateRef.current, readAllLandTags()),
    [],
  );

  // Apply a state from the cloud (or a merge) without triggering a push back
  // up. The store normalizes what it saves, so the baseline is the saved form;
  // otherwise the difference would look like an edit and echo a push. Rows
  // from older builds have no landTags; local tags are left alone then.
  const applySyncedState = useCallback((synced: SyncedState): SyncedState => {
    const { state: records, landTags: tags } = splitLandTags(synced);
    const saved = saveDeerIntelStore(records);
    stateRef.current = saved;
    if (tags !== undefined) replaceAllLandTags(tags);
    const applied = withLandTags(saved, readAllLandTags());
    lastSyncedSnapshotRef.current = serializeState(applied);
    return applied;
  }, []);

  // Record that `uploaded` is what the cloud now holds (at `serverTime`).
  // `alsoBase` is another form of the same sync point (the raw cloud row next
  // to its normalized local copy) so neither looks like an edit next time.
  // Edits made while the save was in flight stay marked pending: only an
  // unchanged state counts as synced.
  const recordSynced = useCallback(
    (
      uploaded: SyncedState,
      userId: string,
      serverTime: string | undefined,
      alsoBase?: SyncedState,
    ) => {
      const snapshot = serializeState(uploaded);
      const syncedAt =
        serverTime || syncMetaForUser(readSyncMeta(), userId)?.updatedAt || "";
      lastSyncedSnapshotRef.current = snapshot;
      writeSyncMeta({
        updatedAt: syncedAt,
        pendingLocalEdits: serializeState(currentSynced()) !== snapshot,
        userId,
        base: alsoBase ? buildSyncBase(uploaded, alsoBase) : buildSyncBase(uploaded),
      });
      // The local data now belongs to this account (survives sign-out).
      writeDeviceOwner({ userId });
      setLastSyncedAt(syncedAt || null);
    },
    [currentSynced],
  );

  // Save this device's current data without overwriting another device's
  // newer saves: a conditional push that, on a version mismatch, merges with
  // the cloud copy by record id and pushes the merge. Queued behind any save
  // already running.
  const saveToCloud = useCallback(
    (userId: string): Promise<{ merged: boolean }> => {
      const run = async () => {
        const local = currentSynced();
        const meta = readSyncMeta();
        const ours = meta?.userId === userId ? meta : null;
        const outcome = await saveWithMerge(
          userId,
          local,
          ours?.updatedAt || null,
          ours?.base,
        );

        if (outcome.merged) {
          // Another device's changes came in. Fold in anything edited here
          // while the save was in flight (changes relative to what we sent),
          // then apply it locally.
          const now = currentSynced();
          if (serializeState(now) === serializeState(local)) {
            const applied = applySyncedState(outcome.state);
            recordSynced(applied, userId, outcome.updatedAt, outcome.state);
          } else {
            applySyncedState(
              mergeSyncedStates(now, outcome.state, buildSyncBase(local)),
            );
            // Snapshot = the cloud copy, so the newer local edits stay
            // pending and the push effect sends them next.
            recordSynced(outcome.state, userId, outcome.updatedAt);
          }
        } else {
          recordSynced(outcome.state, userId, outcome.updatedAt);
        }

        return { merged: outcome.merged };
      };

      return runExclusive(run);
    },
    [currentSynced, applySyncedState, recordSynced, runExclusive],
  );

  // Remember (across reloads) that this device holds edits the cloud lacks.
  const markPendingEdits = useCallback((userId: string) => {
    const meta = readSyncMeta();
    if (meta?.pendingLocalEdits && meta.userId === userId) return;
    const ours = meta?.userId === userId ? meta : null;
    writeSyncMeta({
      updatedAt: ours?.updatedAt ?? "",
      pendingLocalEdits: true,
      userId,
      base: ours?.base,
    });
  }, []);

  const hasUnpushedEdits = useCallback(
    () =>
      lastSyncedSnapshotRef.current !== null &&
      serializeState(currentSynced()) !== lastSyncedSnapshotRef.current,
    [currentSynced],
  );

  // First sync after a user signs in: compare local vs cloud and pick a safe
  // action. Runs once per user id.
  const reconcile = useCallback(
    async (activeUser: AuthUser) => {
      const currentState = currentSynced();
      setSyncStatus("reconciling");
      setSyncMessage("Syncing with the cloud…");

      try {
        const remote = await pullRemoteState(activeUser.id);
        // Sign-out keeps the sync meta (and its merge base) so this same
        // account signing back in still honors deletions made on this device.
        // It is only reused for the account it belongs to.
        const storedMeta = readSyncMeta();
        let localMeta = syncMetaForUser(storedMeta, activeUser.id);
        const owner = readDeviceOwner();

        // If this same account signed out with edits its cloud never got,
        // treat them as unsaved so they are merged in rather than replaced by
        // the cloud copy.
        if (owner?.userId === activeUser.id && owner.unsyncedEdits) {
          localMeta = localMeta
            ? { ...localMeta, pendingLocalEdits: true }
            : { updatedAt: "", pendingLocalEdits: true, userId: activeUser.id };
        }

        // This device holds another account's data: don't push it into this
        // account or pull over it. Leave the baseline unset (which gates the
        // push effect and focus refresh) until the hunter chooses. Uses the
        // stored meta as-is: its userId says whose data this is.
        const switched = detectAccountSwitch(
          currentState,
          owner,
          storedMeta,
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

        let reason = decision.reason;

        if (decision.action === "pull") {
          const applied = applySyncedState(decision.state);
          recordSynced(applied, activeUser.id, remote?.updatedAt, decision.state);
          // A row from an older build has no land tags; upload this device's.
          if (
            decision.state.landTags === undefined &&
            Object.keys(readAllLandTags()).length > 0
          ) {
            await saveToCloud(activeUser.id);
          }
        } else if (decision.action === "push") {
          // Conditional on the version this device last saw; merges with the
          // cloud copy instead of overwriting it if another device saved since.
          const { merged } = await saveToCloud(activeUser.id);
          if (merged) reason = "Merged this device's changes with the cloud.";
        } else if (remote) {
          // In sync. Refresh the merge base (older builds didn't keep one).
          recordSynced(currentState, activeUser.id, remote.updatedAt, remote.state);
        }

        setSyncStatus("synced");
        setSyncMessage(reason);
      } catch (error) {
        setSyncStatus("error");
        setSyncMessage(`Cloud sync failed: ${errorMessage(error)}`);
      }
    },
    [currentSynced, applySyncedState, recordSynced, saveToCloud],
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

  // Retry photos that couldn't upload yet (taken offline or signed out) now,
  // and again whenever the connection or the app comes back.
  useEffect(() => {
    if (!user) return;
    return startPhotoUploadQueue();
  }, [user]);

  // Push local edits to the cloud (debounced) once signed in and reconciled.
  useEffect(() => {
    if (!user) return;
    if (reconciledUserIdRef.current !== user.id) return;
    // Wait for the initial reconcile to set a baseline before pushing, so we
    // never overwrite newer cloud data with stale local data on sign-in.
    if (lastSyncedSnapshotRef.current === null) return;

    const snapshot = serializeState(withLandTags(state, landTags));
    if (snapshot === lastSyncedSnapshotRef.current) return;

    markPendingEdits(user.id);

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);

    pushTimerRef.current = setTimeout(async () => {
      pushTimerRef.current = null;
      setSyncStatus("syncing");
      setSyncMessage("Saving changes to the cloud…");

      try {
        const { merged } = await saveToCloud(user.id);
        setSyncStatus("synced");
        setSyncMessage(
          merged
            ? "Merged changes from your other devices and saved."
            : "All changes saved to the cloud.",
        );
      } catch (error) {
        setSyncStatus("error");
        setSyncMessage(`Cloud save failed: ${errorMessage(error)}`);
      }
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [state, landTags, user, saveToCloud, markPendingEdits]);

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
        setSyncStatus("syncing");
        setSyncMessage("Saving changes to the cloud…");
        const { merged } = await saveToCloud(user.id);
        setSyncStatus("synced");
        setSyncMessage(
          merged
            ? "Merged changes from your other devices and saved."
            : "All changes saved to the cloud.",
        );
        return;
      }

      // Queued behind any save in flight, so the pull sees that save's row
      // and nothing can record a newer version while this one is applied.
      const userId = user.id;
      const outcome = await runExclusive(async (): Promise<"none" | "applied" | "save"> => {
        // The user signed out (or switched) while this waited in the queue.
        if (reconciledUserIdRef.current !== userId) return "none";
        if (lastSyncedSnapshotRef.current === null) return "none";

        const remote = await pullRemoteState(userId);
        if (!remote) return "none";

        // The server stamps updated_at on every save, so a different value
        // means another device saved since this one last synced.
        const localMeta = syncMetaForUser(readSyncMeta(), userId);
        if (localMeta && remote.updatedAt === localMeta.updatedAt) return "none";

        // An edit may have landed while queued or while the pull was in
        // flight. Save it instead (after this task) — the save merges with the
        // newer cloud copy rather than overwriting it.
        if (hasUnpushedEdits()) return "save";

        const applied = applySyncedState(remote.state);
        recordSynced(applied, userId, remote.updatedAt, remote.state);
        return "applied";
      });

      if (outcome === "save") {
        await saveToCloud(userId);
      } else if (outcome === "applied") {
        setSyncStatus("synced");
        setSyncMessage("Loaded newer data from the cloud.");
      }
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(`Cloud refresh failed: ${errorMessage(error)}`);
    }
  }, [user, applySyncedState, recordSynced, hasUnpushedEdits, saveToCloud, runExclusive]);

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
        await saveToCloud(user.id);
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

    // Keep local data and the sync meta on this device. The meta (merge base
    // included) is tagged with this user's id, so if the same account signs
    // back in its merge still honors deletions made here; reconcile ignores it
    // for any other account (syncMetaForUser) and the next sync replaces it.
    reconciledUserIdRef.current = null;
    lastSyncedSnapshotRef.current = null;
    setAccountSwitch(null);
  }, [user, hasUnpushedEdits, saveToCloud]);

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
          // No cloud row: a fresh start, land tags included.
          const incoming: SyncedState =
            remote?.state ?? withLandTags(createEmptyDeerIntelState(), {});
          const applied = applySyncedState(incoming);
          recordSynced(applied, user.id, remote?.updatedAt, incoming);
          setSyncMessage("Loaded this account's data.");
        } else {
          // The hunter chose to replace this account's cloud copy with this
          // device's data, so this is a deliberate overwrite, not a merge.
          const pending = currentSynced();
          const savedAt = await overwriteRemoteState(user.id, pending);
          recordSynced(pending, user.id, savedAt);
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
    [user, accountSwitch, applySyncedState, recordSynced, currentSynced],
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
