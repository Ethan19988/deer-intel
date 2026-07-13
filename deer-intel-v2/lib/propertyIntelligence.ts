import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Stand } from "@/types/stand";

export type PropertyIntelligenceCard = {
  title: string;
  value: string;
  description: string;
};

type PropertyIntelligenceInput = {
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  hunts: HuntLogEntry[];
  photoRecords: PhotoRecord[];
  pins: MapPin[];
  stands: Stand[];
};

export function getPropertyIntelligenceCards({
  cameras,
  cameraChecks,
  hunts,
  photoRecords,
  pins,
  stands,
}: PropertyIntelligenceInput): PropertyIntelligenceCard[] {
  return [
    getBestStandCard({ hunts, stands }),
    getActiveCameraCard({ cameras, cameraChecks, photoRecords }),
    getRecentDeerActivityCard({ cameras, cameraChecks, hunts, photoRecords }),
    getRecentPhotoCard({ cameras, photoRecords }),
    getCommonWindCard({ cameraChecks, hunts }),
    getHuntObservationCard({ hunts }),
    getAttentionCard({ cameras, cameraChecks, hunts, photoRecords, pins, stands }),
  ];
}

function getBestStandCard({
  hunts,
  stands,
}: Pick<PropertyIntelligenceInput, "hunts" | "stands">) {
  if (stands.length === 0) {
    return card(
      "Best Stands",
      "No stands yet",
      "Add a stand to start learning which spots are worth hunting.",
    );
  }

  if (hunts.length === 0) {
    return card(
      "Best Stands",
      stands[0].name,
      `${stands[0].name} is ready, but no hunts have been logged for this property yet.`,
    );
  }

  const rankedStands = stands
    .map((stand) => {
      const standHunts = hunts.filter(
        (hunt) =>
          hunt.standId === stand.id ||
          hunt.standName.trim().toLowerCase() === stand.name.trim().toLowerCase(),
      );
      const deerSeen = standHunts.reduce((total, hunt) => total + deerCount(hunt), 0);
      const shots = standHunts.filter((hunt) => hunt.shotOpportunity).length;
      const harvests = standHunts.filter((hunt) => hunt.harvest).length;

      return {
        deerSeen,
        harvests,
        score: standHunts.length * 2 + deerSeen + shots * 2 + harvests * 4,
        stand,
        standHunts,
      };
    })
    .sort((left, right) => right.score - left.score);
  const topStand = rankedStands[0];

  if (!topStand || topStand.standHunts.length === 0) {
    return card(
      "Best Stands",
      stands[0].name,
      `${stands[0].name} has not been hunted recently. Log a hunt to start ranking stands.`,
    );
  }

  return card(
    "Best Stands",
    topStand.stand.name,
    `${topStand.standHunts.length} hunts, ${topStand.deerSeen} deer seen, and ${topStand.harvests} harvests recorded here.`,
  );
}

function getActiveCameraCard({
  cameras,
  cameraChecks,
  photoRecords,
}: Pick<PropertyIntelligenceInput, "cameras" | "cameraChecks" | "photoRecords">) {
  if (cameras.length === 0) {
    return card(
      "Most Active Camera Sites",
      "No cameras yet",
      "Add a camera site to start seeing which areas have the most recent activity.",
    );
  }

  const rankedCameras = cameras
    .map((camera) => {
      const checks = cameraChecks.filter((check) => check.cameraId === camera.id);
      const photos = photoRecords.filter((photo) => photo.cameraSiteId === camera.id);
      const latestActivityTime = Math.max(
        ...checks.map((check) => dateTime(check.date)),
        ...photos.map((photo) => dateTime(photo.photoDate)),
        0,
      );

      return {
        camera,
        checks,
        latestActivityTime,
        photos,
        score: checks.length * 2 + photos.length + latestActivityTime / 1000000000000,
      };
    })
    .sort((left, right) => right.score - left.score);
  const topCamera = rankedCameras[0];

  if (!topCamera || (topCamera.checks.length === 0 && topCamera.photos.length === 0)) {
    return card(
      "Most Active Camera Sites",
      cameras[0].name,
      "No camera checks or photo records have been saved yet.",
    );
  }

  return card(
    "Most Active Camera Sites",
    topCamera.camera.name,
    `${topCamera.camera.name} has ${topCamera.checks.length} checks and ${topCamera.photos.length} photo records saved.`,
  );
}

