export type HuntingMode = "review" | "scouting" | "hunting";

export type HuntingModeOption = {
  id: HuntingMode;
  label: string;
  description: string;
};

export const HUNTING_MODE_STORAGE_KEY = "deer-intel:hunting-mode";

export const HUNTING_MODE_OPTIONS: HuntingModeOption[] = [
  {
    id: "review",
    label: "Review",
    description: "Full Deer Intel experience.",
  },
  {
    id: "scouting",
    label: "Scouting",
    description: "Map-first field work.",
  },
  {
    id: "hunting",
    label: "Hunting",
    description: "Essentials only.",
  },
];

export function isHuntingMode(value: string | null): value is HuntingMode {
  return value === "review" || value === "scouting" || value === "hunting";
}
