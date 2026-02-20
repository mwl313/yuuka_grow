import { requireAdminAuth } from "./admin/auth";
import { renderAdminPageHtml } from "./admin/html";
import { computeRankPercentile, generateShareId, sanitizeNickname, toNonNegativeInt } from "./lib/runUtils";
import { getEndingTitle, type Lang } from "../../src/shared/endingMeta";

type EndingCategory = "normal" | "bankrupt" | "stress" | "special" | "any";
type SortKey = "credit" | "thigh";

interface AppEnv {
	DB: D1Database;
	ADMIN_USER?: string;
	ADMIN_PASS?: string;
}

interface SubmitPayload {
	runId?: unknown;
	nickname?: unknown;
	endingCategory?: unknown;
	endingId?: unknown;
	survivalDays?: unknown;
	finalCredits?: unknown;
	finalThighCm?: unknown;
	finalStage?: unknown;
	submittedAtClient?: unknown;
	clientVersion?: unknown;
}

interface RankPreviewPayload {
	finalCredits?: unknown;
	finalThighCm?: unknown;
}

interface RunRecord {
	share_id?: string;
	run_id?: string | null;
	nickname: string;
	ending_category: string;
	ending_id: string;
	survival_days: number;
	final_credits: number;
	final_thigh_cm: number;
	final_stage: number;
	submitted_at_client: string;
	submitted_at_server: string;
	is_hidden?: number;
	updated_at?: string | null;
}

interface TelemetryPayload {
	anonId?: unknown;
	sessionId?: unknown;
	startedAt?: unknown;
	ts?: unknown;
	referrer?: unknown;
}

interface TelemetrySessionLengthRow {
	minutes: number | string | null;
}

interface TelemetryDailyCountRow {
	day: string;
	dau: number | string;
}

interface TelemetryRetentionRow {
	day: string;
	d0_users: number | string;
	d1_retained: number | string;
}

interface RankOutput {
	rank: number;
	total: number;
	percentileTop: number;
}

const CORS_METHODS = "GET, POST, OPTIONS";
const CORS_HEADERS = "Content-Type";
const ENDING_CATEGORY_SET = new Set<EndingCategory>(["normal", "bankrupt", "stress", "special", "any"]);
let runIdSchemaEnsured = false;
let adminSchemaEnsured = false;
let telemetrySchemaEnsured = false;

function escapeHtml(input: string): string {
	return input
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function detectLang(request: Request): Lang {
	const acceptLanguage = request.headers.get("Accept-Language") ?? "";
	const locales = acceptLanguage
		.split(",")
		.map((part) => part.split(";")[0]?.trim().toLowerCase())
		.filter((part): part is string => Boolean(part));
	for (const locale of locales) {
		if (locale.startsWith("ko")) return "ko";
		if (locale.startsWith("ja")) return "ja";
		if (locale.startsWith("en")) return "en";
	}
	return "en";
}

function getAllowedCorsOrigin(request: Request): string | null {
	const origin = request.headers.get("Origin");
	if (!origin) return null;

	let parsedOrigin: URL;
	try {
		parsedOrigin = new URL(origin);
	} catch {
		return null;
	}

	if (!/^https?:$/i.test(parsedOrigin.protocol)) return null;
	if (parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1") {
		return origin;
	}

	try {
		const requestOrigin = new URL(request.url).origin;
		return requestOrigin === origin ? origin : null;
	} catch {
		return null;
	}
}

function applyCorsHeaders(headers: Headers, origin: string | null): void {
	headers.set("Vary", "Origin");
	if (!origin) return;
	headers.set("Access-Control-Allow-Origin", origin);
	headers.set("Access-Control-Allow-Methods", CORS_METHODS);
	headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
}

function jsonResponse(payload: unknown, status: number, origin: string | null): Response {
	const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
	applyCorsHeaders(headers, origin);
	return new Response(JSON.stringify(payload), { status, headers });
}

function htmlResponse(html: string, status: number, origin: string | null): Response {
	const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
	applyCorsHeaders(headers, origin);
	return new Response(html, { status, headers });
}

function optionsResponse(origin: string | null): Response {
	const headers = new Headers();
	applyCorsHeaders(headers, origin);
	return new Response(null, { status: 204, headers });
}

function parseSortParam(value: string | null): SortKey {
	return value === "thigh" ? "thigh" : "credit";
}

function parseLimitParam(value: string | null): number {
	const raw = Number.parseInt(value ?? "", 10);
	if (!Number.isFinite(raw)) return 100;
	return Math.min(100, Math.max(1, raw));
}

function normalizeSubmittedAtClient(value: unknown, fallbackIso: string): string {
	if (typeof value !== "string") return fallbackIso;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed.slice(0, 64) : fallbackIso;
}

function normalizeClientVersion(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed.slice(0, 32) : null;
}

function normalizeEndingId(value: unknown): string {
	if (typeof value !== "string") return "unknown";
	const trimmed = value.trim();
	return (trimmed.length > 0 ? trimmed : "unknown").slice(0, 64);
}

function normalizeRunId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const safe = trimmed.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
	return safe.length > 0 ? safe : null;
}

