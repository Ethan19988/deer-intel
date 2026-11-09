import { createDeerIntelId, updateDeerIntelStore } from "@/lib/deerIntelStore";
import {
  readStandLocation,
  standFromValues,
  validateStandForm,
  type StandFormValues,
} from "@/lib/standFormValues";
import { saveStandWithLocation } from "@/lib/standSave";

/**
 * Save the add/edit stand form to the store: the whole stand record, plus its
 * location as a linked "Stand" map pin. Returns a message when the form can't
 * be saved, else null.
 */
export function saveStandForm(
  values: StandFormValues,
  target: { id?: string; propertyId: string; sourcePinId?: string },
): string | null {
  const error = validateStandForm(values);
  if (error) return error;

  const location = readStandLocation(values);
  const stand = standFromValues({
    id: target.id ?? createDeerIntelId("stand"),
    propertyId: target.propertyId,
    values,
    sourcePinId: target.sourcePinId,
  });
  if (!stand || !location.ok) return "Check the stand details and try again.";

  const newPinId = createDeerIntelId("pin");
  const createdAt = new Date().toISOString();
  updateDeerIntelStore((state) =>
    saveStandWithLocation(state, { stand, location: location.point, newPinId, createdAt }),
  );
  return null;
}
