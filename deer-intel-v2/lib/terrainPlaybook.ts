// Terrain feature -> hunter's playbook.
//
// The terrain layer says WHERE deer live; this turns each spot into WHAT TO DO
// there — a plain-language read of why a mature buck uses it, then a Scout /
// Camera / Stand move for each. One function feeds both the map popups and the
// Scout Picks panel, so the advice never diverges between the two.
//
// Grounded in whitetail + mature-buck behavior:
//  - Beds: bucks bed with a downhill view, prevailing wind at their back and
//    rising thermals covering the ground below; high site fidelity — a good bed
//    gets reused for years. Hunt the edge, never the bed. (Penn State collar
//    data; NDA mature-buck movement.)
//  - Saddles/pinches: mature bucks use saddles MORE than other deer to skip the
//    climb, and rut cruisers funnel through — two cams on the approaches can put
//    a daylight buck on your phone in a few nights. Prime stand terrain.
//  - Benches: deer sidehill at a constant elevation instead of climbing; bucks
//    cruise them below the ridge to scent-check beds without skylining. Set up
//    on the downwind side of the trail on a crosswind, not at an "end".
//  - Draws: deer climb out of them from below at dawn while falling thermals
//    pour scent down the draw — sit the upper part/side at first light; rising
//    mid-afternoon thermals favor the lower end in the evening.
//  - Water crossings: where travel dips through a drainage; same thermal rule
//    — at first light stay above or beside the crossing, never below it.
//  - Bed-to-feed routes: the least-effort path bed<->food — where deer DO move.
//    Best afternoon stand sits in the transition zone, not tight to the field.
//  - Refuge: the steep, far-from-road core where the oldest bucks ride out
//    pressure. Hands-off; hunt the exits. (Goldilocks / shift-or-shrink.)
//  - Camera/stand placement: keep cameras and stands DOWNWIND of travel, off
//    the bed itself; cellular cams over pinches/mock scrapes for in-season
//    daylight photos without walking in. (onX, NDA, Whitetail Properties.)

import type { TerrainKind, TerrainMovementFeature } from "@/lib/terrainMovement";
import { isBedToFeedRoute } from "@/lib/terrainMovementData";

/** How to handle the spot — sets the tone of the top-line verdict. */
export type PlaybookTone = "prime" | "confirm" | "careful";

export type PlaybookMove = {
  icon: string;
  /** "Scout" | "Camera" | "Stand" */
  label: string;
  text: string;
};

export type TerrainPlaybook = {
  /** One-line verdict + how to handle it (e.g. "Prime stand"). */
  verdict: string;
  tone: PlaybookTone;
  /** Why a mature buck uses this ground, in plain language. */
  read: string;
  /** Best time window to hunt/scout it. */
  window: string;
  /** Scout, Camera, Stand — always in that order. */
  moves: PlaybookMove[];
  /** Road-distance/security nuance, when the set carries it. */
  access?: string;
};

/** Minimal shape the playbook needs — both a full feature and a ScoutPick fit. */
export type PlaybookInput = Pick<TerrainMovementFeature, "kind" | "id"> & {
  roadDistM?: number;
};

type PlaybookKey =
  | "bedding"
  | "pinch"
  | "crossing"
  | "bench"
  | "draw"
  | "route"
  | "refuge";

/** Pipeline ids are `<name>-draw-<n>` / `<name>-xing-<n>`; live ids `t-draw-…`. */
export function playbookKeyOf(input: PlaybookInput): PlaybookKey {
  if (isBedToFeedRoute(input)) return "route";
  if (input.kind === "travel") return input.id.includes("-draw-") ? "draw" : "bench";
  if (input.kind === "bedding") return "bedding";
  if (input.kind === "pinch") return input.id.includes("-xing-") ? "crossing" : "pinch";
  return "refuge";
}

