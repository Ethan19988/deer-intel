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
  normalizeState,
  saveDeerIntelStore,
  skipNextRecordStamp,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { backupLocalImages, startPhotoUploadQueue } from "@/lib/imageStore";
import { readAllLandTags, replaceAllLandTags, useLandTags } from "@/lib/landTags";
import {
  readAccountSettings,
  replaceAccountSettings,
  useAccountSettings,
} from "@/lib/accountSettings";
import { clearAllMyLocations } from "@/lib/partyClient";
import { setSightingsUploadAccount } from "@/lib/sharedSightings";
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
  isSchemaTooNew,
  mergeSyncedStates,
  overwriteRemoteState,
  pullRemoteState,
  readDeviceOwner,
  readSyncMeta,
  saveWithMerge,
  serializeState,
  splitLandTags,
  SyncSchemaTooNewError,
  syncMetaForMergeRestore,
  syncMetaForReplaceRestore,
  syncMetaForUser,
  UPDATE_APP_TO_SYNC_MESSAGE,
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

// How a restored backup reaches the cloud while signed in: "replace" makes the
// backup the truth everywhere (the next save overwrites the cloud copy, so
// records missing from it are deleted from the cloud and other devices);
// "merge" keeps cloud records the backup lacks.
export type BackupRestoreMode = "replace" | "merge";

