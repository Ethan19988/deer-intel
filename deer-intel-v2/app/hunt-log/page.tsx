"use client";

import { useEffect, useState, type CSSProperties } from "react";
import HuntLogForm from "@/components/hunts/HuntLogForm";
import HuntLogList from "@/components/hunts/HuntLogList";
import ActionCard from "@/components/ui/ActionCard";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
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
    const propertyExists = state.properties.some(
      (property) => property.id === propertyId,
    );
    const standMatchesProperty = state.stands.some(
      (stand) => stand.id === standId && stand.propertyId === propertyId,
    );

    let didCancel = false;

    queueMicrotask(() => {
      if (didCancel) return;

      if (propertyExists) {
        setHuntValues((currentValues) => ({
          ...currentValues,
          propertyId,
          standId: standMatchesProperty ? standId : "",
        }));
      }

      setLoadedUrlDefaults(true);
    });

    return () => {
      didCancel = true;
    };
  }, [loadedUrlDefaults, state.properties, state.stands]);

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
      <Card as="section" variant="elevated" style={sectionCardStyle}>
        <PageHeader
          eyebrow="Hunt Intelligence"
          title="Hunt Log"
          description="Save each sit by property and stand so Deer Intel can learn what happened, when it happened, and what conditions mattered."
          meta={
            <>
              <Badge variant="success">Property Based</Badge>
              <Badge>{state.hunts.length} saved hunts</Badge>
            </>
          }
        />
      </Card>

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

      <Section eyebrow="Next Steps" title="Quick Actions">
        <div style={actionGridStyle}>
          <ActionCard
            href="/properties"
            title="Open Properties"
            description="Choose a property command center and review related records."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/stands"
            title="Review Stands"
            description="Check stand notes before logging or reviewing hunts."
            badge="Available"
            tone="primary"
          />
          <ActionCard
            href="/map"
            title="Open Map"
            description="Look at stand, camera, and asset locations for context."
          />
        </div>
      </Section>

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

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const sectionCardStyle: CSSProperties = {
  padding: "1.25rem",
  marginBottom: "1.5rem",
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

const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};
