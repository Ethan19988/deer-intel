"use client";

import { useState } from "react";
import StandForm from "@/components/stands/StandForm";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { createDeerIntelId, updateDeerIntelStore } from "@/lib/deerIntelStore";
import {
  createStandFromValues,
  EMPTY_STAND_FORM_VALUES,
} from "@/lib/standFormValues";

// "Add a stand" for the Stands page. Owns its own form state and saves straight
// to the store, so the property command center can stay read-only.
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

  function addStand() {
    const stand = createStandFromValues({
      id: createDeerIntelId("stand"),
      propertyId,
      values,
    });

    if (!stand) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      stands: [...currentState.stands, stand],
    }));
    setValues(EMPTY_STAND_FORM_VALUES);
  }

  return (
    <Card as="div" variant="subtle" id="add-stand">
      <CollapsibleSection
        title="Add a stand"
        description={`Save a stand on ${propertyName} with wind, access, and exit notes`}
        defaultOpen={defaultOpen}
      >
        <StandForm values={values} onChange={setValues} onSubmit={addStand} />
      </CollapsibleSection>
    </Card>
  );
}
