import type { AssetLayerId } from "@/lib/propertyMap";
import { PIN_GLYPHS } from "@/lib/pinGlyphs";

export type GlyphKey = AssetLayerId | "deer" | "other";

// Map pins in the style the serious hunting apps use: one muted teardrop, a
// light off-white head, and a real filled icon in dark ink. The icon carries
// the meaning; the body colour only groups related pins, kept to four earthy
// tones that sit on satellite imagery instead of fighting it.
type PinGroup = "setup" | "sign" | "feed" | "access";

const GROUP_OF: Record<GlyphKey, PinGroup> = {
  stands: "setup",
  cameras: "setup",
  bedding: "sign",
  scrapes: "sign",
  rubs: "sign",
  trails: "sign",
  deer: "sign",
  other: "sign",
  food: "feed",
  water: "feed",
  parking: "access",
  gates: "access",
};

export const PIN_GROUP_COLORS: Record<PinGroup, string> = {
  setup: "#8A4B2A", // rust: where you hunt from and watch
  sign: "#6B4A2E", // saddle brown: deer sign and sightings
  feed: "#5E6B3A", // olive: food and water
  access: "#4A545C", // slate: parking and gates
};

const HEAD = "#F3EEE4";
const INK = "#2B2118";
const RIM = "#2B1D12";

/** The body colour for a pin type (also used for cluster bubbles). */
export function pinBodyColor(glyphKey: GlyphKey): string {
  return PIN_GROUP_COLORS[GROUP_OF[glyphKey] ?? "sign"];
}

// Glyph art fitted into the pin head: an 11-unit box centred on the head at
// (12, 11.5) inside the 24×34 pin.
const GLYPH_BOX = 11;

function glyphMarkup(glyphKey: GlyphKey): string {
  const glyph = PIN_GLYPHS[glyphKey] ?? PIN_GLYPHS.other;
  const scale = GLYPH_BOX / glyph.viewBox;
  const offsetX = 12 - GLYPH_BOX / 2;
  const offsetY = 11.5 - GLYPH_BOX / 2;
  return `<g transform="translate(${offsetX} ${offsetY}) scale(${scale})" fill="${INK}">${glyph.svg}</g>`;
}

// The teardrop pin as an SVG string, used for the map markers and, smaller,
// the Layers pin grid and chips. `color`/`background` are accepted for older
// callers but no longer used — the look comes from the pin type.
export function pinMarkerSvg({
  glyphKey,
  width,
  selected = false,
}: {
  color?: string;
  background?: string;
  glyphKey: GlyphKey;
  width: number;
  selected?: boolean;
}): string {
  const height = Math.round((width * 34) / 24);
  const body = pinBodyColor(glyphKey);

  return `<svg width="${width}" height="${height}" viewBox="0 0 24 34"
    xmlns="http://www.w3.org/2000/svg"
    style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45));overflow:visible;">
    ${
      selected
        ? `<path d="M12 .2C5.4.2.4 5.3.4 11.6.4 19.8 12 34 12 34s11.6-14.2 11.6-22.4C23.6 5.3 18.6.2 12 .2Z" fill="none" stroke="${HEAD}" stroke-width="1.6" opacity="0.9"/>`
        : ""
    }
    <path d="M12 1.2C6 1.2 1.4 5.9 1.4 11.6 1.4 19.1 12 32.6 12 32.6S22.6 19.1 22.6 11.6C22.6 5.9 18 1.2 12 1.2Z"
      fill="${body}" stroke="${selected ? HEAD : RIM}" stroke-width="${selected ? 1.4 : 1}"/>
    <circle cx="12" cy="11.5" r="8.1" fill="${HEAD}"/>
    <circle cx="12" cy="11.5" r="8.1" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="0.4"/>
    ${glyphMarkup(glyphKey)}
  </svg>`;
}
