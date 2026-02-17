import { promises as fs } from "node:fs";
import path from "node:path";

const AUDIO_EXTS = new Set([".mp3", ".ogg", ".wav"]);
const CATEGORIES = ["lobby", "leaderboard", "gameearly", "gamemid", "gamelate", "gameend", "gamefinal", "result"];

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

async function buildManifest() {
  const root = process.cwd();
  const bgmRoot = path.join(root, "public", "assets", "bgm");
  const outPath = path.join(bgmRoot, "manifest.json");
  const manifest = {};

  for (const category of CATEGORIES) {
    const categoryDir = path.join(bgmRoot, category);
    const entries = await safeReadDir(categoryDir);
    const tracks = sortStable(
      entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => AUDIO_EXTS.has(path.extname(name).toLowerCase()))
        .map((name) => `${category}/${name}`),
    );
    manifest[category] = tracks;
  }

  await fs.writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  console.log(`Generated ${path.relative(root, outPath)}`);
}

buildManifest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