async function ensureRunIdSchema(db: D1Database): Promise<void> {
	if (runIdSchemaEnsured) return;

	try {
		await db.prepare("ALTER TABLE runs ADD COLUMN run_id TEXT").run();
	} catch {
		// Column already exists on upgraded environments.
	}
	await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_run_id_unique ON runs(run_id) WHERE run_id IS NOT NULL").run();
	runIdSchemaEnsured = true;
}

async function ensureAdminSchema(db: D1Database): Promise<void> {
	if (adminSchemaEnsured) return;

	try {
		await db.prepare("ALTER TABLE runs ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0").run();
	} catch {
		// Column already exists on upgraded environments.
	}
	try {
		await db.prepare("ALTER TABLE runs ADD COLUMN updated_at TEXT").run();
	} catch {
		// Column already exists on upgraded environments.
	}
	await db.prepare("CREATE INDEX IF NOT EXISTS idx_runs_is_hidden ON runs(is_hidden)").run();
	adminSchemaEnsured = true;
}

async function ensureTelemetrySchema(db: D1Database): Promise<void> {
	if (telemetrySchemaEnsured) return;

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS telemetry_sessions (
				session_id TEXT PRIMARY KEY,
				anon_id TEXT NOT NULL,
				started_at TEXT NOT NULL,
				last_seen_at TEXT NOT NULL,
				ended_at TEXT NULL,
				user_agent TEXT NULL,
				country TEXT NULL,
				referrer TEXT NULL
			)`,
		)
		.run();
	await db
		.prepare("CREATE INDEX IF NOT EXISTS telemetry_sessions_anon_started ON telemetry_sessions(anon_id, started_at)")
		.run();
	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS telemetry_daily (
				day TEXT NOT NULL,
				anon_id TEXT NOT NULL,
				first_seen_at TEXT NOT NULL,
				last_seen_at TEXT NOT NULL,
				PRIMARY KEY (day, anon_id)
			)`,
		)
		.run();
	telemetrySchemaEnsured = true;
}

function normalizeTelemetryId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > 80) return null;
	return trimmed;
}

function normalizeTelemetryReferrer(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, 256);
}

function normalizeTelemetryIso(value: unknown, fallbackIso: string): string {
	if (typeof value !== "string") return fallbackIso;
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > 80) return fallbackIso;
	const date = new Date(trimmed);
	if (Number.isNaN(date.getTime())) return fallbackIso;
	return date.toISOString();
}

function toUtcDay(iso: string): string {
	return iso.slice(0, 10);
}

