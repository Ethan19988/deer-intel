import type { DeerIntelState } from "@/types/deerIntelStore";
import type { DeerProfile, DeerProfileStatus } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { PhotoRecord } from "@/types/photo";
import {
  createDeerProfileFromValues,
  type DeerProfileFormValues,
} from "@/lib/deerProfileFormValues";
import {
  getPhotoBuckNames,
  getPhotoDeerProfileIds,
  photoLinksProfile,
} from "@/lib/photos";

export type DeerProfileSummary = {
  profile: DeerProfile;
  firstSeen: string;
  lastSeen: string;
  photoCount: number;
  sightingCount: number;
};

export function getDeerProfileSummaries({
  profiles,
  photoRecords,
}: {
  profiles: DeerProfile[];
  photoRecords: PhotoRecord[];
}): DeerProfileSummary[] {
  return profiles
    .map((profile) => {
      const profilePhotos = photoRecords.filter((photo) =>
        photoLinksProfile(photo, profile.id),
      );
      const sightingKeys = new Set(
        profilePhotos.map((photo) => photo.cameraCheckId || photo.photoDate),
      );

      // First/last seen span both what you typed and what your linked photos
      // show. Take the earliest of (manual first seen, oldest photo) and the
      // latest of (manual last seen, newest photo) so adding a newer photo
      // pushes "Last Seen" forward instead of being hidden by an older date
      // typed when the profile was created.
      return {
        profile,
        firstSeen: formatDeerProfileDate(
          earlierDate(profile.firstSeen, earliestPhotoDate(profilePhotos)),
        ),
        lastSeen: formatDeerProfileDate(
          laterDate(profile.lastSeen, latestPhotoDate(profilePhotos)),
        ),
        photoCount: profilePhotos.length,
        sightingCount: sightingKeys.size,
      };
    })
    .sort((left, right) =>
      left.profile.nickname.localeCompare(right.profile.nickname),
    );
}

