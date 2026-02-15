import {
  DEFAULT_BGM_VOLUME,
  DEFAULT_LANGUAGE,
  DEFAULT_MASTER_MUTED,
  DEFAULT_NICKNAME,
  DEFAULT_SFX_VOLUME,
  DEFAULT_VOICE_VOLUME,
  SETTINGS_KEY,
  VOLUME_MAX,
  VOLUME_MIN,
} from "../core/constants";
import { clamp } from "../core/clamp";
import type { LanguageCode, Settings } from "../core/types";

function isLanguageCode(value: unknown): value is LanguageCode {
  return value === "ko" || value === "en" || value === "ja";
}

function createDefaultSettings(): Settings {
  return {
    bgmVolume: DEFAULT_BGM_VOLUME,
    sfxVolume: DEFAULT_SFX_VOLUME,
    voiceVolume: DEFAULT_VOICE_VOLUME,
    masterMuted: DEFAULT_MASTER_MUTED,
    language: DEFAULT_LANGUAGE,
    nickname: DEFAULT_NICKNAME,
  };
}

function sanitizeNickname(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const trimmed = raw.trim();
  const filtered = trimmed.replace(/[^A-Za-z0-9\u3131-\u318E\uAC00-\uD7A3 ]+/g, "");
  const shortened = filtered.slice(0, 12).trim();
  return shortened.length > 0 ? shortened : DEFAULT_NICKNAME;
}

export function loadSettings(): Settings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return createDefaultSettings();
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      bgmVolume:
        typeof parsed.bgmVolume === "number"
          ? clamp(parsed.bgmVolume, VOLUME_MIN, VOLUME_MAX)
          : DEFAULT_BGM_VOLUME,
      sfxVolume:
        typeof parsed.sfxVolume === "number"
          ? clamp(parsed.sfxVolume, VOLUME_MIN, VOLUME_MAX)
          : DEFAULT_SFX_VOLUME,
      voiceVolume:
        typeof parsed.voiceVolume === "number"
          ? clamp(parsed.voiceVolume, VOLUME_MIN, VOLUME_MAX)
          : DEFAULT_VOICE_VOLUME,
      masterMuted: typeof parsed.masterMuted === "boolean" ? parsed.masterMuted : DEFAULT_MASTER_MUTED,
      language: isLanguageCode(parsed.language) ? parsed.language : DEFAULT_LANGUAGE,
      nickname: sanitizeNickname(parsed.nickname),
    };
  } catch {
    return createDefaultSettings();
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
