import type { Stand } from "@/types/stand";

export type StandFormValues = Pick<
  Stand,
  | "name"
  | "standType"
  | "bestWinds"
  | "avoidWinds"
  | "accessRouteNotes"
  | "exitRouteNotes"
  | "notes"
>;

export const EMPTY_STAND_FORM_VALUES: StandFormValues = {
  name: "",
  standType: "Ladder",
  bestWinds: "",
  avoidWinds: "",
  accessRouteNotes: "",
  exitRouteNotes: "",
  notes: "",
};

export function createStandFromValues({
  id,
  propertyId,
  values,
}: {
  id: string;
  propertyId: string;
  values: StandFormValues;
}): Stand | null {
  const name = values.name.trim();

  if (!name) return null;

  return {
    id,
    propertyId,
    name,
    standType: values.standType,
    bestWinds: values.bestWinds.trim(),
    avoidWinds: values.avoidWinds.trim(),
    accessRouteNotes: values.accessRouteNotes.trim(),
    exitRouteNotes: values.exitRouteNotes.trim(),
    notes: values.notes.trim() || "No notes yet.",
  };
}