function shiftUtcDay(day: string, diffDays: number): string {
	const date = new Date(`${day}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + diffDays);
	return toUtcDay(date.toISOString());
}

function listUtcDays(endDay: string, count: number): string[] {
	const days: string[] = [];
	for (let i = count - 1; i >= 0; i -= 1) {
		days.push(shiftUtcDay(endDay, -i));
	}
	return days;
}

function percentileFromSorted(values: number[], ratio: number): number {
	if (values.length === 0) return 0;
	const clamped = Math.max(0, Math.min(1, ratio));
	const index = Math.round((values.length - 1) * clamped);
	return values[index] ?? 0;
}

function medianFromSorted(values: number[]): number {
	if (values.length === 0) return 0;
	const mid = Math.floor(values.length / 2);
	if (values.length % 2 === 0) {
		return ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2;
	}
	return values[mid] ?? 0;
}

function requestCountry(request: Request): string | null {
	// Keep only coarse country code from Cloudflare metadata; never store raw IP.
	const req = request as Request & { cf?: { country?: string } };
	const country = req.cf?.country;
	if (typeof country !== "string" || country.length === 0) return null;
	return country.slice(0, 8);
}

async function upsertTelemetryDaily(db: D1Database, day: string, anonId: string, nowIso: string): Promise<void> {
	await db
		.prepare(
			`INSERT INTO telemetry_daily (day, anon_id, first_seen_at, last_seen_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(day, anon_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
		)
		.bind(day, anonId, nowIso, nowIso)
		.run();
}

function normalizeShareId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed.slice(0, 64) : null;
}

function parseAdminLimitParam(value: string | null): number {
	const raw = Number.parseInt(value ?? "", 10);
	if (!Number.isFinite(raw)) return 50;
	return Math.min(200, Math.max(1, raw));
}

function parseAdminPageParam(value: string | null): number {
	const raw = Number.parseInt(value ?? "", 10);
	if (!Number.isFinite(raw)) return 1;
	return Math.max(1, raw);
}

async function scalarNumber(db: D1Database, sql: string, bindings: unknown[] = []): Promise<number> {
	const row = await db.prepare(sql).bind(...bindings).first<{ value: number | string }>();
	if (!row) return 0;
	return Number(row.value ?? 0);
}

async function computeRank(
	db: D1Database,
	column: "final_credits" | "final_thigh_cm",
	value: number,
): Promise<RankOutput> {
	const total = await scalarNumber(db, "SELECT COUNT(*) AS value FROM runs");
	const higher = await scalarNumber(db, `SELECT COUNT(*) AS value FROM runs WHERE ${column} > ?`, [value]);
	const rank = 1 + higher;
	return {
		rank,
		total,
		percentileTop: computeRankPercentile(higher, total),
	};
}

async function insertRunAndGetShareId(
	db: D1Database,
	params: {
		runId: string | null;
		nickname: string;
		endingCategory: EndingCategory;
		endingId: string;
		survivalDays: number;
		finalCredits: number;
		finalThighCm: number;
		finalStage: number;
		submittedAtClient: string;
		submittedAtServer: string;
		clientVersion: string | null;
	},
): Promise<string> {
	const sql = `
		INSERT INTO runs (
			share_id,
			run_id,
			nickname,
			ending_category,
			ending_id,
			survival_days,
			final_credits,
			final_thigh_cm,
			final_stage,
			submitted_at_client,
			submitted_at_server,
			client_version
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`;

	for (let i = 0; i < 6; i += 1) {
		const shareId = generateShareId();
		try {
			await db
				.prepare(sql)
				.bind(
					shareId,
					params.runId,
					params.nickname,
					params.endingCategory,
					params.endingId,
					params.survivalDays,
					params.finalCredits,
					params.finalThighCm,
					params.finalStage,
					params.submittedAtClient,
					params.submittedAtServer,
					params.clientVersion,
				)
				.run();
			return shareId;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const lower = message.toLowerCase();
			if (lower.includes("runs.run_id")) {
				throw new Error("duplicate_run_id");
			}
			if (lower.includes("unique") || lower.includes("constraint")) {
				continue;
			}
			throw error;
		}
	}
	throw new Error("Failed to generate unique share id");
}

async function findRunByRunId(db: D1Database, runId: string): Promise<RunRecord | null> {
	return (
		(await db
			.prepare(
				`SELECT
					share_id,
					run_id,
					nickname,
					ending_category,
					ending_id,
					survival_days,
					final_credits,
					final_thigh_cm,
					final_stage,
					submitted_at_client,
					submitted_at_server
				FROM runs
				WHERE run_id = ?
				LIMIT 1`,
			)
			.bind(runId)
			.first<RunRecord>()) ?? null
	);
}

async function findRunByShareId(db: D1Database, shareId: string): Promise<RunRecord | null> {
	return (
		(await db
			.prepare(
				`SELECT
					share_id,
					run_id,
					nickname,
					ending_category,
					ending_id,
					survival_days,
					final_credits,
					final_thigh_cm,
					final_stage,
					submitted_at_client,
					submitted_at_server,
					COALESCE(is_hidden, 0) AS is_hidden,
					updated_at
				FROM runs
				WHERE share_id = ?
				LIMIT 1`,
			)
			.bind(shareId)
			.first<RunRecord>()) ?? null
	);
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
	try {
		return (await request.json()) as T;
	} catch {
		return null;
	}
}

function pickFirst(body: Record<string, unknown>, keys: string[]): unknown {
	for (const key of keys) {
		if (key in body) return body[key];
	}
	return undefined;
}

async function handleSubmit(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	await ensureRunIdSchema(env.DB);

	let payload: SubmitPayload;
	try {
		payload = (await request.json()) as SubmitPayload;
	} catch {
		return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, origin);
	}

	const endingCategoryRaw = typeof payload.endingCategory === "string" ? payload.endingCategory : "";
	if (!ENDING_CATEGORY_SET.has(endingCategoryRaw as EndingCategory)) {
		return jsonResponse({ ok: false, error: "Invalid endingCategory" }, 400, origin);
	}

	const submittedAtServer = new Date().toISOString();
	const runId = normalizeRunId(payload.runId);
	const nickname = sanitizeNickname(payload.nickname);
	const endingId = normalizeEndingId(payload.endingId);
	const survivalDays = toNonNegativeInt(payload.survivalDays);
	const finalCredits = toNonNegativeInt(payload.finalCredits);
	const finalThighCm = toNonNegativeInt(payload.finalThighCm);
	const finalStage = toNonNegativeInt(payload.finalStage);
	const submittedAtClient = normalizeSubmittedAtClient(payload.submittedAtClient, submittedAtServer);
	const clientVersion = normalizeClientVersion(payload.clientVersion);

	let persistedCredits = finalCredits;
	let persistedThigh = finalThighCm;
	let resolvedShareId: string;
	let resolvedSubmittedAtServer: string;

	if (runId) {
		const existing = await findRunByRunId(env.DB, runId);
		if (existing) {
			resolvedShareId = existing.share_id ?? "";
			resolvedSubmittedAtServer = existing.submitted_at_server;
			if (!resolvedShareId) {
				return jsonResponse({ ok: false, error: "Invalid existing run" }, 500, origin);
			}
			persistedCredits = existing.final_credits;
			persistedThigh = existing.final_thigh_cm;

			const [credit, thigh] = await Promise.all([
				computeRank(env.DB, "final_credits", persistedCredits),
				computeRank(env.DB, "final_thigh_cm", persistedThigh),
			]);

			return jsonResponse(
				{
					ok: true,
					shareId: resolvedShareId,
					submittedAtServer: resolvedSubmittedAtServer,
					rank: { credit, thigh },
				},
				200,
				origin,
			);
		}
	}

	try {
		resolvedShareId = await insertRunAndGetShareId(env.DB, {
			runId,
			nickname,
			endingCategory: endingCategoryRaw as EndingCategory,
			endingId,
			survivalDays,
			finalCredits,
			finalThighCm,
			finalStage,
			submittedAtClient,
			submittedAtServer,
			clientVersion,
		});
		resolvedSubmittedAtServer = submittedAtServer;
	} catch (error) {
		if (error instanceof Error && error.message === "duplicate_run_id" && runId) {
			const existing = await findRunByRunId(env.DB, runId);
			if (existing?.share_id) {
				resolvedShareId = existing.share_id;
				resolvedSubmittedAtServer = existing.submitted_at_server;
				persistedCredits = existing.final_credits;
				persistedThigh = existing.final_thigh_cm;
			} else {
				throw error;
			}
		} else {
			throw error;
		}
	}

	const [credit, thigh] = await Promise.all([
		computeRank(env.DB, "final_credits", persistedCredits),
		computeRank(env.DB, "final_thigh_cm", persistedThigh),
	]);

	return jsonResponse(
		{
			ok: true,
			shareId: resolvedShareId,
			submittedAtServer: resolvedSubmittedAtServer,
			rank: { credit, thigh },
		},
		200,
		origin,
	);
}

