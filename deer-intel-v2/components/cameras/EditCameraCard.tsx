"use client";

import { useState, type CSSProperties } from "react";
import CameraForm from "@/components/cameras/CameraForm";
import Card from "@/components/ui/Card";
import {
  cameraToFormValues,
  createCameraFromValues,
} from "@/lib/cameraFormValues";
import { updateDeerIntelStore } from "@/lib/deerIntelStore";
import type { Camera } from "@/types/camera";

// Edit a camera site in place on the Cameras page (this used to live in the
// property page's Cameras tab).
export default function EditCameraCard({
  camera,
  onDone,
}: {
  camera: Camera;
  onDone: () => void;
}) {
  const [values, setValues] = useState(() => cameraToFormValues(camera));

  function save() {
    const updated = createCameraFromValues({
      id: camera.id,
      propertyId: camera.propertyId,
      values,
    });
    if (!updated) return;

    updateDeerIntelStore((current) => ({
      ...current,
      cameras: current.cameras.map((item) => (item.id === camera.id ? updated : item)),
    }));
    onDone();
  }

  return (
    <Card as="div" variant="subtle" id={`camera-${camera.id}`} style={cardStyle}>
      <h3 style={titleStyle}>Edit {camera.name}</h3>
      <CameraForm
        values={values}
        submitLabel="Save camera"
        onChange={setValues}
        onSubmit={save}
        onCancel={onDone}
      />
    </Card>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.2rem",
};
