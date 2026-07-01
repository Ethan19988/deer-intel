import type { DeerProfile } from "@/types/deerProfile";

export type DeerProfileFormValues = {
  nickname: string;
  estimatedAge: string;
  firstSeen: string;
  lastSeen: string;
  notes: string;
};

export const EMPTY_DEER_PROFILE_FORM_VALUES: DeerProfileFormValues = {
  nickname: "",
  estimatedAge: "",
  firstSeen: "",
  lastSeen: "",
  notes: "",
};

type CreateDeerProfileFromValuesInput = {
  id: string;
  propertyId: string;
  values: DeerProfileFormValues;
};

export function createDeerProfileFromValues({
  id,
  propertyId,
  values,
}: CreateDeerProfileFromValuesInput): DeerProfile | null {
  const nickname = values.nickname.trim();

  if (!propertyId || !nickname) return null;

  return {
    id,
    propertyId,
    nickname,
    estimatedAge: values.estimatedAge.trim(),
    firstSeen: values.firstSeen.trim(),
    lastSeen: values.lastSeen.trim(),
    notes: values.notes.trim(),
  };
}