async function handleRankPreview(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	let payload: RankPreviewPayload;
	try {
		payload = (await request.json()) as RankPreviewPayload;
	} catch {
		return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, origin);
	}

	const finalCredits = toNonNegativeInt(payload.finalCredits);
	const finalThighCm = toNonNegativeInt(payload.finalThighCm);
	const [credit, thigh] = await Promise.all([
		computeRank(env.DB, "final_credits", finalCredits),
		computeRank(env.DB, "final_thigh_cm", finalThighCm),
	]);

	return jsonResponse(
		{
			ok: true,
			computedAtServer: new Date().toISOString(),
			rank: { credit, thigh },
		},
		200,
		origin,
	);
}

async function handleLeaderboard(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	await ensureAdminSchema(env.DB);

	const url = new URL(request.url);
	const sort = parseSortParam(url.searchParams.get("sort"));
	const limit = parseLimitParam(url.searchParams.get("limit"));
	const orderBy = sort === "thigh" ? "final_thigh_cm DESC" : "final_credits DESC";
	const sql = `
		SELECT
			nickname,
			ending_category,
			ending_id,
			survival_days,
			final_credits,
			final_thigh_cm,
			final_stage,
			submitted_at_client,
			submitted_at_server
		FROM runs
		WHERE COALESCE(is_hidden, 0) = 0
		ORDER BY ${orderBy}, submitted_at_server DESC
		LIMIT ${limit}
	`;
	const rows = await env.DB.prepare(sql).all<RunRecord>();
	return jsonResponse(
		{
			ok: true,
			sort,
			items: rows.results ?? [],
		},
		200,
		origin,
	);
}

async function handleAdminSearch(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	await ensureAdminSchema(env.DB);

	const url = new URL(request.url);
	const shareId = normalizeShareId(url.searchParams.get("shareId"));
	const nicknameRaw = typeof url.searchParams.get("nickname") === "string" ? url.searchParams.get("nickname") ?? "" : "";
	const nickname = nicknameRaw.trim().slice(0, 32);
	const limit = parseAdminLimitParam(url.searchParams.get("limit"));
	const page = parseAdminPageParam(url.searchParams.get("page"));
	const offset = (page - 1) * limit;

	const conditions: string[] = [];
	const bindings: unknown[] = [];
	if (shareId) {
		conditions.push("share_id = ?");
		bindings.push(shareId);
	}
	if (nickname) {
		conditions.push("nickname LIKE ?");
		bindings.push(`%${nickname}%`);
	}
	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
	const countSql = `SELECT COUNT(*) AS value FROM runs ${whereClause}`;
	const totalFiltered = await scalarNumber(env.DB, countSql, bindings);
	const totalAll = await scalarNumber(env.DB, "SELECT COUNT(*) AS value FROM runs");
	const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
	const safePage = Math.min(page, totalPages);
	const safeOffset = (safePage - 1) * limit;

	const sql = `
		SELECT
			share_id,
			run_id,
			nickname,
			ending_category,
			ending_id,
			survival_days,
			final_credits,
			final_thigh_cm,
			final_stage,
			submitted_at_client,
			submitted_at_server,
			COALESCE(is_hidden, 0) AS is_hidden,
			updated_at
		FROM runs
		${whereClause}
		ORDER BY submitted_at_server DESC
		LIMIT ?
		OFFSET ?
	`;
	const listBindings = [...bindings, limit, safeOffset];
	const rows = await env.DB.prepare(sql).bind(...listBindings).all<RunRecord>();
	return jsonResponse(
		{
			ok: true,
			items: rows.results ?? [],
			page: safePage,
			limit,
			totalFiltered,
			totalAll,
			totalPages,
		},
		200,
		origin,
	);
}

async function handleAdminRun(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	await ensureAdminSchema(env.DB);

	const url = new URL(request.url);
	const shareId = normalizeShareId(url.searchParams.get("shareId"));
	if (!shareId) return jsonResponse({ ok: false, error: "shareId is required" }, 400, origin);

	const item = await findRunByShareId(env.DB, shareId);
	if (!item) return jsonResponse({ ok: false, error: "Not Found" }, 404, origin);
	return jsonResponse({ ok: true, item }, 200, origin);
}

