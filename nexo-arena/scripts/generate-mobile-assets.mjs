import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
const folder = "apps/mobile/assets";
await mkdir(folder, { recursive: true });
const icon = await readFile("apps/web/public/icons/icon.svg");
await sharp(icon).resize(1024, 1024).png().toFile(`${folder}/icon.png`);
await sharp(icon).resize(192, 192).png().toFile(`${folder}/favicon.png`);
const logo = Buffer.from(
  icon.toString().replace(/<rect width="512"[^>]+\/>/, ""),
);
await sharp(logo)
  .resize(1024, 1024)
  .png()
  .toFile(`${folder}/adaptive-icon.png`);
await sharp(logo).resize(320, 320).png().toFile(`${folder}/splash.png`);
