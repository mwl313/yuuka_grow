export type GuestAssetKey = "aris" | "koyuki" | "maki" | "momoi" | "noa" | "rio" | "sensei";

export interface GuestManifestEntry {
  image?: string;
  voices: string[];
}

export type GuestManifest = Partial<Record<GuestAssetKey, GuestManifestEntry>>;

const GUEST_ASSET_KEYS: GuestAssetKey[] = ["aris", "koyuki", "maki", "momoi", "noa", "rio", "sensei"];

const CORE_TO_ASSET_GUEST_KEY: Record<string, GuestAssetKey> = {
  aris: "aris",
  koyuki: "koyuki",
  maki: "maki",
  momoi: "momoi",
  noa: "noa",
  rio: "rio",
  teacher: "sensei",
  sensei: "sensei",
};

export function normalizeGuestManifest(input: unknown): GuestManifest {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const result: GuestManifest = {};

  for (const key of GUEST_ASSET_KEYS) {
    const rawEntry = source[key];
    if (!rawEntry || typeof rawEntry !== "object") continue;

    const entry = rawEntry as Record<string, unknown>;
    const image = typeof entry.image === "string" ? entry.image : undefined;
    const voices = Array.isArray(entry.voices)
      ? entry.voices.filter((item): item is string => typeof item === "string")
      : [];

    result[key] = { image, voices };
  }

  return result;
}

export function resolveGuestAssetUrl(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, "");
  return `/assets/guests/${normalized}`;
}

export function guestAssetKeyFromLogNameKey(nameKey: string): GuestAssetKey | null {
  const match = /^guest\.([a-z]+)\.name$/.exec(nameKey);
  if (!match) return null;
  return CORE_TO_ASSET_GUEST_KEY[match[1]] ?? null;
}

export function guestTextureKey(guestKey: GuestAssetKey): string {
  return `guest_${guestKey}`;
}

export function guestVoiceSoundKey(guestKey: GuestAssetKey, relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "_");
  return `guest_voice_${guestKey}_${normalized}`;
}