function getRecentDeerActivityCard({
  cameras,
  cameraChecks,
  hunts,
  photoRecords,
}: Pick<
  PropertyIntelligenceInput,
  "cameras" | "cameraChecks" | "hunts" | "photoRecords"
>) {
  const activity = [
    ...cameraChecks
      .filter((check) => check.bucks + check.does + check.fawns > 0)
      .map((check) => ({
        date: check.date,
        description: `${deerCount(check)} deer seen at ${cameraName(cameras, check.cameraId)}.`,
        value: cameraName(cameras, check.cameraId),
      })),
    ...photoRecords
      .filter((photo) => isDeerSpecies(photo.species))
      .map((photo) => ({
        date: photo.photoDate,
        description: `${photo.species} photo record saved at ${cameraName(
          cameras,
          photo.cameraSiteId,
        )}.`,
        value: photo.buckName || photo.species,
      })),
    ...hunts
      .filter((hunt) => deerCount(hunt) > 0)
      .map((hunt) => ({
        date: hunt.date,
        description: `${deerCount(hunt)} deer seen from ${
          hunt.standName || "a stand"
        }.`,
        value: hunt.standName || "Hunt observation",
      })),
  ].sort((left, right) => dateTime(right.date) - dateTime(left.date));

  if (activity.length === 0) {
    return card(
      "Recent Deer Activity",
      "None yet",
      "No buck, doe, fawn, photo, or hunt activity has been recorded yet.",
    );
  }

  return card(
    "Recent Deer Activity",
    activity[0].value,
    `${activity[0].description} Latest date: ${formatDate(activity[0].date)}.`,
  );
}

function getRecentPhotoCard({
  cameras,
  photoRecords,
}: Pick<PropertyIntelligenceInput, "cameras" | "photoRecords">) {
  if (photoRecords.length === 0) {
    return card(
      "Recent Photo Records",
      "No photos yet",
      "Add photo records from camera checks to build a photo history.",
    );
  }

  const latestPhoto = [...photoRecords].sort(
    (left, right) => dateTime(right.photoDate) - dateTime(left.photoDate),
  )[0];
  const buckPhotos = photoRecords.filter(
    (photo) =>
      photo.species.trim().toLowerCase() === "buck" || Boolean(photo.buckName),
  ).length;

  return card(
    "Recent Photo Records",
    latestPhoto.fileName,
    `${latestPhoto.species} at ${cameraName(
      cameras,
      latestPhoto.cameraSiteId,
    )}. ${buckPhotos} buck photo records saved.`,
  );
}

function getCommonWindCard({
  cameraChecks,
  hunts,
}: Pick<PropertyIntelligenceInput, "cameraChecks" | "hunts">) {
  const windDirections = [
    ...hunts.map((hunt) => hunt.windDirection),
    ...cameraChecks.map((check) => check.weatherSnapshot.windDirection),
  ]
    .map(normalizeWind)
    .filter((wind): wind is string => Boolean(wind));

  if (windDirections.length === 0) {
    return card(
      "Common Wind Directions",
      "No wind data",
      "No wind data recorded yet. Add wind to hunts or camera checks.",
    );
  }

  const windCounts = countStrings(windDirections);
  const topWind = [...windCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];

  return card(
    "Common Wind Directions",
    topWind[0],
    `${topWind[1]} records mention ${topWind[0]}. Add more hunt logs to improve this pattern.`,
  );
}

