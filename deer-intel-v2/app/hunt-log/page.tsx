"use client";

import { useEffect, useState, type CSSProperties } from "react";
import HuntLogForm from "@/components/hunts/HuntLogForm";
import HuntLogList from "@/components/hunts/HuntLogList";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageShell from "@/components/ui/PageShell";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  createHuntFromValues,
  EMPTY_HUNT_FORM_VALUES,
} from "@/lib/huntFormValues";

export default function HuntLogPage() {
  const state = useDeerIntelStore();
  const [huntValues, setHuntValues] = useState(EMPTY_HUNT_FORM_VALUES);
  const [loadedUrlDefaults, setLoadedUrlDefaults] = useState(false);
  const hasStands = state.stands.length > 0;

  useEffect(() => {
    if (loadedUrlDefaults || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const propertyId = params.get("propertyId") ?? "";
    const standId = params.get("standId") ?? "";
    const standMatchesProperty = state.stands.some(
      (stand) => stand.id === standId && stand.propertyId === propertyId,
    );

    if (standMatchesProperty) {
      setHuntValues((currentValues) => ({
        ...currentValues,
        propertyId,
        standId,
      }));
    }

    setLoadedUrlDefaults(true);
  }, [loadedUrlDefaults, state.stands]);

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
    setHuntValues({
      ...EMPTY_HUNT_FORM_VALUES,
      propertyId: newHunt.propertyId,
      standId: newHunt.standId,
    });
  }

  function getPropertyName(propertyId: string) {
    return (
      state.properties.find((property) => property.id === propertyId)?.name ??
      "Unknown property"
    );
  }

  return (
    <PageShell>
      <header style={headerStyle}>
        <p style={eyebrowStyle}>Hunt Intelligence</p>
        <h1 style={pageTitleStyle}>Hunt Log</h1>
        <p style={introStyle}>
          Save each sit by property and stand so Deer Intel can learn what
          happened, when it happened, and what conditions mattered.
        </p>
      </header>

      <Card as="section" variant="elevated" style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <p style={eyebrowStyle}>Add Hunt</p>
          <h2 style={sectionTitleStyle}>Log a Sit</h2>
        </div>

        {hasStands ? (
          <HuntLogForm
            values={huntValues}
            properties={state.properties}
            stands={state.stands}
            onChange={setHuntValues}
            onSubmit={saveHunt}
          />
        ) : (
          <EmptyState
            title="Add a stand first"
            description="Hunts need a stand. Open a property, add a stand, then come back here to log the sit."
          />
        )}
      </Card>

      <section style={historySectionStyle}>
        <div style={sectionHeaderStyle}>
          <p style={eyebrowStyle}>Field History</p>
          <h2 style={sectionTitleStyle}>Saved Hunts</h2>
        </div>
        <HuntLogList
          hunts={state.hunts}
          getPropertyName={getPropertyName}
          emptyDescription="No hunts logged yet. Save your first sit above."
        />
      </section>
    </PageShell>
  );
}

const headerStyle: CSSProperties = {
  marginBottom: "1.5rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const pageTitleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  fontSize: "3rem",
  lineHeight: 1.05,
};

const introStyle: CSSProperties = {
  maxWidth: "760px",
  margin: "0.85rem 0 0",
  color: "#b8c2b6",
  fontSize: "1.08rem",
  lineHeight: 1.6,
};

const sectionCardStyle: CSSProperties = {
  padding: "1.25rem",
};

const historySectionStyle: CSSProperties = {
  marginTop: "1.75rem",
};

const sectionHeaderStyle: CSSProperties = {
  marginBottom: "1rem",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.45rem",
  lineHeight: 1.2,
};