async function handleAdminUpdate(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	await ensureAdminSchema(env.DB);

	const body = await readJsonBody<Record<string, unknown>>(request);
	if (!body) return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, origin);

	const shareId = normalizeShareId(pickFirst(body, ["shareId", "share_id"]));
	if (!shareId) return jsonResponse({ ok: false, error: "shareId is required" }, 400, origin);

	const updates: string[] = [];
	const binds: unknown[] = [];

	const nicknameInput = pickFirst(body, ["nickname"]);
	if (nicknameInput !== undefined) {
		updates.push("nickname = ?");
		binds.push(sanitizeNickname(nicknameInput));
	}

	const endingCategoryInput = pickFirst(body, ["endingCategory", "ending_category", "endingType", "ending_type"]);
	if (endingCategoryInput !== undefined) {
		if (!ENDING_CATEGORY_SET.has(String(endingCategoryInput) as EndingCategory)) {
			return jsonResponse({ ok: false, error: "Invalid ending category" }, 400, origin);
		}
		updates.push("ending_category = ?");
		binds.push(String(endingCategoryInput));
	}

	const endingIdInput = pickFirst(body, ["endingId", "ending_id", "ending"]);
	if (endingIdInput !== undefined) {
		updates.push("ending_id = ?");
		binds.push(normalizeEndingId(endingIdInput));
	}

	const daysInput = pickFirst(body, ["survivalDays", "survival_days", "days"]);
	if (daysInput !== undefined) {
		updates.push("survival_days = ?");
		binds.push(toNonNegativeInt(daysInput));
	}

	const creditsInput = pickFirst(body, ["finalCredits", "final_credits"]);
	if (creditsInput !== undefined) {
		updates.push("final_credits = ?");
		binds.push(toNonNegativeInt(creditsInput));
	}

	const thighInput = pickFirst(body, ["finalThighCm", "final_thigh_cm"]);
	if (thighInput !== undefined) {
		updates.push("final_thigh_cm = ?");
		binds.push(toNonNegativeInt(thighInput));
	}

	const stageInput = pickFirst(body, ["finalStage", "final_stage"]);
	if (stageInput !== undefined) {
		updates.push("final_stage = ?");
		binds.push(toNonNegativeInt(stageInput));
	}

	const submittedAtClientInput = pickFirst(body, ["submittedAtClient", "submitted_at_client"]);
	if (submittedAtClientInput !== undefined) {
		updates.push("submitted_at_client = ?");
		binds.push(normalizeSubmittedAtClient(submittedAtClientInput, new Date().toISOString()));
	}

	const clientVersionInput = pickFirst(body, ["clientVersion", "client_version"]);
	if (clientVersionInput !== undefined) {
		updates.push("client_version = ?");
		binds.push(normalizeClientVersion(clientVersionInput));
	}

	updates.push("updated_at = ?");
	binds.push(new Date().toISOString());

	binds.push(shareId);
	const result = await env.DB
		.prepare(`UPDATE runs SET ${updates.join(", ")} WHERE share_id = ?`)
		.bind(...binds)
		.run();
	if (!result.success) return jsonResponse({ ok: false, error: "Update failed" }, 500, origin);
	if ((result.meta?.changes ?? 0) === 0) return jsonResponse({ ok: false, error: "Not Found" }, 404, origin);
	return jsonResponse({ ok: true }, 200, origin);
}

async function handleAdminHide(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	await ensureAdminSchema(env.DB);

	const body = await readJsonBody<Record<string, unknown>>(request);
	if (!body) return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, origin);
	const shareId = normalizeShareId(pickFirst(body, ["shareId", "share_id"]));
	if (!shareId) return jsonResponse({ ok: false, error: "shareId is required" }, 400, origin);
	const isHidden = Boolean(pickFirst(body, ["isHidden", "is_hidden"])) ? 1 : 0;

	const result = await env.DB
		.prepare("UPDATE runs SET is_hidden = ?, updated_at = ? WHERE share_id = ?")
		.bind(isHidden, new Date().toISOString(), shareId)
		.run();
	if ((result.meta?.changes ?? 0) === 0) return jsonResponse({ ok: false, error: "Not Found" }, 404, origin);
	return jsonResponse({ ok: true }, 200, origin);
}

async function handleAdminDelete(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	const body = await readJsonBody<Record<string, unknown>>(request);
	if (!body) return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, origin);
	const shareId = normalizeShareId(pickFirst(body, ["shareId", "share_id"]));
	if (!shareId) return jsonResponse({ ok: false, error: "shareId is required" }, 400, origin);

	const result = await env.DB.prepare("DELETE FROM runs WHERE share_id = ?").bind(shareId).run();
	if ((result.meta?.changes ?? 0) === 0) return jsonResponse({ ok: false, error: "Not Found" }, 404, origin);
	return jsonResponse({ ok: true }, 200, origin);
}