type AuthContextValue = {
  configured: boolean;
  authRequired: boolean;
  status: AuthStatus;
  user: AuthUser | null;
  syncStatus: SyncStatus;
  syncMessage: string | null;
  lastSyncedAt: string | null;
  // True once this session's first cloud reconcile finished for the signed-in
  // account (local data is that account's merged data). Party sharing and
  // other uploads wait for it.
  reconciled: boolean;
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
  // Call (and await) right before a backup restore replaces local data.
  prepareBackupRestore: (mode: BackupRestoreMode) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 1500;
// A failed first reconcile (offline at launch, timeout) retries with backoff,
// and right away when the connection or the app comes back.
const RECONCILE_RETRY_MIN_MS = 5_000;
const RECONCILE_RETRY_MAX_MS = 5 * 60_000;
// Sign-out waits at most this long to clear the live party dot.
const SIGN_OUT_CLEANUP_MS = 3_000;

type ReconcileOutcome = "done" | "failed" | "blocked" | "aborted";

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
  const [reconciled, setReconciled] = useState(false);
  // Bumped to retry a failed first reconcile.
  const [reconcileAttempt, setReconcileAttempt] = useState(0);
  // Account-level settings (sharing switches) sync in the cloud row too.
  const accountSettings = useAccountSettings(user?.id);

  // Serialized snapshot of the state we believe is in sync with the cloud.
  // Kept in a ref so applying a pulled state can suppress the echo push. It is
  // null until the first reconcile establishes a baseline, which also gates the
  // push effect so we never upload stale local data before pulling.
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  const reconciledUserIdRef = useRef<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The signed-in account right now (callbacks check it after every await so
  // nothing from a signed-out account is applied).
  const userIdRef = useRef<string | null>(null);
  // While the first reconcile runs: which account, the local state it started
  // from, and whether this device's data may be treated as that account's
  // (false when it holds another account's data). Edits made meanwhile are
  // marked pending only when that is safe.
  const reconcileGuardRef = useRef<{ userId: string; captured: string; safe: boolean } | null>(
    null,
  );
  const reconcileRunningRef = useRef(false);
  const lastReconcileAttemptRef = useRef(0);
  const retryDelayRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The cloud row was written by a newer app build: never push over it.
  const schemaBlockedRef = useRef(false);
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

  // What this device would upload right now: records plus land tags, plus
  // the signed-in account's settings (never another account's).
  const currentSynced = useCallback((): SyncedState => {
    const userId = userIdRef.current;
    return withLandTags(
      stateRef.current,
      readAllLandTags(),
      userId ? readAccountSettings(userId) : undefined,
    );
  }, []);

  // Apply a state from the cloud (or a merge) without triggering a push back
  // up. The store normalizes what it saves, so the baseline is the saved form;
  // otherwise the difference would look like an edit and echo a push. Rows
  // from older builds have no landTags / settings; local ones are left alone
  // then. Records keep the edit stamps they arrive with.
  const applySyncedState = useCallback(
    (synced: SyncedState, userId: string): SyncedState => {
      const { state: records, landTags: tags, accountSettings: settings } =
        splitLandTags(synced);
      const saved = saveDeerIntelStore(records, { stampEdits: false });
      stateRef.current = saved;
      if (tags !== undefined) replaceAllLandTags(tags);
      if (settings !== undefined) replaceAccountSettings(userId, settings);
      const applied = withLandTags(saved, readAllLandTags(), readAccountSettings(userId));
      lastSyncedSnapshotRef.current = serializeState(applied);
      return applied;
    },
    [],
  );

  // The locally normalized form of a cloud copy (what this device would hold
  // after applying it), so a merge base built from it matches local records.
  const normalizedSynced = useCallback((raw: SyncedState, userId: string): SyncedState => {
    const { state: records, landTags: tags, accountSettings: settings } = splitLandTags(raw);
    return withLandTags(
      normalizeState(records) ?? createEmptyDeerIntelState(),
      tags ?? readAllLandTags(),
      settings ?? readAccountSettings(userId),
    );
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

  // Apply a cloud copy that was chosen while the local state was `decidedOn`.
  // If anything changed locally since (an edit landed while the pull was in
  // flight), merge instead of replacing: local edits since `decidedOn` win,
  // and they stay pending so the push effect sends them.
  const applyPulled = useCallback(
    (remote: SyncedState, decidedOn: SyncedState, userId: string, serverTime: string) => {
      const now = currentSynced();
      if (serializeState(now) === serializeState(decidedOn)) {
        const applied = applySyncedState(remote, userId);
        recordSynced(applied, userId, serverTime, remote);
        return;
      }
      applySyncedState(mergeSyncedStates(now, remote, buildSyncBase(decidedOn)), userId);
      // Snapshot = the cloud copy (normalized), so the local edits stay
      // pending and the push effect sends them next.
      recordSynced(normalizedSynced(remote, userId), userId, serverTime, remote);
    },
    [currentSynced, applySyncedState, recordSynced, normalizedSynced],
  );

  // Save this device's current data without overwriting another device's
  // newer saves: a conditional push that, on a version mismatch, merges with
  // the cloud copy by record id and pushes the merge. NOT queued: call it
  // through saveToCloud, or from a task already running in runExclusive.
  const saveNow = useCallback(
    async (userId: string): Promise<{ merged: boolean }> => {
      if (schemaBlockedRef.current) throw new SyncSchemaTooNewError();
      const local = currentSynced();
      const meta = readSyncMeta();
      const ours = meta?.userId === userId ? meta : null;

      // An explicit "Replace everywhere" restore: overwrite, don't merge.
      if (ours?.replaceRemote) {
        const savedAt = await overwriteRemoteState(userId, local);
        recordSynced(local, userId, savedAt);
        return { merged: false };
      }

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
          const applied = applySyncedState(outcome.state, userId);
          recordSynced(applied, userId, outcome.updatedAt, outcome.state);
        } else {
          applySyncedState(
            mergeSyncedStates(now, outcome.state, buildSyncBase(local)),
            userId,
          );
          // Snapshot = the cloud copy (in its locally normalized form, so the
          // merge base matches local records), so the newer local edits stay
          // pending and the push effect sends them next.
          recordSynced(
            normalizedSynced(outcome.state, userId),
            userId,
            outcome.updatedAt,
            outcome.state,
          );
        }
      } else {
        recordSynced(outcome.state, userId, outcome.updatedAt);
      }

      return { merged: outcome.merged };
    },
    [currentSynced, applySyncedState, recordSynced, normalizedSynced],
  );

  // saveNow, queued behind any save already running.
  const saveToCloud = useCallback(
    (userId: string): Promise<{ merged: boolean }> => runExclusive(() => saveNow(userId)),
    [runExclusive, saveNow],
  );

  // Show a sync failure; a row from a newer build blocks pushing for good
  // (until the app is updated).
  const reportSyncError = useCallback((error: unknown, prefix: string) => {
    setSyncStatus("error");
    if (error instanceof SyncSchemaTooNewError) {
      schemaBlockedRef.current = true;
      setSyncMessage(UPDATE_APP_TO_SYNC_MESSAGE);
      return;
    }
    setSyncMessage(`${prefix}: ${errorMessage(error)}`);
  }, []);

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
      ...(ours?.replaceRemote ? { replaceRemote: true } : {}),
    });
  }, []);

  const hasUnpushedEdits = useCallback(
    () =>
      lastSyncedSnapshotRef.current !== null &&
      serializeState(currentSynced()) !== lastSyncedSnapshotRef.current,
    [currentSynced],
  );

  // First sync after a user signs in: compare local vs cloud and pick a safe
  // action. Runs in the save queue so nothing else reads or writes the cloud
  // row meanwhile. The decision is made from the local state as it is AFTER
  // the pull, and applied without awaiting anything in between; edits that
  // land anyway are merged, not replaced (applyPulled).
  const reconcile = useCallback(
    async (activeUser: AuthUser): Promise<ReconcileOutcome> => {
      setSyncStatus("reconciling");
      setSyncMessage("Syncing with the cloud…");

      // Whose data is on this device is decided from local bookkeeping only,
      // before anything (an edit during the pull) can tag it as this account's.
      const storedMeta = readSyncMeta();
      const owner = readDeviceOwner();
      const captured = currentSynced();
      const switched = detectAccountSwitch(captured, owner, storedMeta, activeUser.id);
      reconcileGuardRef.current = {
        userId: activeUser.id,
        captured: serializeState(captured),
        safe: !switched,
      };

      try {
        return await runExclusive(async (): Promise<ReconcileOutcome> => {
          const remote = await pullRemoteState(activeUser.id);
          // Signed out (or another account signed in) while the pull ran.
          if (userIdRef.current !== activeUser.id) return "aborted";

          // This device holds another account's data: don't push it into this
          // account or pull over it. Leave the baseline unset (which gates the
          // push effect and focus refresh) until the hunter chooses.
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
            return "blocked";
          }

          setAccountSwitch(null);

          // A newer app build wrote the cloud row. Pushing (or merging) would
          // strip what it added, so sync stops here until the app is updated.
          if (remote && isSchemaTooNew(remote.state)) {
            schemaBlockedRef.current = true;
            setSyncStatus("error");
            setSyncMessage(UPDATE_APP_TO_SYNC_MESSAGE);
            return "blocked";
          }
          schemaBlockedRef.current = false;

          // Read after the pull: edits made meanwhile may have marked pending.
          // Sign-out keeps the sync meta (and its merge base) so this same
          // account signing back in still honors deletions made on this
          // device. It is only reused for the account it belongs to.
          let localMeta = syncMetaForUser(readSyncMeta(), activeUser.id);

          // If this same account signed out with edits its cloud never got,
          // treat them as unsaved so they are merged in rather than replaced
          // by the cloud copy.
          if (owner?.userId === activeUser.id && owner.unsyncedEdits) {
            localMeta = localMeta
              ? { ...localMeta, pendingLocalEdits: true }
              : { updatedAt: "", pendingLocalEdits: true, userId: activeUser.id };
          }

          const decidedOn = currentSynced();
          const decision = decideReconcile(decidedOn, localMeta, remote);
          let reason = decision.reason;

          if (decision.action === "pull") {
            applyPulled(decision.state, decidedOn, activeUser.id, remote?.updatedAt ?? "");
            // A row from an older build has no land tags; upload this device's.
            if (
              decision.state.landTags === undefined &&
              Object.keys(readAllLandTags()).length > 0
            ) {
              await saveNow(activeUser.id);
            }
          } else if (decision.action === "push") {
            // Conditional on the version this device last saw; merges with
            // the cloud copy instead of overwriting it if another device saved
            // since (or overwrites, for an explicit Replace restore).
            const { merged } = await saveNow(activeUser.id);
            if (merged) reason = "Merged this device's changes with the cloud.";
          } else if (remote) {
            // In sync. Refresh the merge base (older builds didn't keep one).
            recordSynced(decidedOn, activeUser.id, remote.updatedAt, remote.state);
          }

          setSyncStatus("synced");
          setSyncMessage(reason);
          return "done";
        });
      } catch (error) {
        if (userIdRef.current !== activeUser.id) return "aborted";
        reportSyncError(error, "Cloud sync failed");
        return error instanceof SyncSchemaTooNewError ? "blocked" : "failed";
      }
    },
    [
      currentSynced,
      runExclusive,
      applyPulled,
      recordSynced,
      saveNow,
      reportSyncError,
    ],
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
      const previousId = userIdRef.current;
      userIdRef.current = nextUser?.id ?? null;
      setUser((current) =>
        current?.id === nextUser?.id && current?.email === nextUser?.email ? current : nextUser,
      );
      setStatus(session ? "signed-in" : "signed-out");

      if (!nextUser || nextUser.id !== previousId) {
        reconciledUserIdRef.current = null;
        lastSyncedSnapshotRef.current = null;
        reconcileGuardRef.current = null;
        schemaBlockedRef.current = false;
        retryDelayRef.current = 0;
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        setReconciled(false);
      }

      if (!nextUser) {
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

  // Run reconcile once whenever a (new) user signs in, and again (with
  // backoff) after one that failed, e.g. offline at launch.
  useEffect(() => {
    if (!user) return;
    if (reconciledUserIdRef.current === user.id) return;
    if (reconcileRunningRef.current) return;

    const activeUser = user;
    reconciledUserIdRef.current = activeUser.id;
    reconcileRunningRef.current = true;
    lastReconcileAttemptRef.current = Date.now();

    void reconcile(activeUser).then((outcome) => {
      reconcileRunningRef.current = false;
      if (userIdRef.current !== activeUser.id) return;

      if (outcome === "done") {
        retryDelayRef.current = 0;
        setReconciled(true);
        return;
      }
      if (outcome !== "failed") return;

      // Let the next attempt run, after a growing delay (or sooner when the
      // connection or the app comes back).
      reconciledUserIdRef.current = null;
      const delay = Math.min(
        Math.max(RECONCILE_RETRY_MIN_MS, retryDelayRef.current * 2),
        RECONCILE_RETRY_MAX_MS,
      );
      retryDelayRef.current = delay;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        setReconcileAttempt((count) => count + 1);
      }, delay);
    });
    // reconcile reads the latest local state itself; ongoing changes are
    // handled by the push effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, reconcileAttempt]);

  // A failed first reconcile retries right away when the connection or the
  // app comes back (at most once per RECONCILE_RETRY_MIN_MS).
  const retryReconcileSoon = useCallback(() => {
    if (!userIdRef.current) return;
    if (reconciledUserIdRef.current === userIdRef.current) return;
    if (reconcileRunningRef.current) return;
    if (Date.now() - lastReconcileAttemptRef.current < RECONCILE_RETRY_MIN_MS) return;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setReconcileAttempt((count) => count + 1);
  }, []);

  // Party sharing, anonymous sightings and photo uploads all act for the
  // signed-in account; they wait until the local data is that account's.
  const syncReady = !!user && reconciled && accountSwitch === null;

  // Retry photos that couldn't upload yet (taken offline or signed out) now,
  // and again whenever the connection or the app comes back.
  useEffect(() => {
    if (!syncReady) return;
    return startPhotoUploadQueue();
  }, [syncReady]);

  // Anonymous sightings upload only for the account whose data this is.
  useEffect(() => {
    setSightingsUploadAccount(syncReady && user ? user.id : null);
  }, [syncReady, user]);

  // Push local edits to the cloud (debounced) once signed in and reconciled.
  useEffect(() => {
    if (!user) return;

    const snapshot = serializeState(withLandTags(state, landTags, accountSettings));

    // Before the first reconcile has set a baseline nothing is pushed (it
    // could overwrite newer cloud data), but edits made meanwhile are still
    // remembered as pending so a reload or a failed reconcile can't lose
    // them — unless this device holds another account's data.
    if (reconciledUserIdRef.current !== user.id || lastSyncedSnapshotRef.current === null) {
      const guard = reconcileGuardRef.current;
      if (
        guard &&
        guard.userId === user.id &&
        guard.safe &&
        accountSwitch === null &&
        snapshot !== guard.captured
      ) {
        markPendingEdits(user.id);
      }
      return;
    }

    if (snapshot === lastSyncedSnapshotRef.current) return;

    markPendingEdits(user.id);

    // A newer app build owns the cloud row: keep the edits pending locally.
    if (schemaBlockedRef.current) return;

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
        reportSyncError(error, "Cloud save failed");
      }
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [
    state,
    landTags,
    accountSettings,
    user,
    accountSwitch,
    saveToCloud,
    markPendingEdits,
    reportSyncError,
  ]);

  // Pull newer cloud data when the tab regains focus (covers other devices).
  const refreshFromCloud = useCallback(async () => {
    if (!user) return;

    // Wait for the first reconcile; it decides the starting point. One that
    // failed (offline at launch) is retried instead.
    if (reconciledUserIdRef.current !== user.id) {
      retryReconcileSoon();
      return;
    }
    if (lastSyncedSnapshotRef.current === null) return;
    if (schemaBlockedRef.current) return;

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
      const outcome = await runExclusive(
        async (): Promise<"none" | "applied" | "save" | "blocked"> => {
          // The user signed out (or switched) while this waited in the queue.
          if (reconciledUserIdRef.current !== userId) return "none";
          if (lastSyncedSnapshotRef.current === null) return "none";

          const remote = await pullRemoteState(userId);
          if (userIdRef.current !== userId) return "none";
          if (!remote) return "none";

          // The server stamps updated_at on every save, so a different value
          // means another device saved since this one last synced.
          const localMeta = syncMetaForUser(readSyncMeta(), userId);
          if (localMeta && remote.updatedAt === localMeta.updatedAt) return "none";

          if (isSchemaTooNew(remote.state)) return "blocked";

          // An edit may have landed while queued or while the pull was in
          // flight. Save it instead (after this task) — the save merges with
          // the newer cloud copy rather than overwriting it.
          if (hasUnpushedEdits()) return "save";

          applyPulled(remote.state, currentSynced(), userId, remote.updatedAt);
          return "applied";
        },
      );

      if (outcome === "save") {
        await saveToCloud(userId);
      } else if (outcome === "blocked") {
        reportSyncError(new SyncSchemaTooNewError(), "Cloud refresh failed");
      } else if (outcome === "applied") {
        setSyncStatus("synced");
        setSyncMessage("Loaded newer data from the cloud.");
      }
    } catch (error) {
      reportSyncError(error, "Cloud refresh failed");
    }
  }, [
    user,
    applyPulled,
    currentSynced,
    hasUnpushedEdits,
    saveToCloud,
    runExclusive,
    retryReconcileSoon,
    reportSyncError,
  ]);

  useEffect(() => {
    if (!user) return;

    function handleFocus() {
      void refreshFromCloud();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") void refreshFromCloud();
    }

    function handleOnline() {
      retryReconcileSoon();
    }

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user, refreshFromCloud, retryReconcileSoon]);

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

    // Take this account's live party dot down while the session can still
    // delete it (afterwards the request is anonymous and the row would stay).
    // Bounded so a dead connection doesn't hold up signing out.
    if (user) {
      await Promise.race([
        clearAllMyLocations(user.id).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, SIGN_OUT_CLEANUP_MS)),
      ]);
    }

    if (supabase) await supabase.auth.signOut();

    // Keep local data and the sync meta on this device. The meta (merge base
    // included) is tagged with this user's id, so if the same account signs
    // back in its merge still honors deletions made here; reconcile ignores it
    // for any other account (syncMetaForUser) and the next sync replaces it.
    reconciledUserIdRef.current = null;
    lastSyncedSnapshotRef.current = null;
    reconcileGuardRef.current = null;
    setReconciled(false);
    setAccountSwitch(null);
  }, [user, hasUnpushedEdits, saveToCloud]);

  const syncNow = useCallback(async () => {
    if (!user) return;

    // A first reconcile that never finished (or failed) runs again; otherwise
    // reconcile again from the current state.
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    reconciledUserIdRef.current = user.id;
    const outcome = await reconcile(user);
    if (userIdRef.current !== user.id) return;
    if (outcome === "done") {
      retryDelayRef.current = 0;
      setReconciled(true);
    } else if (outcome === "failed") {
      reconciledUserIdRef.current = null;
    }
  }, [user, reconcile]);

  // The hunter's answer to the account-switch prompt.
  const resolveAccountSwitch = useCallback(
    async (choice: AccountSwitchChoice) => {
      if (!user || !accountSwitch) return;
      const userId = user.id;

      setSyncStatus("syncing");
      setSyncMessage(
        choice === "load-account"
          ? "Loading this account's data…"
          : "Moving this device's data into this account…",
      );

      try {
        await runExclusive(async () => {
          if (choice === "load-account") {
            // Replace local data with this account's cloud copy (or a fresh
            // start when it has none). The previous account's synced data
            // stays in its own cloud backup.
            const remote = await pullRemoteState(userId);
            if (userIdRef.current !== userId) return;
            schemaBlockedRef.current = !!remote && isSchemaTooNew(remote.state);
            // No cloud row: a fresh start, land tags and settings included.
            const incoming: SyncedState =
              remote?.state ?? withLandTags(createEmptyDeerIntelState(), {}, {});
            const applied = applySyncedState(incoming, userId);
            recordSynced(applied, userId, remote?.updatedAt, incoming);
            setSyncMessage(
              schemaBlockedRef.current
                ? UPDATE_APP_TO_SYNC_MESSAGE
                : "Loaded this account's data.",
            );
          } else {
            // The hunter chose to replace this account's cloud copy with this
            // device's data, so this is a deliberate overwrite, not a merge.
            // currentSynced leaves out the cached settings: they belong to
            // the previous account.
            const pending = currentSynced();
            const savedAt = await overwriteRemoteState(userId, pending);
            if (userIdRef.current !== userId) return;
            schemaBlockedRef.current = false;
            recordSynced(pending, userId, savedAt);
            // Photo bytes were backed up under the previous account; copy them
            // into this one too so its other devices can see them.
            void backupLocalImages().catch(() => undefined);
            setSyncMessage("Moved this device's data into this account.");
          }
        });

        if (userIdRef.current !== userId) return;
        setAccountSwitch(null);
        setReconciled(true);
        setSyncStatus(schemaBlockedRef.current ? "error" : "synced");
      } catch (error) {
        // Leave the prompt up so the hunter can retry; nothing was replaced.
        setSyncStatus("error");
        setSyncMessage(`Couldn't finish: ${errorMessage(error)}`);
      }
    },
    [user, accountSwitch, runExclusive, applySyncedState, recordSynced, currentSynced],
  );

  // Get sync ready for a backup restore. Runs in the save queue so a cloud
  // save already in flight can't write its merge base back over ours, and
  // drops a pending debounced push (the restore is the next change to send).
  const prepareBackupRestore = useCallback(
    async (mode: BackupRestoreMode) => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }

      if (user) {
        const userId = user.id;
        await runExclusive(async () => {
          // While another account's data is on this device nothing syncs, and
          // this account's meta must not be written over it.
          if (accountSwitch) return;
          writeSyncMeta(
            mode === "merge"
              ? // No merge base and no known cloud version: the next save
                // conflicts, pulls the cloud copy and merges by id instead of
                // deleting.
                syncMetaForMergeRestore(userId)
              : // Explicit replace: the next save overwrites the cloud copy,
                // with or without a merge base on this device.
                syncMetaForReplaceRestore(userId, readSyncMeta()),
          );
        });
      }

      // The restored records are old data, not fresh edits: they keep the
      // edit stamps they were saved with (set last, right before the restore
      // saves, so nothing else consumes it).
      skipNextRecordStamp();
    },
    [user, accountSwitch, runExclusive],
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
      reconciled,
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
      prepareBackupRestore,
    }),
    [
      configured,
      authRequired,
      status,
      user,
      syncStatus,
      syncMessage,
      lastSyncedAt,
      reconciled,
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
      prepareBackupRestore,
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