function getHuntObservationCard({
  hunts,
}: Pick<PropertyIntelligenceInput, "hunts">) {
  if (hunts.length === 0) {
    return card(
      "Recent Hunt Observations",
      "No hunts yet",
      "Log hunts to track deer seen, shot chances, harvests, and field notes.",
    );
  }

  const latestHunt = [...hunts].sort(
    (left, right) => dateTime(right.date) - dateTime(left.date),
  )[0];
  const result = latestHunt.harvest
    ? "Harvest recorded"
    : latestHunt.shotOpportunity
      ? "Shot opportunity recorded"
      : `${deerCount(latestHunt)} deer seen`;

  return card(
    "Recent Hunt Observations",
    formatDate(latestHunt.date),
    `${result} from ${latestHunt.standName || "a stand"}. ${shortNote(
      latestHunt.notes,
    )}`,
  );
}

function getAttentionCard({
  cameras,
  cameraChecks,
  hunts,
  photoRecords,
  pins,
  stands,
}: PropertyIntelligenceInput) {
  if (cameras.length === 0) {
    return card(
      "Areas Needing Attention",
      "Add cameras",
      "No camera sites are saved for this property yet.",
    );
  }

  if (stands.length === 0) {
    return card(
      "Areas Needing Attention",
      "Add stands",
      "No stand sites are saved for this property yet.",
    );
  }

  const camerasWithoutChecks = cameras.filter(
    (camera) => !cameraChecks.some((check) => check.cameraId === camera.id),
  );

  if (camerasWithoutChecks.length > 0) {
    return card(
      "Areas Needing Attention",
      camerasWithoutChecks[0].name,
      `${camerasWithoutChecks[0].name} has no camera checks saved yet.`,
    );
  }

  const huntedStandIds = new Set(hunts.map((hunt) => hunt.standId));
  const standsWithoutHunts = stands.filter((stand) => !huntedStandIds.has(stand.id));

  if (standsWithoutHunts.length > 0) {
    return card(
      "Areas Needing Attention",
      standsWithoutHunts[0].name,
      `${standsWithoutHunts[0].name} has not been hunted recently.`,
    );
  }

  if (photoRecords.length === 0) {
    return card(
      "Areas Needing Attention",
      "Add photos",
      "No photo records are saved yet. Add photos from camera checks.",
    );
  }

  if (pins.length === 0) {
    return card(
      "Areas Needing Attention",
      "Add map assets",
      "No bedding, food, water, scrape, rub, trail, parking, or gate assets are pinned yet.",
    );
  }

  return card(
    "Areas Needing Attention",
    "Looks current",
    "This property has cameras, stands, checks, hunts, photos, and map assets started.",
  );
}

function card(
  title: string,
  value: string,
  description: string,
): PropertyIntelligenceCard {
  return {
    title,
    value,
    description,
  };
}

function cameraName(cameras: Camera[], cameraId: string) {
  return cameras.find((camera) => camera.id === cameraId)?.name ?? "Camera Site";
}

function countStrings(values: string[]) {
  return values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);

    return counts;
  }, new Map<string, number>());
}

function dateTime(date: string | undefined) {
  if (!date) return 0;

  const time = Date.parse(date);

  return Number.isNaN(time) ? 0 : time;
}

function deerCount(value: CameraCheck | HuntLogEntry) {
  return value.bucks + value.does + value.fawns;
}

function formatDate(date: string | undefined) {
  return date?.trim() || "No date";
}

function isDeerSpecies(species: string) {
  return ["buck", "doe", "fawn", "deer"].includes(
    species.trim().toLowerCase(),
  );
}

function normalizeWind(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) return "";

  return trimmedValue.toUpperCase();
}

function shortNote(note: string) {
  const trimmedNote = note.trim();

  if (!trimmedNote) return "No notes saved.";
  if (trimmedNote.length <= 90) return trimmedNote;

  return `${trimmedNote.slice(0, 87)}...`;
}
