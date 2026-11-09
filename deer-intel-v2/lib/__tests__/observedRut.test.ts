import { describe, expect, it } from "vitest";
import {
  OBSERVED_RUT_NOT_ENOUGH,
  countObservedRutWindows,
  localDayKey,
  observedRutLead,
  readObservedRut,
  type ObservedRutInput,
} from "@/lib/observedRut";
import { buildAiScoutObservedRut } from "@/lib/aiScoutSit";
import { buildAiScoutRequestContext, EMPTY_AI_SCOUT_CONDITIONS } from "@/lib/aiScoutContext";
import { rutPhaseSteps } from "@/lib/seasonCalendar";
import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Property } from "@/types/property";

// Mon Nov 9 2026, midday. Day 0 of the window.
const now = new Date(2026, 10, 9, 12, 0);
// Sunrise 6:50, sunset 4:55 → PA legal light 6:20 AM – 5:25 PM.
const sunFor = () => ({ sunrise: 6 * 60 + 50, sunset: 16 * 60 + 55 });

let seq = 0;
function photo(
  daysAgo: number,
  clock: string | null,
  species: string,
  extra: Partial<PhotoRecord> = {},
): PhotoRecord {
  const day = new Date(2026, 10, 9 - daysAgo);
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  seq += 1;
  return {
    id: `ph${seq}`,
    propertyId: "p1",
    cameraSiteId: "c1",
    cameraCheckId: "",
    fileName: "",
    photoDate: clock ? `${key}T${clock}` : key,
    captureTimeSource: clock ? "stamp" : "stampDate",
    species,
    notes: "",
    createdAt: "",
    ...extra,
  };
}

function many(count: number, make: (index: number) => PhotoRecord): PhotoRecord[] {
  return Array.from({ length: count }, (_, index) => make(index));
}

function sit(daysAgo: number, bucks: number, does: number, notes = ""): HuntLogEntry {
  const day = new Date(2026, 10, 9 - daysAgo);
  return {
    id: `h${daysAgo}${bucks}${does}`,
    propertyId: "p1",
    standId: "s1",
    standName: "Ridge",
    date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
    startTime: "06:00",
    endTime: "10:00",
    windDirection: "",
    windSpeed: "",
    temperature: "",
    weather: "",
    moonPhase: "",
    weatherSnapshot: {} as HuntLogEntry["weatherSnapshot"],
    bucks,
    does,
    fawns: 0,
    shotOpportunity: false,
    harvest: false,
    notes,
  };
}

function input(extra: Partial<ObservedRutInput>): ObservedRutInput {
  return { now, photos: [], sunFor, ...extra };
}

describe("localDayKey", () => {
  it("keeps stored local dates and converts ISO timestamps to the local day", () => {
    expect(localDayKey("2026-11-05")).toBe("2026-11-05");
    expect(localDayKey("2026-11-05T06:40")).toBe("2026-11-05");
    const iso = new Date(2026, 10, 5, 15, 0).toISOString();
    expect(localDayKey(iso)).toBe("2026-11-05");
    expect(localDayKey("")).toBeNull();
  });
});