const PLAYBOOK: Record<PlaybookKey, Omit<TerrainPlaybook, "access">> = {
  bedding: {
    verdict: "Hunt the edge — not the bed",
    tone: "careful",
    read:
      "Bucks bed here for a downhill view with the prevailing wind at their back and rising thermals covering everything below — every approach is watched or scented. They reuse a good bed for years.",
    window: "Anchor spot — early and all season.",
    moves: [
      {
        icon: "👣",
        label: "Scout",
        text: "Slip in midday or post-season for oval matted beds, droppings and downhill-facing rubs — confirm it, but never bump it.",
      },
      {
        icon: "📷",
        label: "Camera",
        text: "Keep cams OUT of the bed. Hang one on the exit trail toward feed or the first pinch below, and run it cellular so you don't walk in.",
      },
      {
        icon: "🪜",
        label: "Stand",
        text: "Don't hunt the bed. Set downwind of its exit trail, between bed and food, far enough that he's on his feet in daylight.",
      },
    ],
  },
  pinch: {
    verdict: "Prime stand",
    tone: "prime",
    read:
      "A low gap in the ridge. Deer — mature bucks especially — cross at saddles to skip the climb, and rut cruisers funnel straight through. The highest-odds terrain on the hill.",
    window: "Peaks in the rut; good all season.",
    moves: [
      {
        icon: "👣",
        label: "Scout",
        text: "Look for a worn trail through the gap with rubs and scrapes on the approaches — even a subtle saddle concentrates travel.",
      },
      {
        icon: "📷",
        label: "Camera",
        text: "Prime cellular-cam spot — two cams covering both approaches (add a mock scrape) can put a daylight buck on your phone within a few nights.",
      },
      {
        icon: "🪜",
        label: "Stand",
        text: "Top stand here. Sit the downwind/downhill side on a crosswind so scent blows across the gap, not into the approaches.",
      },
    ],
  },
  bench: {
    verdict: "Solid — scout to confirm",
    tone: "confirm",
    read:
      "Deer sidehill along benches at a constant elevation instead of climbing, and bucks cruise them below the ridge to scent-check the beds below without skylining.",
    window: "All season; best for cruising bucks in the rut.",
    moves: [
      {
        icon: "👣",
        label: "Scout",
        text: "Find the trail running the shelf and rubs facing the way deer travel; short benches between bedding and food are the most predictable.",
      },
      {
        icon: "📷",
        label: "Camera",
        text: "Set on the trail where the bench necks down between steep ground above and below — north side, about chest height.",
      },
      {
        icon: "🪜",
        label: "Stand",
        text: "Set up on the downwind side of the bench trail on a crosswind, so your scent blows off the shelf — not along it and not up into the beds above.",
      },
    ],
  },
  draw: {
    verdict: "Solid — play the thermals",
    tone: "confirm",
    read:
      "A drainage deer use to move between bedding and feed — and a quiet, low-scent way in. Thermals rule here: cool air pours down the draw at dawn and rises up it by mid-afternoon.",
    window: "Mornings from the upper end; evenings from the lower end.",
    moves: [
      {
        icon: "👣",
        label: "Scout",
        text: "Walk the bottom post-season for the trail, crossings and rubs along the edges; note where side trails climb out toward beds.",
      },
      {
        icon: "📷",
        label: "Camera",
        text: "Hang it where a side trail climbs out of the draw, angled across the trail — not looking straight down the bottom.",
      },
      {
        icon: "🪜",
        label: "Stand",
        text: "At first light sit the upper part or side of the draw so falling thermals carry scent down and away from deer coming up it. In the evening, mid-afternoon rising thermals favor the lower end.",
      },
    ],
  },
  crossing: {
    verdict: "Prime — water crossing",
    tone: "prime",
    read:
      "Where a travel line dips through a drainage: deer funnel through the easy gap to get across, with water right there. Like any low spot, it fills with sinking scent at dawn.",
    window: "All season; best on warm days and early season.",
    moves: [
      {
        icon: "👣",
        label: "Scout",
        text: "Find the worn crossing — cut banks, tracks in the mud — and the trails leading in from each side.",
      },
      {
        icon: "📷",
        label: "Camera",
        text: "Set it a few yards off the crossing, angled across it, so it catches deer stepping in and out of the water.",
      },
      {
        icon: "🪜",
        label: "Stand",
        text: "Sit the downwind bank on a crosswind. At first light stay above the crossing or off to the side — never below it, where falling thermals carry your scent down the drainage to deer coming up.",
      },
    ],
  },
  route: {
    verdict: "Prime — bed-to-feed line",
    tone: "prime",
    read:
      "The least-effort path from bed to food — where deer actually move, not just where they could. Feet-to-food in the evening, back to bed at dawn.",
    window: "Best early and late season; rut secondary.",
    moves: [
      {
        icon: "👣",
        label: "Scout",
        text: "Walk it to confirm the trail and tracks, and find the staging area just inside cover, short of the food.",
      },
      {
        icon: "📷",
        label: "Camera",
        text: "Hang a cam in the staging zone just off the food, or at the first pinch it threads — best odds of an evening daylight photo.",
      },
      {
        icon: "🪜",
        label: "Stand",
        text: "Best afternoon stand: in the transition zone between bed and food, not tight to the field. Stay downwind and enter without crossing the trail.",
      },
    ],
  },
  refuge: {
    verdict: "Hands-off — hunt the exits",
    tone: "careful",
    read:
      "The steep, far-from-road core where the oldest bucks ride out pressure — they stay in their range but shift to the ground hunters won't reach.",
    window: "Gun-season and pressure days; late season.",
    moves: [
      {
        icon: "👣",
        label: "Scout",
        text: "Scout only the edges, and only post-season — stepping inside in-season educates him and he'll go nocturnal or leave.",
      },
      {
        icon: "📷",
        label: "Camera",
        text: "No cams inside. Put one on a saddle or bench leading OUT to inventory who's living there, checked remotely.",
      },
      {
        icon: "🪜",
        label: "Stand",
        text: "Never hunt inside. Sit the exits on its upper edge on the right wind — it's where pressured deer pour in on gun-season mornings.",
      },
    ],
  },
};

/** S1 security band -> a one-line access read, mirroring the panel's bands. */
function accessNote(roadDistM: number): string {
  const yd = Math.round(roadDistM * 1.0936);
  if (roadDistM < 450) {
    return `~${yd} yd from a road — close, so expect mostly after-dark movement; favor the side away from the road.`;
  }
  if (roadDistM <= 900) {
    return `~${yd} yd from a road — in the huntable security band, a good access-to-odds balance.`;
  }
  return `~${yd} yd from a road — deep, low-pressure ground; worth the long, quiet approach.`;
}

/** Turn a terrain feature (or Scout Pick) into a scout/camera/stand playbook. */
export function terrainPlaybook(input: PlaybookInput): TerrainPlaybook {
  const base = PLAYBOOK[playbookKeyOf(input)];
  return typeof input.roadDistM === "number"
    ? { ...base, access: accessNote(input.roadDistM) }
    : base;
}