async function handleTelemetrySessionStart(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	await ensureTelemetrySchema(env.DB);
	const body = await readJsonBody<TelemetryPayload>(request);
	if (!body) return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, origin);

	const anonId = normalizeTelemetryId(body.anonId);
	const sessionId = normalizeTelemetryId(body.sessionId);
	if (!anonId || !sessionId) return jsonResponse({ ok: false, error: "Invalid payload" }, 400, origin);

	const nowIso = new Date().toISOString();
	const startedAt = normalizeTelemetryIso(body.startedAt, nowIso);
	const referrer = normalizeTelemetryReferrer(body.referrer) ?? normalizeTelemetryReferrer(request.headers.get("referer"));
	const userAgent = request.headers.get("user-agent")?.slice(0, 256) ?? null;
	const country = requestCountry(request);

	await env.DB
		.prepare(
			`INSERT OR IGNORE INTO telemetry_sessions
			 (session_id, anon_id, started_at, last_seen_at, ended_at, user_agent, country, referrer)
			 VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
		)
		.bind(sessionId, anonId, startedAt, nowIso, userAgent, country, referrer)
		.run();
	await env.DB.prepare("UPDATE telemetry_sessions SET last_seen_at = ? WHERE session_id = ?").bind(nowIso, sessionId).run();
	await upsertTelemetryDaily(env.DB, toUtcDay(nowIso), anonId, nowIso);

	return jsonResponse({ ok: true }, 200, origin);
}

async function handleTelemetryHeartbeat(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	await ensureTelemetrySchema(env.DB);
	const body = await readJsonBody<TelemetryPayload>(request);
	if (!body) return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, origin);

	const anonId = normalizeTelemetryId(body.anonId);
	const sessionId = normalizeTelemetryId(body.sessionId);
	if (!anonId || !sessionId) return jsonResponse({ ok: false, error: "Invalid payload" }, 400, origin);

	const nowIso = new Date().toISOString();
	await env.DB.prepare("UPDATE telemetry_sessions SET last_seen_at = ? WHERE session_id = ?").bind(nowIso, sessionId).run();
	await upsertTelemetryDaily(env.DB, toUtcDay(nowIso), anonId, nowIso);

	return jsonResponse({ ok: true }, 200, origin);
}

async function handleTelemetrySessionEnd(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	await ensureTelemetrySchema(env.DB);
	const body = await readJsonBody<TelemetryPayload>(request);
	if (!body) return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, origin);

	const anonId = normalizeTelemetryId(body.anonId);
	const sessionId = normalizeTelemetryId(body.sessionId);
	if (!anonId || !sessionId) return jsonResponse({ ok: false, error: "Invalid payload" }, 400, origin);

	const nowIso = new Date().toISOString();
	await env.DB
		.prepare("UPDATE telemetry_sessions SET ended_at = ?, last_seen_at = ? WHERE session_id = ?")
		.bind(nowIso, nowIso, sessionId)
		.run();
	await upsertTelemetryDaily(env.DB, toUtcDay(nowIso), anonId, nowIso);

	return jsonResponse({ ok: true }, 200, origin);
}

async function handleTelemetryApi(request: Request, env: AppEnv, origin: string | null, pathname: string): Promise<Response> {
	if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method Not Allowed" }, 405, origin);
	if (pathname === "/api/telemetry/session_start") {
		return handleTelemetrySessionStart(request, env, origin);
	}
	if (pathname === "/api/telemetry/heartbeat") {
		return handleTelemetryHeartbeat(request, env, origin);
	}
	if (pathname === "/api/telemetry/session_end") {
		return handleTelemetrySessionEnd(request, env, origin);
	}
	return jsonResponse({ ok: false, error: "Not Found" }, 404, origin);
}

async function handleAdminMetrics(env: AppEnv, origin: string | null): Promise<Response> {
	await ensureAdminSchema(env.DB);
	await ensureTelemetrySchema(env.DB);

	const nowIso = new Date().toISOString();
	const today = toUtcDay(nowIso);
	const yesterday = shiftUtcDay(today, -1);
	const sevenDays = listUtcDays(today, 7);
	const retentionDays = listUtcDays(today, 14).reverse();
	const sevenDayStart = sevenDays[0] ?? today;
	const retentionStart = retentionDays[retentionDays.length - 1] ?? today;

	const dauRows = await env.DB
		.prepare(
			`SELECT day, COUNT(DISTINCT anon_id) AS dau
			 FROM telemetry_daily
			 WHERE day BETWEEN ? AND ?
			 GROUP BY day`,
		)
		.bind(sevenDayStart, today)
		.all<TelemetryDailyCountRow>();
	const dauMap = new Map<string, number>();
	for (const row of dauRows.results ?? []) {
		dauMap.set(row.day, Number(row.dau ?? 0));
	}

	const dauToday = dauMap.get(today) ?? 0;
	const dauYesterday = dauMap.get(yesterday) ?? 0;
	const dau7Avg = sevenDays.reduce((sum, day) => sum + (dauMap.get(day) ?? 0), 0) / Math.max(1, sevenDays.length);

	const sessionsToday = await scalarNumber(
		env.DB,
		"SELECT COUNT(*) AS value FROM telemetry_sessions WHERE substr(started_at, 1, 10) = ?",
		[today],
	);
	const avgSessionMinutesToday = Math.max(
		0,
		await scalarNumber(
			env.DB,
			`SELECT COALESCE(AVG((julianday(COALESCE(ended_at, last_seen_at)) - julianday(started_at)) * 24 * 60), 0) AS value
			 FROM telemetry_sessions
			 WHERE substr(started_at, 1, 10) = ?`,
			[today],
		),
	);
	const submitsToday = await scalarNumber(
		env.DB,
		"SELECT COUNT(*) AS value FROM runs WHERE substr(submitted_at_server, 1, 10) = ?",
		[today],
	);

	const sessionLengthRows = await env.DB
		.prepare(
			`SELECT ((julianday(COALESCE(ended_at, last_seen_at)) - julianday(started_at)) * 24 * 60) AS minutes
			 FROM telemetry_sessions
			 WHERE substr(started_at, 1, 10) = ?
			 ORDER BY minutes ASC
			 LIMIT 5000`,
		)
		.bind(today)
		.all<TelemetrySessionLengthRow>();
	const minutes = (sessionLengthRows.results ?? [])
		.map((row) => Number(row.minutes))
		.filter((value) => Number.isFinite(value) && value >= 0);
	const meanMinutes = minutes.length > 0 ? minutes.reduce((sum, value) => sum + value, 0) / minutes.length : 0;
	const p50Minutes = medianFromSorted(minutes);
	const p90Minutes = percentileFromSorted(minutes, 0.9);

	const retentionRows = await env.DB
		.prepare(
			`SELECT
				d0.day AS day,
				COUNT(DISTINCT d0.anon_id) AS d0_users,
				COUNT(DISTINCT d1.anon_id) AS d1_retained
			 FROM telemetry_daily d0
			 LEFT JOIN telemetry_daily d1
				ON d1.anon_id = d0.anon_id
				AND d1.day = date(d0.day, '+1 day')
			 WHERE d0.day BETWEEN ? AND ?
			 GROUP BY d0.day
			 ORDER BY d0.day DESC`,
		)
		.bind(retentionStart, today)
		.all<TelemetryRetentionRow>();
	const retentionMap = new Map<string, { d0: number; retained: number }>();
	for (const row of retentionRows.results ?? []) {
		retentionMap.set(row.day, {
			d0: Number(row.d0_users ?? 0),
			retained: Number(row.d1_retained ?? 0),
		});
	}

	const retention = retentionDays.map((day) => {
		const row = retentionMap.get(day) ?? { d0: 0, retained: 0 };
		const d1RetentionPct = row.d0 > 0 ? (row.retained / row.d0) * 100 : 0;
		return {
			day,
			d0Users: row.d0,
			d1Retained: row.retained,
			d1RetentionPct,
		};
	});

	return jsonResponse(
		{
			ok: true,
			summary: {
				day: today,
				dauToday,
				dauYesterday,
				dau7Avg,
				sessionsToday,
				avgSessionMinutesToday,
				submitsToday,
			},
			sessionLengthToday: {
				count: minutes.length,
				meanMinutes,
				p50Minutes,
				p90Minutes,
			},
			retention,
		},
		200,
		origin,
	);
}

async function handleAdminApi(request: Request, env: AppEnv, origin: string | null, pathname: string): Promise<Response> {
	if (request.method === "GET" && pathname === "/admin/api/search") {
		return handleAdminSearch(request, env, origin);
	}
	if (request.method === "GET" && pathname === "/admin/api/run") {
		return handleAdminRun(request, env, origin);
	}
	if (request.method === "GET" && pathname === "/admin/api/metrics") {
		return handleAdminMetrics(env, origin);
	}
	if (request.method === "POST" && pathname === "/admin/api/update") {
		return handleAdminUpdate(request, env, origin);
	}
	if (request.method === "POST" && pathname === "/admin/api/hide") {
		return handleAdminHide(request, env, origin);
	}
	if (request.method === "POST" && pathname === "/admin/api/delete") {
		return handleAdminDelete(request, env, origin);
	}
	return jsonResponse({ ok: false, error: "Not Found" }, 404, origin);
}

function formatTopPercent(percentile: number): string {
	return `${percentile.toFixed(2)}%`;
}

async function handleSharePage(request: Request, env: AppEnv, origin: string | null): Promise<Response> {
	const url = new URL(request.url);
	const shareId = decodeURIComponent(url.pathname.replace(/^\/share\//, "").trim());
	if (!shareId) {
		return htmlResponse("<h1>Not Found</h1>", 404, origin);
	}

	const row = await findRunByShareId(env.DB, shareId);

	if (!row) {
		return htmlResponse("<h1>Share Not Found</h1>", 404, origin);
	}

	const [credit, thigh] = await Promise.all([
		computeRank(env.DB, "final_credits", row.final_credits),
		computeRank(env.DB, "final_thigh_cm", row.final_thigh_cm),
	]);

	const lang = detectLang(request);
	const endingTitle = getEndingTitle(row.ending_id, lang);
	const bestTop = Math.min(credit.percentileTop, thigh.percentileTop);
	const bestTopText = bestTop.toFixed(1);
	const ogTitle = `${row.nickname}의 점수는?`;
	const ogDescription = `${row.nickname}님은 상위 ${bestTopText}%입니다`;
	const ogImage = "https://yuukagrowdist.pages.dev/assets/yuuka/yuuka_head.png";
	const escapedTitle = escapeHtml(ogTitle);
	const escapedDescription = escapeHtml(ogDescription);
	const escapedOgImage = escapeHtml(ogImage);
	const escapedNickname = escapeHtml(row.nickname);
	const escapedScoreTitle = escapeHtml(`${row.nickname}'s Score`);
	const escapedEnding = escapeHtml(endingTitle);

	const html = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta property="og:title" content="${escapedTitle}" />
  <meta property="og:description" content="${escapedDescription}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${escapedOgImage}" />
  <meta property="og:image:width" content="500" />
  <meta property="og:image:height" content="500" />
  <title>${escapedTitle}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
      color: #0f1624;
      background:
        radial-gradient(900px 700px at 50% 20%, rgba(71, 198, 255, 0.16), rgba(71, 198, 255, 0) 60%),
        linear-gradient(180deg, #e9f1fb, #dbe7f6);
    }
    main {
      min-height: 100svh;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }
    .card {
      width: min(680px, 94vw);
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.35);
      background: rgba(255, 255, 255, 0.88);
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.22);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .card-inner {
      padding: 20px;
      display: grid;
      gap: 14px;
    }
    .share-header {
      margin: -20px -20px 0;
      padding: 16px 20px 14px;
      background: rgba(15, 22, 36, 0.04);
      border-bottom: 1px solid rgba(15, 22, 36, 0.12);
      border-top-left-radius: 18px;
      border-top-right-radius: 18px;
    }
    .title {
      margin: 0;
      font-size: clamp(1.25rem, 2.2vw, 1.6rem);
      font-weight: 800;
      letter-spacing: 0.01em;
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-underline-offset: 6px;
      text-decoration-color: rgba(71, 198, 255, 0.65);
    }
    .stats-list,
    .top-list {
      margin: 0;
      display: grid;
      gap: 8px;
    }
    .stat-row {
      display: grid;
      grid-template-columns: 96px 1fr;
      gap: 10px;
      align-items: center;
    }
    .stat-row dt {
      margin: 0;
      color: #5a6578;
      font-size: 0.92rem;
    }
    .stat-row dd {
      margin: 0;
      color: #1d2738;
      font-weight: 700;
      font-size: 0.96rem;
      word-break: break-word;
    }
    .divider {
      border-top: 1px solid rgba(15, 22, 36, 0.12);
      margin-top: 2px;
      padding-top: 12px;
    }
    .top-list .stat-row dt,
    .top-list .stat-row dd {
      font-size: 0.9rem;
    }
    .play-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      min-height: 44px;
      padding: 10px 16px;
      border-radius: 12px;
      border: 1px solid rgba(71, 198, 255, 0.6);
      background: linear-gradient(180deg, rgba(71, 198, 255, 0.22), rgba(42, 174, 255, 0.14));
      color: #102035;
      text-decoration: none;
      font-weight: 700;
    }
    .play-link:active { transform: scale(0.99); }
    @media (max-height: 760px) {
      main { align-items: flex-start; }
    }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <div class="card-inner">
        <header class="share-header">
          <h1 class="title">${escapedScoreTitle}</h1>
        </header>
        <dl class="stats-list">
          <div class="stat-row"><dt>Ending</dt><dd>${escapedEnding}</dd></div>
          <div class="stat-row"><dt>Days</dt><dd>${row.survival_days}</dd></div>
          <div class="stat-row"><dt>Credits</dt><dd>${row.final_credits}</dd></div>
          <div class="stat-row"><dt>Thigh</dt><dd>${row.final_thigh_cm} cm</dd></div>
          <div class="stat-row"><dt>Stage</dt><dd>${row.final_stage}</dd></div>
        </dl>
        <div class="divider">
          <dl class="top-list">
            <div class="stat-row"><dt>Credit Top</dt><dd>${formatTopPercent(credit.percentileTop)}</dd></div>
            <div class="stat-row"><dt>Thigh Top</dt><dd>${formatTopPercent(thigh.percentileTop)}</dd></div>
          </dl>
        </div>
        <a class="play-link" href="/">Play</a>
      </div>
    </section>
  </main>
