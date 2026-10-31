// The zoom at which a holding's owner name first shows on the map, baked into
// the tiles' label points as `mz` so the renderer only has to compare zooms.
//
// Measured with the label the map actually draws (components/map/
// ParcelTilesLayer.tsx): the name in Bebas Neue at 17px with 0.05em tracking,
// wrapped at 150px onto at most 3 lines, and a 9.5px Geist Mono acreage line
// under it. The old estimate assumed a generic 0.62em-per-cap face, which
// Bebas (a condensed face, ~0.40em per cap) is far narrower than.
//
// "Fits" allows the block to run somewhat past the biggest parcel's own box:
// that box is a single tax parcel, while the holding it names is usually
// several, and the map's labeler still drops any label that would collide with
// another (bigger holdings first). That lets names show one zoom sooner than a
// strict inside-the-parcel fit, the way onX / Spartan Forge label, without
// letting a name sprawl across ground that isn't its own.

export const LABEL_MIN_Z = 12;
export const LABEL_MAX_Z = 17;

const NAME_PX = 17;
const NAME_TRACKING_PX = NAME_PX * 0.05;
const NAME_LINE_PX = NAME_PX * 1.0;
const ACRES_LINE_PX = 9.5 * 1.45;
const BLOCK_PAD_PX = 2;
const WRAP_PX = 150;
const MAX_LINES = 3;

// Strict fit: the block sits inside the parcel's box with a hair of margin.
const STRICT = { w: 0.98, h: 0.98 };
// One zoom sooner is allowed only while the block stays within this much of
// the parcel's box.
const EARLY = { w: 1.6, h: 1.3 };

// Bebas Neue advance widths in em (caps — the map upper-cases every name),
// rounded up slightly so the estimate errs toward showing a name later. Checked
// against the outlined Bebas in components/ui/Wordmark.tsx (about D 0.41,
// E 0.36, I 0.19, N 0.43 em there, net of its tracking). The renderer measures
// real text; this only decides the zoom a name is allowed to appear at.
const BEBAS_EM = {
  A: 0.41, B: 0.42, C: 0.4, D: 0.42, E: 0.38, F: 0.37, G: 0.41, H: 0.43,
  I: 0.2, J: 0.27, K: 0.42, L: 0.37, M: 0.53, N: 0.43, O: 0.41, P: 0.4,
  Q: 0.41, R: 0.42, S: 0.39, T: 0.37, U: 0.42, V: 0.41, W: 0.57, X: 0.41,
  Y: 0.4, Z: 0.37, " ": 0.18, "&": 0.45, ".": 0.17, ",": 0.17, "-": 0.27,
  "'": 0.15, "/": 0.32, "#": 0.45,
};
const BEBAS_DIGIT_EM = 0.41;
const BEBAS_OTHER_EM = 0.42;

/** Rendered width (px) of a name line in the map's Bebas label font. */
export function bebasTextWidth(text) {
  let w = 0;
  for (const ch of String(text).toUpperCase()) {
    const em = BEBAS_EM[ch] ?? (ch >= "0" && ch <= "9" ? BEBAS_DIGIT_EM : BEBAS_OTHER_EM);
    w += em * NAME_PX + NAME_TRACKING_PX;
  }
  return w;
}

/** Greedy word wrap at `maxWidth`, same as the renderer's wrapWords. */
export function wrapName(name, maxWidth, maxLines = MAX_LINES) {
  const words = String(name).split(/\s+/).filter(Boolean);
  if (!words.length) return [String(name)];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const trial = `${current} ${words[i]}`;
    if (bebasTextWidth(trial) <= maxWidth) {
      current = trial;
    } else if (lines.length < maxLines - 1) {
      lines.push(current);
      current = words[i];
    } else {
      current = `${current} ${words.slice(i).join(" ")}`;
      break;
    }
  }
  lines.push(current);
  return lines;
}

/**
 * The label block's size (px) when wrapped to `wrapWidth`. The width is the
 * name's: the small acreage caption may run a little wider than a short name
 * (as the old estimate also allowed), and the labeler still guards collisions.
 */
export function labelBlockSize(name, hasAcres, wrapWidth = WRAP_PX) {
  const lines = wrapName(name, wrapWidth);
  return {
    lines: lines.length,
    w: Math.max(...lines.map(bebasTextWidth)),
    h: lines.length * NAME_LINE_PX + (hasAcres ? ACRES_LINE_PX : 0) + BLOCK_PAD_PX,
  };
}

function metersPerPixel(z, lat) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z);
}

function fitsAt(name, hasAcres, wM, hM, lat, z, slack) {
  const mpp = metersPerPixel(z, lat);
  const wPx = (wM / mpp) * slack.w;
  const hPx = (hM / mpp) * slack.h;
  // The renderer wraps at 150px; a narrower parcel wraps tighter to fit.
  const block = labelBlockSize(name, hasAcres, Math.min(WRAP_PX, wPx));
  return block.w <= wPx && block.h <= hPx;
}

/** First zoom the name fits strictly inside the parcel's box, or MAX+1. */
export function strictFitZoom(name, hasAcres, wM, hM, lat) {
  for (let z = LABEL_MIN_Z; z <= LABEL_MAX_Z; z++) {
    if (fitsAt(name, hasAcres, wM, hM, lat, z, STRICT)) return z;
  }
  return LABEL_MAX_Z + 1;
}

/**
 * The baked `mz`: one zoom before the strict fit when the block is still
 * within the EARLY allowance there, else the strict fit. LABEL_MAX_Z + 1 means
 * the name never fits in the zoom range (the build skips it).
 */
export function labelMinZoom(name, hasAcres, wM, hM, lat) {
  const strict = strictFitZoom(name, hasAcres, wM, hM, lat);
  // A name that only fits past the range still gets its early chance at MAX.
  const earlier = Math.min(strict, LABEL_MAX_Z + 1) - 1;
  if (earlier >= LABEL_MIN_Z && fitsAt(name, hasAcres, wM, hM, lat, earlier, EARLY)) {
    return earlier;
  }
  return strict;
}
