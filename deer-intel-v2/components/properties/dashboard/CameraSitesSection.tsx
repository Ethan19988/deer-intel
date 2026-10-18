import type { CSSProperties } from "react";
import CameraCard from "@/components/cameras/CameraCard";
import CameraForm, {
  type CameraFormValues,
} from "@/components/cameras/CameraForm";
import DashboardSection from "@/components/properties/DashboardSection";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import type { Camera } from "@/types/camera";

type CameraSitesSectionProps = {
  cameras: Camera[];
  editCameraValues: CameraFormValues;
  editingCameraId: string | null;
  onEditCameraValuesChange: (values: CameraFormValues) => void;
  onStartEditingCamera: (camera: Camera) => void;
  onSaveEditedCamera: () => void;
  onCancelEditingCamera: () => void;
};

export default function CameraSitesSection({
  cameras,
  editCameraValues,
  editingCameraId,
  onEditCameraValuesChange,
  onStartEditingCamera,
  onSaveEditedCamera,
  onCancelEditingCamera,
}: CameraSitesSectionProps) {
  return (
    <DashboardSection
      id="camera-sites"
      eyebrow="Property Tool"
      title="Camera Sites"
      action={
        <Badge variant="success" style={availableStatusBadgeStyle}>
          {cameras.length} {cameras.length === 1 ? "camera" : "cameras"}
        </Badge>
      }
    >
      {cameras.length === 0 ? (
        <EmptyState description="No cameras on this property yet. Add them from the Cameras page." />
      ) : (
        <div style={cameraListStyle}>
          {cameras.map((camera) => (
            <div key={camera.id}>
              {editingCameraId === camera.id ? (
                <Card as="div" variant="subtle" style={editCameraCardStyle}>
                  <h3 style={subsectionTitleStyle}>Edit Camera</h3>
                  <CameraForm
                    values={editCameraValues}
                    submitLabel="Save Camera"
                    onChange={onEditCameraValuesChange}
                    onSubmit={onSaveEditedCamera}
                    onCancel={onCancelEditingCamera}
                  />
                </Card>
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

const editCameraCardStyle: CSSProperties = {
  border: "1px solid var(--accent-tint-border)",
};

const subsectionTitleStyle: CSSProperties = {
  margin: "0 0 1rem",
  fontSize: "1.05rem",
  lineHeight: 1.25,
};

const cameraListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const availableStatusBadgeStyle: CSSProperties = {
  fontSize: "0.78rem",
};
