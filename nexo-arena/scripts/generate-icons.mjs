import sharp from "sharp";
import { readFile, mkdir, copyFile } from "node:fs/promises";
const base = "apps/web/public/icons";
const svg = await readFile(`${base}/icon.svg`);
for (const size of [192, 512])
  await sharp(svg).resize(size, size).png().toFile(`${base}/icon-${size}.png`);
await sharp(svg).resize(180, 180).png().toFile(`${base}/apple-touch-icon.png`);
// Scale the logo into the central 80% maskable safe area.
const safe = await sharp(svg).resize(384, 384).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#101115" },
})
  .composite([{ input: safe, left: 64, top: 64 }])
  .png()
  .toFile(`${base}/maskable-512.png`);
await mkdir("apps/web/public/fonts", { recursive: true });
for (const [family, license] of [
  ["space-grotesk", "SPACE-GROTESK"],
  ["manrope", "MANROPE"],
]) {
  const source = `node_modules/@fontsource-variable/${family}`;
  await copyFile(
    `${source}/files/${family}-latin-wght-normal.woff2`,
    `apps/web/public/fonts/${family}-latin.woff2`,
  );
  await copyFile(
    `${source}/LICENSE`,
    `apps/web/public/fonts/${license}-LICENSE.txt`,
  );
}
