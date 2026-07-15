export type PropertyInsight = {
  title: string;
  detail: string;
  badge: string;
};

export function getPropertyInsights({
  activePropertyName,
  cameraCheckCount,
  cameraCount,
  deerProfileCount,
  huntCount,
  lastHuntDate,
  pinCount,
  standCount,
}: {
  activePropertyName?: string;
  cameraCheckCount: number;
  cameraCount: number;
  deerProfileCount: number;
  huntCount: number;
  lastHuntDate: string | null;
  pinCount: number;
  standCount: number;
}): PropertyInsight[] {
  const insights: PropertyInsight[] = [
    activePropertyName
      ? {
          title: "Active property is set",
          detail: `${activePropertyName} is ready for map work, assets, and hunt notes.`,
          badge: "Property",
        }
      : {
          title: "Add your first property",
          detail:
            "Start with one hunting area so Deer Intel can keep tools organized.",
          badge: "Start",
        },
    {
      title: `${pinCount} mapped ${pinCount === 1 ? "location" : "locations"}`,
      detail:
        pinCount > 0
          ? "Map pins are saved. Use the Map section for layers and placement."
          : "Open Map when you are ready to mark sign, trails, access, or gates.",
      badge: "Map",
    },
    {
      title: `${cameraCount} ${cameraCount === 1 ? "camera" : "cameras"}`,
      detail:
        cameraCheckCount > 0
          ? `${cameraCheckCount} camera checks are saved under Cameras.`
          : "Camera intelligence will live under Cameras once checks are added.",
      badge: "Cameras",
    },
    {
      title: `${standCount} ${standCount === 1 ? "stand" : "stands"}`,
      detail:
        huntCount > 0
          ? `${huntCount} hunts are logged for this property.`
          : "Stand wind, access, and history stay under Stands and Hunts.",
      badge: "Stands",
    },
    {
      title: lastHuntDate ? `Last hunt: ${lastHuntDate}` : "No hunts logged yet",
      detail:
        deerProfileCount > 0
          ? `${deerProfileCount} deer profiles are saved under the property workspace.`
          : "Use Hunts and Deer Profiles when field history starts building.",
      badge: "Hunts",
    },
  ];

  return insights.slice(0, 5);
}
