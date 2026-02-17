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

interface RankOutput {
	rank: number;
	total: number;
	percentileTop: number;
}

const CORS_METHODS = "GET, POST, OPTIONS";
const CORS_HEADERS = "Content-Type";
const ENDING_CATEGORY_SET = new Set<EndingCategory>(["normal", "bankrupt", "stress", "special", "any"]);
const PRODUCTION_ORIGIN = "https://yuukagrow.pangyostonefist.org";
const STATIC_OG_IMAGE_URL = `${PRODUCTION_ORIGIN}/assets/yuuka/yuuka_head.png`;
let runIdSchemaEnsured = false;
let adminSchemaEnsured = false;

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
	`;
	bindings.push(limit);
	const rows = await env.DB.prepare(sql).bind(...bindings).all<RunRecord>();
	return jsonResponse({ ok: true, items: rows.results ?? [] }, 200, origin);
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

async function handleAdminApi(request: Request, env: AppEnv, origin: string | null, pathname: string): Promise<Response> {
	if (request.method === "GET" && pathname === "/admin/api/search") {
		return handleAdminSearch(request, env, origin);
	}
	if (request.method === "GET" && pathname === "/admin/api/run") {
		return handleAdminRun(request, env, origin);
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
	const ogDescription = `${row.nickname}의 점수는 상위 ${bestTopText}%입니다`;
	const escapedTitle = escapeHtml(ogTitle);
	const escapedDescription = escapeHtml(ogDescription);
	const escapedNickname = escapeHtml(row.nickname);
	const escapedEnding = escapeHtml(endingTitle);

	const html = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta property="og:title" content="${escapedTitle}" />
  <meta property="og:description" content="${escapedDescription}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${STATIC_OG_IMAGE_URL}" />
  <meta property="og:image:width" content="500" />
  <meta property="og:image:height" content="500" />
  <title>${escapedTitle}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #faf8ff; color: #1f1b2d; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 20px; }
    .card { width: min(520px, 92vw); background: #fff; border-radius: 16px; border: 1px solid #e6dff5; box-shadow: 0 16px 40px rgba(40, 18, 68, 0.08); padding: 22px; }
    h1 { margin: 0 0 12px; font-size: 1.35rem; }
    p { margin: 6px 0; }
    .meta { margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee6ff; }
    a { display: inline-block; margin-top: 14px; text-decoration: none; background: #e267b4; color: #fff; padding: 10px 16px; border-radius: 10px; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>${escapedNickname}</h1>
      <p><strong>Ending:</strong> ${escapedEnding}</p>
      <p><strong>Days:</strong> ${row.survival_days}</p>
      <p><strong>Credits:</strong> ${row.final_credits}</p>
      <p><strong>Thigh:</strong> ${row.final_thigh_cm} cm</p>
      <p><strong>Stage:</strong> ${row.final_stage}</p>
      <div class="meta">
        <p><strong>Credit Top:</strong> ${formatTopPercent(credit.percentileTop)}</p>
        <p><strong>Thigh Top:</strong> ${formatTopPercent(thigh.percentileTop)}</p>
      </div>
      <a href="/">Play</a>
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
			if (request.method === "POST" && pathname === "/api/submit") {
				return await handleSubmit(request, env, origin);
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
