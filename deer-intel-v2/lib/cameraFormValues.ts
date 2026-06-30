import type { CameraFormValues } from "@/components/cameras/CameraForm";
import type { Camera } from "@/types/camera";

export const EMPTY_CAMERA_FORM_VALUES: CameraFormValues = {
  name: "",
  cameraType: "Standard",
  manufacturer: "",
  model: "",
  status: "Active",
  latitude: "",
  longitude: "",
  locationNotes: "",
  batteryPercent: "",
  sdCardPercent: "",
  signalStrength: "",
  carrier: "",
  lastChecked: "",
  lastTransmission: "",
  notes: "",
};

export function createCameraFromValues({
  id,
  propertyId,
  values,
}: {
  id: string;
  propertyId: string;
  values: CameraFormValues;
}): Camera | null {
  const name = values.name.trim();

  if (!name) return null;

  const cameraType = values.cameraType;

  return {
    id,
    propertyId,
    name,
    cameraType,
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
    status: values.status,
    latitude: parseOptionalNumber(values.latitude),
    longitude: parseOptionalNumber(values.longitude),
    locationNotes: values.locationNotes.trim(),
    batteryPercent: values.batteryPercent.trim(),
    sdCardPercent: values.sdCardPercent.trim(),
    signalStrength:
      cameraType === "Cellular"
        ? optionalTrimmedValue(values.signalStrength)
        : undefined,
    carrier:
      cameraType === "Cellular" ? optionalTrimmedValue(values.carrier) : undefined,
    lastChecked: values.lastChecked,
    lastTransmission:
      cameraType === "Cellular"
        ? optionalTrimmedValue(values.lastTransmission)
        : undefined,
    notes: values.notes.trim(),
  };
}

export function cameraToFormValues(camera: Camera): CameraFormValues {
  return {
    name: camera.name,
    cameraType: camera.cameraType,
    manufacturer: camera.manufacturer,
    model: camera.model,
    status: camera.status,
    latitude: camera.latitude === undefined ? "" : String(camera.latitude),
    longitude: camera.longitude === undefined ? "" : String(camera.longitude),
    locationNotes: camera.locationNotes,
    batteryPercent: camera.batteryPercent,
    sdCardPercent: camera.sdCardPercent,
    signalStrength: camera.signalStrength ?? "",
    carrier: camera.carrier ?? "",
    lastChecked: camera.lastChecked,
    lastTransmission: camera.lastTransmission ?? "",
    notes: camera.notes,
  };
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;

  const parsedValue = Number(trimmedValue);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function optionalTrimmedValue(value: string): string | undefined {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : undefined;
}
