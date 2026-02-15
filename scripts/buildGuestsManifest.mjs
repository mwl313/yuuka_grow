import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const guestsRoot = path.join(projectRoot, "public", "assets", "guests");
const manifestPath = path.join(guestsRoot, "manifest.json");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function buildManifest() {
  const dirEntries = await fs.readdir(guestsRoot, { withFileTypes: true });
  const guestDirs = dirEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const manifest = {};

  for (const guestKey of guestDirs) {
    const imageRelative = `${guestKey}/${guestKey}.png`;
    const imageAbsolute = path.join(guestsRoot, guestKey, `${guestKey}.png`);
    const image = (await exists(imageAbsolute)) ? imageRelative : "";

    const voicesDir = path.join(guestsRoot, guestKey, "voices");
    let voices = [];
    if (await exists(voicesDir)) {
      const voiceFiles = (await fs.readdir(voicesDir))
        .filter((fileName) => fileName.toLowerCase().endsWith(".mp3"))
        .sort((a, b) => a.localeCompare(b));
      voices = voiceFiles.map((fileName) => `${guestKey}/voices/${fileName}`);
    }

    manifest[guestKey] = { image, voices };
  }

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  console.log(`Generated ${path.relative(projectRoot, manifestPath)}`);
}

buildManifest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