export function formatDeerProfileDate(date: string | undefined) {
  if (!date) return "Not set";

  const time = dateInputTime(date);

  if (Number.isNaN(time)) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

/** The earlier of two dates; ignores empty/unparseable values. */
function earlierDate(left?: string, right?: string): string | undefined {
  return pickDate(left, right, (a, b) => a <= b);
}

/** The later of two dates; ignores empty/unparseable values. */
function laterDate(left?: string, right?: string): string | undefined {
  return pickDate(left, right, (a, b) => a >= b);
}

function pickDate(
  left: string | undefined,
  right: string | undefined,
  keepLeft: (leftTime: number, rightTime: number) => boolean,
): string | undefined {
  const leftTime = left ? dateInputTime(left) : Number.NaN;
  const rightTime = right ? dateInputTime(right) : Number.NaN;
  const leftValid = !Number.isNaN(leftTime);
  const rightValid = !Number.isNaN(rightTime);

  if (leftValid && rightValid) return keepLeft(leftTime, rightTime) ? left : right;
  if (leftValid) return left;
  if (rightValid) return right;

  // Neither parses to a real date — keep a manually typed value if there is one.
  return left || right || undefined;
}

function earliestPhotoDate(photoRecords: PhotoRecord[]) {
  return sortedPhotoDates(photoRecords).at(0);
}

function latestPhotoDate(photoRecords: PhotoRecord[]) {
  return sortedPhotoDates(photoRecords).at(-1);
}

function sortedPhotoDates(photoRecords: PhotoRecord[]) {
  return photoRecords
    .map((photo) => photo.photoDate)
    .filter(Boolean)
    .sort((left, right) => dateInputTime(left) - dateInputTime(right));
}

function dateInputTime(date: string | undefined) {
  if (!date) return Number.NaN;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!dateOnlyMatch) return Date.parse(date);

  const [, year, month, day] = dateOnlyMatch;

  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

// --- Status ------------------------------------------------------------------

/** Unset status (older profiles) is active. */
export function deerProfileStatus(profile: DeerProfile): DeerProfileStatus {
  return profile.status === "harvested" || profile.status === "retired"
    ? profile.status
    : "active";
}

export function isActiveDeerProfile(profile: DeerProfile): boolean {
  return deerProfileStatus(profile) === "active";
}

/** "Harvested Nov 2, 2026" / "Retired"; empty for an active buck. */
export function deerProfileStatusLabel(profile: DeerProfile): string {
  const status = deerProfileStatus(profile);

  if (status === "active") return "";

  const word = status === "harvested" ? "Harvested" : "Retired";

  return profile.statusDate
    ? `${word} ${formatDeerProfileDate(profile.statusDate)}`
    : word;
}

/** Split summaries into the live hit list and the harvested / retired group. */
export function partitionDeerProfileSummaries(summaries: DeerProfileSummary[]): {
  active: DeerProfileSummary[];
  inactive: DeerProfileSummary[];
} {
  const active: DeerProfileSummary[] = [];
  const inactive: DeerProfileSummary[] = [];

  for (const summary of summaries) {
    (isActiveDeerProfile(summary.profile) ? active : inactive).push(summary);
  }

  return { active, inactive };
}

/** A saved profile into the edit form's values. */
export function deerProfileFormValuesFromProfile(
  profile: DeerProfile,
): DeerProfileFormValues {
  return {
    nickname: profile.nickname,
    estimatedAge: profile.estimatedAge,
    firstSeen: profile.firstSeen,
    lastSeen: profile.lastSeen,
    notes: profile.notes,
  };
}

// --- State transforms ----------------------------------------------------------
// Pure, for updateDeerIntelStore(state => ...). Each returns the same state
// object when nothing changes, and leaves records it doesn't touch as-is.

/** Apply the edit form to a saved profile, keeping id, property and status. */
export function updateDeerProfileFromValues(
  state: DeerIntelState,
  profileId: string,
  values: DeerProfileFormValues,
): DeerIntelState {
  const current = state.deerProfiles.find((profile) => profile.id === profileId);

  if (!current) return state;

  const edited = createDeerProfileFromValues({
    id: current.id,
    propertyId: current.propertyId,
    values,
  });

  if (!edited) return state;

  const next: DeerProfile = { ...current, ...edited };
  // A rename has to follow the buck onto his photos' name lists, or the old
  // name lingers there as a second, profile-less buck.
  const renamed = current.nickname !== next.nickname;

  return {
    ...state,
    deerProfiles: state.deerProfiles.map((profile) =>
      profile.id === profileId ? next : profile,
    ),
    photoRecords: renamed
      ? mapChanged(state.photoRecords, (photo) =>
          photoRefersTo(photo, current)
            ? relinkPhoto(photo, {
                removeId: profileId,
                removeName: current.nickname,
                addId: profileId,
                addName: next.nickname,
              })
            : photo,
        )
      : state.photoRecords,
  };
}

/** Mark a buck harvested / retired (with its date), or back to active. */
export function setDeerProfileStatus(
  state: DeerIntelState,
  profileId: string,
  status: DeerProfileStatus,
  statusDate = "",
): DeerIntelState {
  if (!state.deerProfiles.some((profile) => profile.id === profileId)) return state;

  return {
    ...state,
    deerProfiles: state.deerProfiles.map((profile) => {
      if (profile.id !== profileId) return profile;

      const { status: _status, statusDate: _date, ...rest } = profile;
      void _status;
      void _date;

      if (status === "active") return rest;

      const date = statusDate.trim();

      return { ...rest, status, ...(date ? { statusDate: date } : null) };
    }),
  };
}

/**
 * Fold one buck into another: every photo and sit that points at `sourceId`
 * points at `targetId` instead (and carries his name), the notes are combined,
 * the sighting span widens to cover both, and the source profile is removed.
 */
export function mergeDeerProfiles(
  state: DeerIntelState,
  sourceId: string,
  targetId: string,
): DeerIntelState {
  if (sourceId === targetId) return state;

  const source = state.deerProfiles.find((profile) => profile.id === sourceId);
  const target = state.deerProfiles.find((profile) => profile.id === targetId);

  if (!source || !target) return state;

  const merged: DeerProfile = {
    ...target,
    estimatedAge: target.estimatedAge.trim() || source.estimatedAge,
    firstSeen: earlierDate(target.firstSeen, source.firstSeen) ?? "",
    lastSeen: laterDate(target.lastSeen, source.lastSeen) ?? "",
    notes: combineNotes(target.notes, source),
  };

  return {
    ...state,
    deerProfiles: state.deerProfiles
      .filter((profile) => profile.id !== sourceId)
      .map((profile) => (profile.id === targetId ? merged : profile)),
    photoRecords: mapChanged(state.photoRecords, (photo) =>
      photoRefersTo(photo, source)
        ? relinkPhoto(photo, {
            removeId: sourceId,
            removeName: source.nickname,
            addId: targetId,
            addName: target.nickname,
          })
        : photo,
    ),
    hunts: mapChanged(state.hunts, (hunt) =>
      relinkHunt(hunt, sourceId, targetId),
    ),
  };
}

/**
 * Remove a buck's profile. His photos and sits stay; they're only unlinked
 * (his id and name come off them), so the photos remain on their cameras.
 */
export function deleteDeerProfile(
  state: DeerIntelState,
  profileId: string,
): DeerIntelState {
  const profile = state.deerProfiles.find((item) => item.id === profileId);

  if (!profile) return state;

  return {
    ...state,
    deerProfiles: state.deerProfiles.filter((item) => item.id !== profileId),
    photoRecords: mapChanged(state.photoRecords, (photo) =>
      photoRefersTo(photo, profile)
        ? relinkPhoto(photo, { removeId: profileId, removeName: profile.nickname })
        : photo,
    ),
    hunts: mapChanged(state.hunts, (hunt) => relinkHunt(hunt, profileId)),
  };
}

// Linked by id, or named on a photo from his property (the hit list reads
// those name-only tags as him too, so they have to move with him).
function photoRefersTo(photo: PhotoRecord, profile: DeerProfile): boolean {
  if (photoLinksProfile(photo, profile.id)) return true;

  const nickname = profile.nickname.trim().toLowerCase();

  return (
    nickname !== "" &&
    photo.propertyId === profile.propertyId &&
    getPhotoBuckNames(photo).some((name) => name.toLowerCase() === nickname)
  );
}

function relinkPhoto(
  photo: PhotoRecord,
  {
    removeId,
    removeName,
    addId,
    addName,
  }: { removeId: string; removeName: string; addId?: string; addName?: string },
): PhotoRecord {
  // Swap in place so a renamed or merged buck keeps his spot (the first entry
  // is the photo's primary link).
  const ids = dedupe(
    getPhotoDeerProfileIds(photo).map((id) => (id === removeId ? (addId ?? "") : id)),
    (id) => id,
  );
  const dropName = removeName.trim().toLowerCase();
  const nextName = addName?.trim() ?? "";
  const names = dedupe(
    getPhotoBuckNames(photo).map((name) =>
      name.toLowerCase() === dropName ? nextName : name,
    ),
    (name) => name.toLowerCase(),
  );

  // An id-linked photo that never had his name typed still gets it.
  if (nextName && !names.some((name) => name.toLowerCase() === nextName.toLowerCase())) {
    names.push(nextName);
  }

  // Same shape photoFormValues writes: plural lists plus the first entry as
  // the legacy singular field; empty lists are left unset.
  return {
    ...photo,
    deerProfileId: ids[0],
    deerProfileIds: ids.length > 0 ? ids : undefined,
    buckName: names[0],
    buckNames: names.length > 0 ? names : undefined,
  };
}

function dedupe(values: string[], key: (value: string) => string): string[] {
  const seen = new Set<string>();

  return values.filter((value) => {
    const id = key(value);

    if (!value || seen.has(id)) return false;

    seen.add(id);
    return true;
  });
}

function relinkHunt(
  hunt: HuntLogEntry,
  removeId: string,
  addId?: string,
): HuntLogEntry {
  if (!hunt.deerProfileIds?.includes(removeId)) return hunt;

  const ids = hunt.deerProfileIds.filter((id) => id !== removeId);

  if (addId && !ids.includes(addId)) ids.push(addId);

  const { deerProfileIds: _ids, ...rest } = hunt;
  void _ids;

  return ids.length > 0 ? { ...rest, deerProfileIds: ids } : rest;
}

function combineNotes(targetNotes: string, source: DeerProfile): string {
  const kept = targetNotes.trim();
  const added = source.notes.trim();

  if (!added || kept.includes(added)) return kept;

  const block = `From ${source.nickname.trim() || "merged buck"}: ${added}`;

  return kept ? `${kept}\n\n${block}` : block;
}

// Keep the original array when no record changed, so a no-op doesn't look
// like an edit to subscribers.
function mapChanged<Item>(items: Item[], map: (item: Item) => Item): Item[] {
  let changed = false;
  const next = items.map((item) => {
    const mapped = map(item);

    if (mapped !== item) changed = true;

    return mapped;
  });

  return changed ? next : items;
}
