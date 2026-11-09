"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type SetStateAction,
} from "react";
import HuntLogForm from "@/components/hunts/HuntLogForm";
import HuntLogList from "@/components/hunts/HuntLogList";
import SitInProgress from "@/components/hunts/SitInProgress";
import Button from "@/components/ui/Button";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import { StandIcon } from "@/components/ui/FieldIcons";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Tabs from "@/components/ui/Tabs";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  deleteHuntFromState,
  huntFormValuesFromHunt,
  updateHuntInState,
} from "@/lib/deerIntelStoreHunts";
import {
  createHuntFromValues,
  EMPTY_HUNT_FORM_VALUES,
  newHuntFormValues,
  withHuntDeerProfileIds,
  type HuntFormValues,
} from "@/lib/huntFormValues";
import { huntsForProperty, recentStandIds } from "@/lib/hunts";
import {
  clearSitDraft,
  endSitDraft,
  readSitDraft,
  resumeSitDraft,
  saveSitDraft,
  startSitDraft,
  type SitDraft,
} from "@/lib/sitDraft";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { createStandFromPin, findStandForPin, getStandPins } from "@/lib/standPins";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";

export default function HuntLogPage() {
  const state = useDeerIntelStore();
  const [huntValues, setHuntValues] = useState(EMPTY_HUNT_FORM_VALUES);
  const [loadedUrlDefaults, setLoadedUrlDefaults] = useState(false);
  // Editing a saved sit (History tab) uses its own copy of the form values so
  // a half-typed new sit on the Log tab isn't lost.
  const [editingHuntId, setEditingHuntId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState(EMPTY_HUNT_FORM_VALUES);
  // A sit started with "Start sit" and not yet saved. Mirrored to
  // localStorage on every change so an iOS tab reload doesn't lose it.
  const [draft, setDraft] = useState<SitDraft | null>(null);
  // History shows the property named in the link (?propertyId=) or picked in
  // the header, unless the hunter flips to "All properties".
  const [linkedPropertyId, setLinkedPropertyId] = useState("");
  const [showAllProperties, setShowAllProperties] = useState(false);
  const hasStands = state.stands.length > 0;
  const standPins = getStandPins(state.pins);
  const weatherLocation = resolvePropertyWeatherPoint(
    state.properties.find(
      (property) => property.id === huntValues.propertyId,
    ),
    state.cameras.filter(
      (camera) => camera.propertyId === huntValues.propertyId,
    ),
    state.pins.filter((pin) => pin.propertyId === huntValues.propertyId),
  );

  // Stand ids from this property's latest sits that still exist, newest first.
  const lastStandIds = useCallback(
    (propertyId: string) =>
      recentStandIds(
        state.hunts,
        propertyId,
        new Set(
          state.stands
            .filter((stand) => stand.propertyId === propertyId)
            .map((stand) => stand.id),
        ),
      ),
    [state.hunts, state.stands],
  );

  useEffect(() => {
    if (loadedUrlDefaults || typeof window === "undefined") return;

    // Wait for saved data to load so the selected property is known.
    if (state.properties.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    // A link can name the property; otherwise use the one picked in the header.
    const propertyId = params.get("propertyId") || state.selectedPropertyId;
    const standId = params.get("standId") ?? "";
    const propertyExists = state.properties.some(
      (property) => property.id === propertyId,
    );
    const standMatchesProperty = state.stands.some(
      (stand) => stand.id === standId && stand.propertyId === propertyId,
    );
    // No stand in the link: default to the last stand sat on this property.
    const defaultStandId = standMatchesProperty
      ? standId
      : (lastStandIds(propertyId)[0] ?? "");

    let didCancel = false;

    queueMicrotask(() => {
      if (didCancel) return;

      // Today's date with In/Out left to the hunter: "Start sit" stamps In
      // when the sit is live, and a sit logged afterwards picks its times.
      // Set after mount rather than in useState so the server render and the
      // first client render agree.
      setHuntValues((currentValues) =>
        newHuntFormValues(
          new Date(),
          propertyExists
            ? { propertyId, standId: defaultStandId }
            : {
                propertyId: currentValues.propertyId,
                standId: currentValues.standId,
              },
          { startNow: false },
        ),
      );

      setDraft(readSitDraft());
      if (params.get("propertyId") && propertyExists) {
        setLinkedPropertyId(propertyId);
      }
      setLoadedUrlDefaults(true);
    });

    return () => {
      didCancel = true;
    };
  }, [
    loadedUrlDefaults,
    state.properties,
    state.stands,
    state.selectedPropertyId,
    lastStandIds,
  ]);

  // Keep the stored draft in step with every change (counts, review edits).
  // Clearing goes through clearSitDraft explicitly.
  useEffect(() => {
    if (draft) saveSitDraft(draft);
  }, [draft]);

  function freshHuntValues(keep: Pick<HuntFormValues, "propertyId" | "standId">) {
    return newHuntFormValues(new Date(), keep, { startNow: false });
  }

  function startSit() {
    const stand = state.stands.find((item) => item.id === huntValues.standId);
    if (!huntValues.propertyId || !stand) return;

    // Carries whatever the form already has (weather auto-filled for now,
    // counts, notes); the date and In become now.
    setDraft(startSitDraft(huntValues, stand.name, new Date()));
  }

  function updateDraftCount(field: "bucks" | "does" | "fawns", value: string) {
    setDraft((current) =>
      current ? { ...current, values: { ...current.values, [field]: value } } : current,
    );
  }

  // The review form edits the draft's values in place, so a reload during
  // review comes back to the same filled-in form.
  const updateDraftValues = useCallback(
    (action: SetStateAction<HuntFormValues>) => {
      setDraft((current) => {
        if (!current) return current;
        const values =
          typeof action === "function" ? action(current.values) : action;
        return { ...current, values };
      });
    },
    [],
  );

  function endSit() {
    setDraft((current) => (current ? endSitDraft(current, new Date()) : current));
  }

  function backToSit() {
    setDraft((current) => (current ? resumeSitDraft(current) : current));
  }

  function discardSit() {
    clearSitDraft();
    setDraft(null);
  }

  function saveDraftSit() {
    if (!draft) return;

    const newHunt = createHuntFromValues({
      id: createDeerIntelId("hunt"),
      values: draft.values,
      stands: state.stands,
      // The stand may have been deleted while the sit ran; keep its name.
      fallbackStandName: draft.standName,
    });

    if (!newHunt) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      hunts: [...currentState.hunts, newHunt],
    }));
    clearSitDraft();
    setDraft(null);
    setHuntValues(
      freshHuntValues({ propertyId: newHunt.propertyId, standId: newHunt.standId }),
    );
  }

  function saveHunt() {
    const newHunt = createHuntFromValues({
      id: createDeerIntelId("hunt"),
      values: huntValues,
      stands: state.stands,
    });

    if (!newHunt) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      hunts: [...currentState.hunts, newHunt],
    }));
    setHuntValues(
      freshHuntValues({ propertyId: newHunt.propertyId, standId: newHunt.standId }),
    );
  }

  const editingHunt = editingHuntId
    ? (state.hunts.find((hunt) => hunt.id === editingHuntId) ?? null)
    : null;

  function startEditingHunt(hunt: HuntLogEntry) {
    setEditValues(withHuntDeerProfileIds(huntFormValuesFromHunt(hunt), hunt));
    setEditingHuntId(hunt.id);
  }

  function cancelEditingHunt() {
    setEditingHuntId(null);
    setEditValues(EMPTY_HUNT_FORM_VALUES);
  }

  function saveEditedHunt() {
    if (!editingHuntId) return;

    const updatedHunt = createHuntFromValues({
      id: editingHuntId,
      values: editValues,
      stands: state.stands,
      // If this sit's stand has since been deleted, keep its saved stand.
      fallbackStandName: editingHunt?.standName ?? "",
    });

    if (!updatedHunt) return;

    updateDeerIntelStore((currentState) =>
      updateHuntInState(
        currentState,
        // Keep a blood-trail entry a blood trail (it isn't counted as a sit).
        editingHunt?.kind ? { ...updatedHunt, kind: editingHunt.kind } : updatedHunt,
      ),
    );
    cancelEditingHunt();
  }

  function deleteHunt(huntId: string) {
    updateDeerIntelStore((currentState) =>
      deleteHuntFromState(currentState, huntId),
    );
    if (editingHuntId === huntId) cancelEditingHunt();
  }

  function convertPinToStand(pin: MapPin) {
    // A double-tap (common on mobile before the list re-renders) must not save
    // the same pin as a stand twice — reuse the existing stand if there is one.
    const existingStand = findStandForPin(state.stands, pin.id);

    if (existingStand) {
      setHuntValues((currentValues) => ({
        ...currentValues,
        propertyId: existingStand.propertyId,
        standId: existingStand.id,
      }));
      return;
    }

    const newStand = createStandFromPin({
      id: createDeerIntelId("stand"),
      pin,
    });

    // Guard against double-taps: if this pin was already promoted (even by a
    // tap that hasn't re-rendered yet), reuse that stand instead of adding a
    // duplicate. The check runs inside the updater so it sees the latest state.
    let standIdToSelect = newStand.id;

    updateDeerIntelStore((currentState) => {
      const alreadyPromoted = findStandForPin(currentState.stands, pin.id);

      if (alreadyPromoted) {
        standIdToSelect = alreadyPromoted.id;
        return currentState;
      }

      return {
        ...currentState,
        stands: [...currentState.stands, newStand],
      };
    });

    setHuntValues((currentValues) => ({
      ...currentValues,
      propertyId: newStand.propertyId,
      standId: standIdToSelect,
    }));
  }

  function getPropertyName(propertyId: string) {
    return (
      state.properties.find((property) => property.id === propertyId)?.name ??
      "Unknown property"
    );
  }

  const canLogOrConvert = hasStands || standPins.length > 0;

  const draftWeatherLocation = draft
    ? resolvePropertyWeatherPoint(
        state.properties.find((property) => property.id === draft.values.propertyId),
        state.cameras.filter((camera) => camera.propertyId === draft.values.propertyId),
        state.pins.filter((pin) => pin.propertyId === draft.values.propertyId),
      )
    : null;
  const canStartSit = Boolean(
    huntValues.propertyId &&
      state.stands.some(
        (stand) =>
          stand.id === huntValues.standId &&
          stand.propertyId === huntValues.propertyId,
      ),
  );

  const logTab = (
    <section style={formCardStyle} aria-label="Log a sit">
      {(canLogOrConvert || draft) && !loadedUrlDefaults ? (
        // One frame while today's date, property, and any running sit load,
        // instead of a form that flashes blank fields.
        <div style={{ minHeight: "28rem" }} aria-busy="true" />
      ) : draft && !draft.endedAt ? (
        <SitInProgress
          draft={draft}
          onCountChange={updateDraftCount}
          onEnd={endSit}
          onDiscard={discardSit}
        />
      ) : draft ? (
        <>
          <p style={reviewEyebrowStyle}>Review sit · {draft.standName || "Stand"}</p>
          <HuntLogForm
            values={draft.values}
            properties={state.properties}
            stands={state.stands}
            deerProfiles={state.deerProfiles}
            weatherLocation={draftWeatherLocation}
            getPropertyName={getPropertyName}
            getRecentStandIds={lastStandIds}
            missingStandName={draft.standName}
            onChange={updateDraftValues}
            onSubmit={saveDraftSit}
            onCancel={backToSit}
            cancelLabel="Back to sit"
          />
        </>
      ) : canLogOrConvert ? (
        <HuntLogForm
          values={huntValues}
          properties={state.properties}
          stands={state.stands}
          deerProfiles={state.deerProfiles}
          standPins={standPins}
          weatherLocation={weatherLocation}
          getPropertyName={getPropertyName}
          getRecentStandIds={lastStandIds}
          onConvertPin={convertPinToStand}
          onChange={setHuntValues}
          onSubmit={saveHunt}
          showPeriodChips
          submitVariant="secondary"
          afterStand={
            <div style={startSitStyle}>
              <Button
                type="button"
                fullWidth
                disabled={!canStartSit}
                onClick={startSit}
                style={startSitButtonStyle}
              >
                Start sit
              </Button>
              <p style={startSitHintStyle}>
                In the stand now? Start the sit, count deer as they come, and
                end it when you climb down. Logging one from earlier? Fill in
                the times below and save.
              </p>
            </div>
          }
        />
      ) : (
        <EmptyState
          illustration={<StandIcon size={30} />}
          title="Add a stand first"
          description="Every sit is logged from a stand. Add one, then come back here to log the sit."
          action={
            <Link href="/stands#add-stand" className="di-link-btn di-link-btn--primary">
              Add a stand
            </Link>
          }
        />
      )}
    </section>
  );

  const editWeatherLocation = resolvePropertyWeatherPoint(
    state.properties.find((property) => property.id === editValues.propertyId),
    state.cameras.filter((camera) => camera.propertyId === editValues.propertyId),
    state.pins.filter((pin) => pin.propertyId === editValues.propertyId),
  );

  const historyPropertyId = [linkedPropertyId, state.selectedPropertyId].find(
    (id) => id && state.properties.some((property) => property.id === id),
  );
  const historyShowsAll = showAllProperties || !historyPropertyId;
  const historyHunts = huntsForProperty(
    state.hunts,
    historyShowsAll ? null : historyPropertyId,
  );
  const historyPropertyName = historyPropertyId
    ? getPropertyName(historyPropertyId)
    : "";

  const historyTab = (
    <div style={historyStyle}>
      {historyPropertyId && state.properties.length > 1 ? (
        <div style={historyScopeStyle}>
          <span style={historyScopeLabelStyle}>
            {historyShowsAll
              ? "Showing sits from all properties"
              : `Showing sits on ${historyPropertyName}`}
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowAllProperties((current) => !current)}
          >
            {historyShowsAll ? `Only ${historyPropertyName}` : "All properties"}
          </Button>
        </div>
      ) : null}
      <HuntLogList
        hunts={historyHunts}
        getPropertyName={getPropertyName}
        showPropertyName={historyShowsAll && state.properties.length > 1}
        emptyDescription={
          historyShowsAll
            ? "No sits logged yet. Save your first sit from the Log a sit tab."
            : `No sits logged on ${historyPropertyName} yet. Save one from the Log a sit tab.`
        }
        onEdit={startEditingHunt}
        onDelete={deleteHunt}
        editingHuntId={editingHuntId}
        editor={
          editingHuntId ? (
            <HuntLogForm
              values={editValues}
              properties={state.properties}
              stands={state.stands}
              deerProfiles={state.deerProfiles}
              weatherLocation={editWeatherLocation}
              getPropertyName={getPropertyName}
              onChange={setEditValues}
              onSubmit={saveEditedHunt}
              onCancel={cancelEditingHunt}
              submitLabel="Save changes"
              autoFillWeather={false}
              missingStandName={editingHunt?.standName || "Saved stand"}
            />
          ) : null
        }
      />
    </div>
  );

  return (
    <PageShell>
      <PageHeader eyebrow="Hunt log" title="Log a sit" />

      <Tabs
        urlParam="tab"
        items={[
          { id: "log", label: "Log a sit", content: logTab },
          {
            id: "history",
            label: "History",
            badge: historyHunts.length,
            content: historyTab,
          },
        ]}
      />
    </PageShell>
  );
}

const historyStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const historyScopeStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const historyScopeLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.88rem",
};

const formCardStyle: CSSProperties = {
  maxWidth: "640px",
};

const reviewEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-2-text, var(--accent-2))",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.68rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const startSitStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
};

const startSitButtonStyle: CSSProperties = {
  minHeight: "56px",
  fontSize: "1.35rem",
};

const startSitHintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.88rem",
  lineHeight: 1.45,
};
