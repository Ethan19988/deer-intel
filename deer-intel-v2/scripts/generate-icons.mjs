// Generates the PWA / home-screen icons from one inline SVG source, so the app
// can be installed to a phone's home screen and launched like a native app.
// Run with: node scripts/generate-icons.mjs  (uses sharp, already a Next dep).

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icons");

// Deer Intel mark: a hunter-green field (Realtree EDGE palette) with a
// blaze-orange ring and a cream deer track. The mark sits inside the maskable
// safe zone so it survives Android's icon masking.
const icon = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#357f45"/>
      <stop offset="1" stop-color="#123420"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#field)"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="#e46a2e" stroke-width="16"/>
  <g fill="#f3efe2">
    <g transform="translate(214 256) rotate(-11) scale(1.35)">
      <path d="M0 -46 C 14 -40 20 -16 18 4 C 16 26 8 44 0 44 C -8 44 -16 26 -18 4 C -20 -16 -14 -40 0 -46 Z"/>
    </g>
    <g transform="translate(298 256) rotate(11) scale(1.35)">
      <path d="M0 -46 C 14 -40 20 -16 18 4 C 16 26 8 44 0 44 C -8 44 -16 26 -18 4 C -20 -16 -14 -40 0 -46 Z"/>
    </g>
  </g>
</svg>`;

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  // Opaque, no rounding — iOS applies its own mask to the apple-touch-icon.
  { name: "apple-touch-icon.png", size: 180 },
];

await mkdir(outDir, { recursive: true });

for (const { name, size } of targets) {
  const png = await sharp(Buffer.from(icon))
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(join(outDir, name), png);
  console.log(`wrote public/icons/${name} (${size}x${size})`);
}
