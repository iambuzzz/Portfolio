// Re-encodes raster assets in public/ into web-friendly WebP.
// Usage: node scripts/optimize-assets.mjs            (wallpapers + icons)
// Originals are replaced; commit the result.
import sharp from "sharp";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

const PUBLIC = path.resolve("public");

// Wallpapers: full (2560), small (1280) and settings thumbnail (400)
const WALLPAPERS = [
  "wallpapers/DefaultAerial_Tahoe_Beach.jpg",
  "wallpapers/macOS_Tahoe_LightDefault.jpg",
  "img/ui/macOS-ventura-light.jpg",
  "img/ui/macOS-ventura-dark.jpg"
];

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

async function wallpaper(rel) {
  const src = path.join(PUBLIC, rel);
  const exists = await stat(src).catch(() => null);
  if (!exists) return;
  const base = src.replace(/\.[a-z]+$/i, "");
  const variants = [
    ["", 2560, 74],
    ["-1280", 1280, 72],
    ["-thumb", 400, 70]
  ];
  for (const [suffix, width, quality] of variants) {
    const out = `${base}${suffix}.webp`;
    const info = await sharp(src)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toFile(out);
    console.log(`${path.relative(PUBLIC, out)}  ${kb(info.size)}`);
  }
  await unlink(src);
}

// Raster icons: cap at 256px (rendered at <=64px CSS), keep PNG path so
// configs don't change, but re-encode as palette-quantised PNG.
async function icons(dir, maxSize = 256) {
  for (const name of await readdir(dir)) {
    const p = path.join(dir, name);
    if ((await stat(p)).isDirectory()) {
      await icons(p, maxSize);
      continue;
    }
    if (!/\.png$/i.test(name)) continue;
    const before = (await stat(p)).size;
    if (before < 40 * 1024) continue;
    const buf = await sharp(p)
      .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
      .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
      .toBuffer();
    if (buf.length < before) {
      await sharp(buf).toFile(p);
      console.log(`${path.relative(PUBLIC, p)}  ${kb(before)} -> ${kb(buf.length)}`);
    }
  }
}

for (const w of WALLPAPERS) await wallpaper(w);
await icons(path.join(PUBLIC, "img/icons"));
// Logos keep their native size (manifest declares 192/512)
await icons(path.join(PUBLIC, "logo"), 4096);
