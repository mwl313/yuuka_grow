const SHARE_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SHARE_ID_MIN_LEN = 10;
const SHARE_ID_MAX_LEN = 16;

export function sanitizeNickname(input: unknown): string {
	const raw = typeof input === "string" ? input : "";
	const trimmed = raw.trim();
	const filtered = trimmed.replace(/[^A-Za-z0-9\u3131-\u318E\uAC00-\uD7A3 ]+/g, "");
	const shortened = filtered.slice(0, 12).trim();
	return shortened.length > 0 ? shortened : "Sensei";
}

export function generateShareId(): string {
	const length = SHARE_ID_MIN_LEN + Math.floor(Math.random() * (SHARE_ID_MAX_LEN - SHARE_ID_MIN_LEN + 1));
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	let out = "";
	for (let i = 0; i < length; i += 1) {
		out += SHARE_ID_CHARS[bytes[i] % SHARE_ID_CHARS.length];
	}
	return out;
}

export function computeRankPercentile(higherCount: number, total: number): number {
	if (total <= 0) return 0;
	const raw = Math.floor((Math.max(0, higherCount) / total) * 100);
	return Math.max(0, Math.min(100, raw));
}

export function toNonNegativeInt(value: unknown, fallback = 0): number {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	return Math.max(0, Math.trunc(num));
}
