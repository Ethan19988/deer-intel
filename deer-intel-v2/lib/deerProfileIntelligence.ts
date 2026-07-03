import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";

export type DeerProfileNoteMention = {
  source: string;
  detail: string;
};

export type DeerProfilePattern = {
  title: string;
  detail: string;
};

export type DeerProfileIntelligence = {
  mostRecentSighting: DeerProfilePattern;
  associatedCameraSites: string[];
  associatedProperties: string[];
  commonTimeOfDay: DeerProfilePattern;
  commonArea: DeerProfilePattern;
  maturityStatus: DeerProfilePattern;
  notesMentioningDeer: DeerProfileNoteMention[];
  linkedPhotoCount: number;
  sightingCount: number;
  hasSightings: boolean;
  hasLinkedPhotoRecords: boolean;
  hasPatternData: boolean;
};

type DeerProfileIntelligenceInput = {
  profile: DeerProfile;
  propertyName: string;
  cameras: Camera[];
  photoRecords: PhotoRecord[];
  cameraChecks: CameraCheck[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
};

export function getDeerProfileIntelligence({
  profile,
  propertyName,
  cameras,
  photoRecords,
  cameraChecks,
  hunts,
  pins,
}: DeerProfileIntelligenceInput): DeerProfileIntelligence {
  const cameraNameById = new Map(
    cameras.map((camera) => [camera.id, camera.name]),
  );
  const linkedPhotos = photoRecords.filter(
    (photo) => photo.deerProfileId === profile.id,
  );
  const mentionedPhotos = photoRecords.filter(
    (photo) =>
      photo.deerProfileId !== profile.id &&
      recordMentionsProfile(profile, [
        photo.fileName,
        photo.buckName,
        photo.notes,
      ]),
  );
  const sightingPhotos = uniquePhotos([...linkedPhotos, ...mentionedPhotos]);
  const noteMentions = getNoteMentions({
    profile,
    photoRecords,
    cameraChecks,
    hunts,
    pins,
  });
  const mostRecentSighting = getMostRecentSighting({
    profile,
    sightingPhotos,
    cameraNameById,
  });
  const associatedCameraSites = getAssociatedCameraSites(
    sightingPhotos,
    cameraNameById,
  );
  const commonTimeOfDay = getCommonTimeOfDay(sightingPhotos);
  const commonArea = getCommonArea({
    profile,
    sightingPhotos,
    cameraNameById,
    pins,
  });
  const maturityStatus = getMaturityStatus({ profile, sightingPhotos });
  const hasSightings =
    sightingPhotos.length > 0 ||
    Boolean(profile.firstSeen || profile.lastSeen) ||
    noteMentions.length > 0;
  const hasPatternData =
    associatedCameraSites.length > 0 ||
    commonTimeOfDay.title !== "No time pattern yet" ||
    commonArea.title !== "No common area yet" ||
    maturityStatus.title !== "Status not recorded";

  return {
    mostRecentSighting,
    associatedCameraSites,
    associatedProperties: propertyName ? [propertyName] : [],
    commonTimeOfDay,
    commonArea,
    maturityStatus,
    notesMentioningDeer: noteMentions,
    linkedPhotoCount: linkedPhotos.length,
    sightingCount: getSightingCount(sightingPhotos, profile, noteMentions),
    hasSightings,
    hasLinkedPhotoRecords: linkedPhotos.length > 0,
    hasPatternData,
  };
}

function getMostRecentSighting({
  profile,
  sightingPhotos,
  cameraNameById,
}: {
  profile: DeerProfile;
  sightingPhotos: PhotoRecord[];
  cameraNameById: Map<string, string>;
}): DeerProfilePattern {
  const latestPhoto = [...sightingPhotos].sort(
    (left, right) => dateInputTime(right.photoDate) - dateInputTime(left.photoDate),
  )[0];

  if (latestPhoto) {
    const cameraName =
      cameraNameById.get(latestPhoto.cameraSiteId) ?? "Unknown camera site";

    return {
      title: formatDate(latestPhoto.photoDate),
      detail: `${latestPhoto.fileName} at ${cameraName}.`,
    };
  }

  if (profile.lastSeen) {
    return {
      title: formatDate(profile.lastSeen),
      detail: "Last seen date recorded on the deer profile.",
    };
  }

  if (profile.firstSeen) {
    return {
      title: formatDate(profile.firstSeen),
      detail: "First seen date recorded on the deer profile.",
    };
  }

  return {
    title: "No sightings yet",
    detail: "Link photo records or add dates to start this deer's history.",
  };
}

function getAssociatedCameraSites(
  sightingPhotos: PhotoRecord[],
  cameraNameById: Map<string, string>,
) {
  const cameraNames = new Set<string>();

  sightingPhotos.forEach((photo) => {
    const cameraName = cameraNameById.get(photo.cameraSiteId);

    if (cameraName) cameraNames.add(cameraName);
  });

  return [...cameraNames].sort((left, right) => left.localeCompare(right));
}

function getCommonTimeOfDay(sightingPhotos: PhotoRecord[]): DeerProfilePattern {
  if (sightingPhotos.length === 0) {
    return {
      title: "No time pattern yet",
      detail: "Link photo records to this deer to start checking time patterns.",
    };
  }

  const buckets = new Map<string, number>();

  sightingPhotos.forEach((photo) => {
    const bucket = photoTimeBucket(photo.photoDate);

    if (!bucket) return;

    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  });

  const topBucket = [...buckets.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];

  if (!topBucket) {
    return {
      title: "No time pattern yet",
      detail: "Current photo records use dates only. Photo times can improve this later.",
    };
  }

  return {
    title: topBucket[0],
    detail: `${topBucket[1]} linked photo records fall in this window.`,
  };
}

function getCommonArea({
  profile,
  sightingPhotos,
  cameraNameById,
  pins,
}: {
  profile: DeerProfile;
  sightingPhotos: PhotoRecord[];
  cameraNameById: Map<string, string>;
  pins: MapPin[];
}): DeerProfilePattern {
  const cameraCounts = new Map<string, number>();

  sightingPhotos.forEach((photo) => {
    const cameraName = cameraNameById.get(photo.cameraSiteId);

    if (!cameraName) return;

    cameraCounts.set(cameraName, (cameraCounts.get(cameraName) ?? 0) + 1);
  });

  const topCamera = [...cameraCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];

  if (topCamera) {
    return {
      title: topCamera[0],
      detail: `${topCamera[1]} linked photo records are tied to this camera site.`,
    };
  }

  const mentionedPin = pins.find((pin) => recordMentionsProfile(profile, [pin.notes]));

  if (mentionedPin) {
    return {
      title: mentionedPin.type,
      detail: mentionedPin.notes,
    };
  }

  return {
    title: "No common area yet",
    detail: "Linked camera sites or asset notes can reveal this later.",
  };
}

function getMaturityStatus({
  profile,
  sightingPhotos,
}: {
  profile: DeerProfile;
  sightingPhotos: PhotoRecord[];
}): DeerProfilePattern {
  if (profile.estimatedAge.trim()) {
    return {
      title: profile.estimatedAge,
      detail: "Estimated age recorded on this deer profile.",
    };
  }

  const status = getStatusFromText([
    profile.notes,
    ...sightingPhotos.flatMap((photo) => [
      photo.fileName,
      photo.buckName,
      photo.notes,
    ]),
  ]);

  if (status) {
    return {
      title: status,
      detail: "Status found in existing notes or photo labels.",
    };
  }

  return {
    title: "Status not recorded",
    detail: "Add an estimated age or notes like mature, young, target, or shooter.",
  };
}

function getNoteMentions({
  profile,
  photoRecords,
  cameraChecks,
  hunts,
  pins,
}: {
  profile: DeerProfile;
  photoRecords: PhotoRecord[];
  cameraChecks: CameraCheck[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
}): DeerProfileNoteMention[] {
  const mentions: DeerProfileNoteMention[] = [];

  if (profile.notes.trim()) {
    mentions.push({
      source: "Profile notes",
      detail: profile.notes,
    });
  }

  photoRecords.forEach((photo) => {
    if (recordMentionsProfile(profile, [photo.fileName, photo.buckName, photo.notes])) {
      mentions.push({
        source: "Photo record",
        detail: [photo.fileName, photo.notes].filter(Boolean).join(": "),
      });
    }
  });

  cameraChecks.forEach((check) => {
    if (recordMentionsProfile(profile, [check.notes, check.otherWildlife])) {
      mentions.push({
        source: "Camera check",
        detail: check.notes || check.otherWildlife,
      });
    }
  });

  hunts.forEach((hunt) => {
    if (recordMentionsProfile(profile, [hunt.notes])) {
      mentions.push({
        source: "Hunt log",
        detail: hunt.notes,
      });
    }
  });

  pins.forEach((pin) => {
    if (recordMentionsProfile(profile, [pin.notes])) {
      mentions.push({
        source: `${pin.type} asset`,
        detail: pin.notes,
      });
    }
  });

  return uniqueMentions(mentions).slice(0, 5);
}

function getSightingCount(
  sightingPhotos: PhotoRecord[],
  profile: DeerProfile,
  noteMentions: DeerProfileNoteMention[],
) {
  const sightingKeys = new Set(
    sightingPhotos.map((photo) => photo.cameraCheckId || photo.photoDate || photo.id),
  );

  if (profile.firstSeen) sightingKeys.add(`first-${profile.firstSeen}`);
  if (profile.lastSeen) sightingKeys.add(`last-${profile.lastSeen}`);

  return Math.max(sightingKeys.size, noteMentions.length > 0 ? 1 : 0);
}

function uniquePhotos(photoRecords: PhotoRecord[]) {
  const seenPhotoIds = new Set<string>();

  return photoRecords.filter((photo) => {
    if (seenPhotoIds.has(photo.id)) return false;

    seenPhotoIds.add(photo.id);

    return true;
  });
}

function uniqueMentions(mentions: DeerProfileNoteMention[]) {
  const seenMentions = new Set<string>();

  return mentions.filter((mention) => {
    const key = `${mention.source}-${mention.detail}`;

    if (seenMentions.has(key)) return false;

    seenMentions.add(key);

    return true;
  });
}

function recordMentionsProfile(profile: DeerProfile, values: Array<string | undefined>) {
  const nickname = profile.nickname.trim().toLowerCase();

  if (!nickname) return false;

  return values.some((value) => value?.toLowerCase().includes(nickname));
}

function getStatusFromText(values: Array<string | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();

  if (!text) return "";
  if (text.includes("shooter") || text.includes("target")) return "Target buck";
  if (text.includes("mature") || text.includes("old buck")) return "Mature";
  if (text.includes("young")) return "Young";
  if (text.includes("nocturnal")) return "Mostly nocturnal";

  return "";
}

function photoTimeBucket(date: string) {
  const hour = dateHour(date);

  if (hour === null) return null;
  if (hour >= 5 && hour <= 10) return "Morning";
  if (hour >= 11 && hour <= 14) return "Midday";
  if (hour >= 15 && hour <= 20) return "Evening";

  return "Night";
}

function dateHour(date: string) {
  if (!date || /^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const time = Date.parse(date);

  if (Number.isNaN(time)) return null;

  return new Date(time).getHours();
}

function formatDate(date: string | undefined) {
  if (!date) return "Not set";

  const time = dateInputTime(date);

  if (time <= 0) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

function dateInputTime(date: string | undefined) {
  if (!date) return 0;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;

    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const parsedTime = Date.parse(date);

  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}
