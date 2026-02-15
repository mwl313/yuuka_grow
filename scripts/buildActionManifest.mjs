import { promises as fs } from "node:fs";
import path from "node:path";

const IMAGE_EXTS = new Set([".webp", ".png"]);
const SOUND_EXTS = new Set([".wav", ".mp3", ".ogg"]);

function parseTargetArg() {
  const raw = process.argv[2]?.toLowerCase();
  if (raw === "food" || raw === "work") return raw;
  throw new Error("Usage: node scripts/buildActionManifest.mjs <food|work>");
}

function sortStable(list) {
  return [...list].sort((a, b) => a.localeCompare(b));
}

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function buildManifest(target) {
  const root = process.cwd();
  const baseDir = path.join(root, "public", "assets", target);
  const imageDir = path.join(baseDir, "image");
  const soundDir = path.join(baseDir, "sound");
  const outPath = path.join(baseDir, "manifest.json");

  const imageEntries = await safeReadDir(imageDir);
  const soundEntries = await safeReadDir(soundDir);

  const images = sortStable(
    imageEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => IMAGE_EXTS.has(path.extname(name).toLowerCase()))
      .map((name) => `image/${name}`),
  );

  const sounds = sortStable(
    soundEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => SOUND_EXTS.has(path.extname(name).toLowerCase()))
      .map((name) => `sound/${name}`),
  );

  const manifest = { images, sounds };
  await fs.writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  console.log(`Generated ${path.relative(root, outPath)}`);
}

const target = parseTargetArg();
buildManifest(target).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
