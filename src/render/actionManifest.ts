export type ActionVfxKind = "food" | "work";

export interface ActionManifest {
  images: string[];
  sounds: string[];
}

function normalizeRelativePath(value: string): string {
  return value.replace(/^\/+/, "");
}

function hasSupportedImageExt(path: string): boolean {
  return /\.(webp|png)$/i.test(path);
}

function hasSupportedAudioExt(path: string): boolean {
  return /\.(wav|mp3|ogg)$/i.test(path);
}

export function normalizeActionManifest(input: unknown): ActionManifest {
  if (!input || typeof input !== "object") {
    return { images: [], sounds: [] };
  }

  const source = input as Record<string, unknown>;
  const rawImages = Array.isArray(source.images)
    ? source.images.filter((value): value is string => typeof value === "string")
    : [];
  const rawSounds = Array.isArray(source.sounds)
    ? source.sounds.filter((value): value is string => typeof value === "string")
    : [];

  const images = rawImages
    .map((item) => normalizeRelativePath(item))
    .filter((item) => item.length > 0 && hasSupportedImageExt(item));
  const sounds = rawSounds
    .map((item) => normalizeRelativePath(item))
    .filter((item) => item.length > 0 && hasSupportedAudioExt(item));

  return { images, sounds };
}

export function resolveActionAssetUrl(kind: ActionVfxKind, relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  return `/assets/${kind}/${normalized}`;
}

export function actionImageTextureKey(kind: ActionVfxKind, relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath).replace(/[^a-z0-9]+/gi, "_");
  return `vfx_${kind}_img_${normalized}`;
}

export function actionSoundKey(kind: ActionVfxKind, relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath).replace(/[^a-z0-9]+/gi, "_");
  return `vfx_${kind}_snd_${normalized}`;
}
