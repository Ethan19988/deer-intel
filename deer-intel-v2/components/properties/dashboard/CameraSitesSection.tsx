import type { CSSProperties } from "react";
import CameraCard from "@/components/cameras/CameraCard";
import CameraForm, {
  type CameraFormValues,
} from "@/components/cameras/CameraForm";
import DashboardSection from "@/components/properties/DashboardSection";
import type { Camera } from "@/types/camera";

type CameraSitesSectionProps = {
  cameras: Camera[];
  cameraValues: CameraFormValues;
  editCameraValues: CameraFormValues;
  editingCameraId: string | null;
  onCameraValuesChange: (values: CameraFormValues) => void;
  onEditCameraValuesChange: (values: CameraFormValues) => void;
  onAddCamera: () => void;
  onStartEditingCamera: (camera: Camera) => void;
  onSaveEditedCamera: () => void;
  onCancelEditingCamera: () => void;
};

export default function CameraSitesSection({
  cameras,
  cameraValues,
  editCameraValues,
  editingCameraId,
  onCameraValuesChange,
  onEditCameraValuesChange,
  onAddCamera,
  onStartEditingCamera,
  onSaveEditedCamera,
  onCancelEditingCamera,
}: CameraSitesSectionProps) {
  return (
    <DashboardSection
      id="camera-sites"
      eyebrow="Property Module"
      title="Camera Sites"
      action={
        <span style={availableStatusBadgeStyle}>
          {cameras.length} {cameras.length === 1 ? "camera" : "cameras"}
        </span>
      }
    >
      <div style={cameraFormCardStyle}>
        <h3 style={subsectionTitleStyle}>Add Camera Site</h3>
        <CameraForm
          values={cameraValues}
          submitLabel="Add Camera"
          onChange={onCameraValuesChange}
          onSubmit={onAddCamera}
        />
      </div>

      {cameras.length === 0 ? (
        <p style={emptyStateStyle}>
          No cameras added for this property yet. Add the first camera above to
          start tracking checks, batteries, SD cards, and notes.
        </p>
      ) : (
        <div style={cameraListStyle}>
          {cameras.map((camera) => (
            <div key={camera.id}>
              {editingCameraId === camera.id ? (
                <div style={editCameraCardStyle}>
                  <h3 style={subsectionTitleStyle}>Edit Camera</h3>
                  <CameraForm
                    values={editCameraValues}
                    submitLabel="Save Camera"
                    onChange={onEditCameraValuesChange}
                    onSubmit={onSaveEditedCamera}
                    onCancel={onCancelEditingCamera}
                  />
                </div>
              ) : (
                <CameraCard camera={camera} onEdit={onStartEditingCamera} />
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

const cameraFormCardStyle: CSSProperties = {
  padding: "1rem",
  border: "1px solid #1e2a1e",
  borderRadius: "8px",
  background: "#0a0f0a",
};

const editCameraCardStyle: CSSProperties = {
  ...cameraFormCardStyle,
  border: "1px solid #315135",
};

const subsectionTitleStyle: CSSProperties = {
  margin: "0 0 1rem",
  fontSize: "1.05rem",
  lineHeight: 1.25,
};

const cameraListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginTop: "1rem",
};

const emptyStateStyle: CSSProperties = {
  margin: "1rem 0 0",
  padding: "1rem",
  border: "1px dashed #334533",
  borderRadius: "8px",
  background: "#0a0f0a",
  color: "#b8c2b6",
  lineHeight: 1.5,
};

const availableStatusBadgeStyle: CSSProperties = {
  padding: "0.35rem 0.6rem",
  border: "1px solid #3b6843",
  borderRadius: "8px",
  background: "#18351d",
  color: "#c6f0c6",
  fontSize: "0.78rem",
  fontWeight: 700,
};
