"use client";

import { useState, type CSSProperties } from "react";
import StandForm from "@/components/stands/StandForm";
import { saveStandForm } from "@/components/stands/saveStandForm";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { EMPTY_STAND_FORM_VALUES } from "@/lib/standFormValues";

// "Add a stand" for the Stands page. Owns its own form state and saves straight
// to the store (with its location as a linked map pin), so the property command
// center can stay read-only.
export default function AddStandCard({
  propertyId,
  propertyName,
  defaultOpen = false,
}: {
  propertyId: string;
  propertyName: string;
  defaultOpen?: boolean;
}) {
  const [values, setValues] = useState(EMPTY_STAND_FORM_VALUES);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function addStand() {
    const problem = saveStandForm(values, { propertyId });
    setError(problem);
    if (problem) return;
    setSaved(values.name.trim());
    setValues(EMPTY_STAND_FORM_VALUES);
  }

  return (
    <Card as="div" variant="subtle" id="add-stand">
      <CollapsibleSection
        title="Add a stand"
        description={`Save a stand on ${propertyName} with its location, wind, and access`}
        defaultOpen={defaultOpen}
      >
        {saved ? (
          <p style={savedStyle} role="status">
            Saved {saved}.
          </p>
        ) : null}
        <StandForm
          values={values}
          onChange={(next) => {
            setValues(next);
            setSaved(null);
          }}
          onSubmit={addStand}
          error={error}
        />
      </CollapsibleSection>
    </Card>
  );
}

const savedStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  padding: "0.55rem 0.7rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--success-border)",
  background: "var(--success-bg)",
  color: "var(--success-text)",
  fontSize: "0.9rem",
  fontWeight: 700,
};
