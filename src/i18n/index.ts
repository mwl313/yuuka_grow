import { DEFAULT_LANGUAGE, SETTINGS_KEY } from "../core/constants";
import type { LanguageCode } from "../core/types";
import en from "./locales/en";
import ja from "./locales/ja";
import ko from "./locales/ko";

type Params = Record<string, string | number>;
type TranslationTable = Record<string, string>;
type Listener = () => void;

export type Lang = LanguageCode;

const tables: Record<Lang, TranslationTable> = {
  ko,
  en,
  ja,
};

const formatterLocales: Record<Lang, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
};

const listeners = new Set<Listener>();
const missingWarned = new Set<string>();
const formatterCache = new Map<Lang, Intl.NumberFormat>();

let currentLanguage: Lang = DEFAULT_LANGUAGE as Lang;

function isLang(value: unknown): value is Lang {
  return value === "ko" || value === "en" || value === "ja";
}

function readStoredLanguage(): Lang | null {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { language?: unknown };
    return isLang(parsed.language) ? parsed.language : null;
  } catch {
    return null;
  }
}

function writeStoredLanguage(language: Lang): void {
  const raw = localStorage.getItem(SETTINGS_KEY);
  let parsed: Record<string, unknown> = {};

  if (raw) {
    try {
      const base = JSON.parse(raw) as Record<string, unknown> | null;
      parsed = base && typeof base === "object" ? base : {};
    } catch {
      parsed = {};
    }
  }

  parsed.language = language;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
}

function detectLanguageFromNavigator(): Lang {
  const candidates = [...(navigator.languages ?? []), navigator.language].filter(
    (lang): lang is string => typeof lang === "string" && lang.length > 0,
  );

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    if (normalized.startsWith("ko")) return "ko";
    if (normalized.startsWith("ja")) return "ja";
    if (normalized.startsWith("en")) return "en";
  }
  return "en";
}

function emitLanguageChanged(): void {
  listeners.forEach((listener) => listener());
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

export function initI18n(): void {
  const stored = readStoredLanguage();
  const selected = stored ?? detectLanguageFromNavigator();
  setLanguage(selected);
}

export function getLanguage(): Lang {
  return currentLanguage;
}

export function setLanguage(language: Lang): void {
  if (!isLang(language)) return;
  const changed = currentLanguage !== language;
  currentLanguage = language;
  writeStoredLanguage(language);
  if (changed) {
    emitLanguageChanged();
  }
}

export function onLanguageChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: string, params?: Params): string {
  const selectedText = tables[currentLanguage][key];
  if (selectedText !== undefined) {
    return interpolate(selectedText, params);
  }

  const englishText = tables.en[key];
  if (englishText !== undefined) {
    return interpolate(englishText, params);
  }

  if (!missingWarned.has(key)) {
    missingWarned.add(key);
    console.warn(`i18n missing key: ${key}`);
  }
  return `[[missing:${key}]]`;
}

export function formatNumber(value: number): string {
  let formatter = formatterCache.get(currentLanguage);
  if (!formatter) {
    formatter = new Intl.NumberFormat(formatterLocales[currentLanguage]);
    formatterCache.set(currentLanguage, formatter);
  }
  return formatter.format(Math.round(value));
}
