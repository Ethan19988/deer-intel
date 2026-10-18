"use client";

import { useState } from "react";
import CameraForm from "@/components/cameras/CameraForm";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import {
  createCameraFromValues,
  EMPTY_CAMERA_FORM_VALUES,
} from "@/lib/cameraFormValues";
import { createDeerIntelId, updateDeerIntelStore } from "@/lib/deerIntelStore";

// "Add a camera site" for the Cameras page. Owns its own form state and saves
// straight to the store, so the property command center can stay read-only.
export default function AddCameraCard({
  propertyId,
  propertyName,
  defaultOpen = false,
}: {
  propertyId: string;
  propertyName: string;
  defaultOpen?: boolean;
}) {
  const [values, setValues] = useState(EMPTY_CAMERA_FORM_VALUES);

  function addCamera() {
    const camera = createCameraFromValues({
      id: createDeerIntelId("camera"),
      propertyId,
      values,
    });

    if (!camera) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      cameras: [...currentState.cameras, camera],
    }));
    setValues(EMPTY_CAMERA_FORM_VALUES);
  }

  return (
    <Card as="div" variant="subtle" id="add-camera">
      <CollapsibleSection
        title="Add a camera site"
        description={`Save a trail camera on ${propertyName} with its location and notes`}
        defaultOpen={defaultOpen}
      >
        <CameraForm
          values={values}
          submitLabel="Add Camera"
          onChange={setValues}
          onSubmit={addCamera}
        />
      </CollapsibleSection>
    </Card>
  );
}