describe("countObservedRutWindows", () => {
  it("counts daylight bucks only from trusted capture times inside legal light", () => {
    const { recent } = countObservedRutWindows(
      input({
        photos: [
          photo(1, "07:30", "Buck"), // trusted, legal light
          photo(1, "07:30", "Buck", { captureTimeSource: "file" }), // untrusted time
          photo(1, "22:00", "Buck"), // night
          photo(1, null, "Buck"), // date only
          photo(1, "06:00", "Buck", { captureTimeSource: "exif" }), // before legal start
        ],
      }),
    );
    expect(recent.bucks).toBe(5);
    expect(recent.buckDaylight).toBe(1);
  });

  it("splits recent vs prior windows and ignores old, future and non-deer records", () => {
    const { recent, prior } = countObservedRutWindows(
      input({
        photos: [
          photo(0, "08:00", "Doe"),
          photo(9, "08:00", "Doe"),
          photo(10, "08:00", "Doe"),
          photo(19, "08:00", "Doe"),
          photo(20, "08:00", "Doe"), // too old
          photo(-1, "08:00", "Doe"), // future
          photo(2, "08:00", "Turkey"),
          photo(2, "08:00", "No animal"),
        ],
      }),
    );
    expect(recent.deer).toBe(2);
    expect(prior.deer).toBe(2);
  });

  it("uses camera-check tallies only for checks with no photo records", () => {
    const checks = [
      { id: "k1", propertyId: "p1", date: "2026-11-08", bucks: 3, does: 5 },
      { id: "k2", propertyId: "p1", date: "2026-11-08", bucks: 2, does: 1 },
    ] as unknown as CameraCheck[];
    const { recent } = countObservedRutWindows(
      input({
        photos: [photo(1, "08:00", "Buck", { cameraCheckId: "k1" })],
        cameraChecks: checks,
      }),
    );
    // k1's deer are already the photo; only k2's tally adds.
    expect(recent.bucks).toBe(1 + 2);
    expect(recent.does).toBe(1);
    expect(recent.deer).toBe(1 + 3);
  });

  it("reads sit counts, sit notes and new scrape/rub pins", () => {
    const pins = [
      { id: "a", propertyId: "p1", type: "Scrape", createdAt: new Date(2026, 10, 7, 9).toISOString() },
      { id: "b", propertyId: "p1", type: "Rub", createdAt: new Date(2026, 10, 8, 9).toISOString() },
      { id: "c", propertyId: "p1", type: "Food", createdAt: new Date(2026, 10, 8, 9).toISOString() },
      { id: "d", propertyId: "p1", type: "Scrape", createdAt: new Date(2026, 9, 1, 9).toISOString() },
    ] as unknown as MapPin[];
    const { recent } = countObservedRutWindows(
      input({
        hunts: [
          sit(1, 2, 3, "Saw a buck chasing a doe hard"),
          sit(2, 0, 1, "Fresh scrape on the ridge"),
          { ...sit(3, 4, 4), kind: "blood-trail" },
        ],
        pins,
      }),
    );
    expect(recent.bucks).toBe(2);
    expect(recent.does).toBe(4);
    expect(recent.buckDaylight).toBe(2);
    expect(recent.chasing).toBe(1);
    expect(recent.chasingNotes).toBe(1);
    expect(recent.scrapeSign).toBe(3);
    expect(recent.signPins).toBe(2);
  });
});