</body>
</html>`;

	return htmlResponse(html, 200, origin);
}

function routeApiNotFound(origin: string | null): Response {
	return jsonResponse({ ok: false, error: "Not Found" }, 404, origin);
}

export default {
	async fetch(request: Request, env: AppEnv): Promise<Response> {
		const url = new URL(request.url);
		const origin = getAllowedCorsOrigin(request);
		const pathname = url.pathname;

		if (pathname === "/admin" || pathname.startsWith("/admin/")) {
			const denied = requireAdminAuth(request, env);
			if (denied) return denied;

			if (request.method === "GET" && pathname === "/admin") {
				return htmlResponse(renderAdminPageHtml(), 200, origin);
			}
			if (pathname.startsWith("/admin/api/")) {
				return handleAdminApi(request, env, origin, pathname);
			}
			return new Response("Not Found", { status: 404 });
		}

		if (request.method === "OPTIONS") {
			return optionsResponse(origin);
		}

		try {
			if (pathname.startsWith("/api/telemetry/")) {
				return await handleTelemetryApi(request, env, origin, pathname);
			}
			if (request.method === "POST" && pathname === "/api/submit") {
				return await handleSubmit(request, env, origin);
			}
			if (request.method === "POST" && pathname === "/api/rank-preview") {
				return await handleRankPreview(request, env, origin);
			}
			if (request.method === "GET" && pathname === "/api/leaderboard") {
				return await handleLeaderboard(request, env, origin);
			}
			if (request.method === "GET" && pathname.startsWith("/share/")) {
				return await handleSharePage(request, env, origin);
			}
			if (pathname.startsWith("/api/")) {
				return routeApiNotFound(origin);
			}
			return new Response("Yuuka Grow API", { status: 200 });
		} catch (error) {
			console.error("Unhandled error", error);
			return jsonResponse({ ok: false, error: "Internal Server Error" }, 500, origin);
		}
	},
} satisfies ExportedHandler<AppEnv>;