describe("readObservedRut", () => {
  it("refuses to read a thin sample and says the calendar is shown", () => {
    const read = readObservedRut(
      input({ photos: many(7, () => photo(1, "08:00", "Buck", { behavior: "Chasing" })) }),
    );
    expect(read.enoughData).toBe(false);
    expect(read.phase).toBe("unclear");
    expect(read.sampleSize).toBe(7);
    expect(read.summary).toBe(OBSERVED_RUT_NOT_ENOUGH);
  });

  it("calls chasing from chasing tags plus rising buck daylight, ahead of a seeking calendar", () => {
    const read = readObservedRut(
      input({
        calendarPhase: "seeking",
        photos: [
          ...many(4, (i) => photo(i, "07:30", "Buck", { behavior: "Chasing" })),
          ...many(2, (i) => photo(i, "16:00", "Buck", { behavior: "Traveling" })),
          ...many(4, (i) => photo(i, "17:00", "Doe", { behavior: "Feeding" })),
          ...many(2, (i) => photo(12 + i, "07:00", "Buck")),
          ...many(8, (i) => photo(12 + (i % 5), "18:30", "Doe")),
        ],
        hunts: [sit(2, 1, 5)],
      }),
    );
    expect(read.phase).toBe("chasing");
    expect(read.confidence).toBe("medium");
    expect(read.sampleSize).toBe(16);
    expect(read.evidence[0]).toBe("4 chasing photos in 10 days");
    expect(read.evidence).toContain("Buck daylight sightings up from 2 to 7");
    expect(read.calendarNote).toBe("ahead of the calendar");
    expect(read.summary).toMatch(/^Your cameras suggest Chasing \(medium\) — 4 chasing photos/);
  });

  it("calls lockdown when bucks vanish while does keep showing", () => {
    const read = readObservedRut(
      input({
        calendarPhase: "lockdown",
        photos: [
          ...many(8, (i) => photo(11 + (i % 6), "08:00", "Buck", { behavior: "Traveling" })),
          ...many(4, (i) => photo(11 + i, "09:00", "Doe")),
          photo(2, "23:00", "Buck"),
          ...many(9, (i) => photo(i, "08:00", "Doe", { behavior: "Feeding" })),
        ],
      }),
    );
    expect(read.phase).toBe("lockdown");
    expect(read.evidence[0]).toBe("Bucks down from 8 to 1 while does held at 9");
    expect(read.calendarNote).toBe("");
  });

  it("calls post-rut when chasing fades and bucks are back on food", () => {
    const read = readObservedRut(
      input({
        calendarPhase: "peak",
        photos: [
          ...many(4, (i) => photo(11 + i, "08:00", "Buck", { behavior: "Chasing" })),
          ...many(4, (i) => photo(11 + i, "09:00", "Doe")),
          ...many(4, (i) => photo(i, "16:30", "Buck", { behavior: "Feeding" })),
          ...many(5, (i) => photo(i, "17:00", "Doe", { behavior: "Feeding" })),
        ],
      }),
    );
    expect(read.phase).toBe("post-rut");
    expect(read.evidence[0]).toBe("Chasing down from 4 to 0");
    expect(read.calendarNote).toBe("ahead of the calendar");
  });

  it("calls seeking from fresh scrapes with no chasing, behind a chasing calendar", () => {
    const pins = [
      { id: "a", propertyId: "p1", type: "Scrape", createdAt: new Date(2026, 10, 7, 9).toISOString() },
      { id: "b", propertyId: "p1", type: "Scrape", createdAt: new Date(2026, 10, 8, 9).toISOString() },
    ] as unknown as MapPin[];
    const read = readObservedRut(
      input({
        calendarPhase: "chasing",
        pins,
        photos: [
          photo(1, "07:00", "Buck", { behavior: "At scrape or rub" }),
          ...many(3, (i) => photo(i, "22:00", "Buck", { behavior: "Traveling" })),
          ...many(5, (i) => photo(i, "17:00", "Doe", { behavior: "Feeding" })),
        ],
      }),
    );
    expect(read.phase).toBe("seeking");
    expect(read.confidence).toBe("low");
    expect(read.evidence[0]).toBe(
      "2 new scrape/rub pins + 1 scrape/rub photo or note in 10 days",
    );
    expect(read.calendarNote).toBe("behind the calendar");
  });

  it("stays unclear with plenty of photos but no rut signal", () => {
    const read = readObservedRut(
      input({
        calendarPhase: "chasing",
        photos: [
          ...many(5, (i) => photo(i, "17:00", "Doe", { behavior: "Feeding" })),
          ...many(5, (i) => photo(i, "22:00", "Buck", { behavior: "Traveling" })),
        ],
      }),
    );
    expect(read.enoughData).toBe(true);
    expect(read.phase).toBe("unclear");
    expect(read.confidence).toBe("low");
    expect(read.calendarNote).toBe("");
    expect(read.summary).toMatch(/don't show a clear rut pattern/);
  });
});

describe("observedRutLead", () => {
  it("lower-cases the first letter of the leading lines", () => {
    expect(observedRutLead(["Buck daylight up", "3 chasing photos", "extra"])).toBe(
      "buck daylight up, 3 chasing photos",
    );
  });
});

describe("rutPhaseSteps", () => {
  it("measures observed vs calendar on the season timeline", () => {
    expect(rutPhaseSteps("seeking", "chasing")).toBe(1);
    expect(rutPhaseSteps("peak", "seeking")).toBe(-2);
    expect(rutPhaseSteps("chasing", "chasing")).toBe(0);
    expect(rutPhaseSteps("off-season", "chasing")).toBeNull();
  });
});

describe("AI Scout observedRut", () => {
  it("is omitted without enough data and carried through the request context", () => {
    const thin = readObservedRut(input({ photos: [] }));
    expect(buildAiScoutObservedRut(thin)).toBeUndefined();

    const read = readObservedRut(
      input({
        calendarPhase: "seeking",
        photos: [
          ...many(4, (i) => photo(i, "07:30", "Buck", { behavior: "Chasing" })),
          ...many(6, (i) => photo(i, "17:00", "Doe")),
        ],
      }),
    );
    const observedRut = buildAiScoutObservedRut(read);
    expect(observedRut).toMatchObject({
      phase: "Chasing",
      sampleSize: 10,
      windowDays: 10,
      vsCalendar: "ahead of the calendar",
    });

    const context = buildAiScoutRequestContext({
      property: { id: "p1", name: "Ridge", county: "", acres: "", notes: "" } as Property,
      stands: [],
      cameras: [],
      cameraChecks: [],
      hunts: [],
      photoRecords: [],
      deerProfiles: [],
      conditions: EMPTY_AI_SCOUT_CONDITIONS,
      observedRut,
    });
    expect(context.observedRut?.phase).toBe("Chasing");
  });
});
