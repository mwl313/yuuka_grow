export interface AdminAuthEnv {
	ADMIN_USER?: string;
	ADMIN_PASS?: string;
}

function unauthorized(): Response {
	return new Response("Unauthorized", {
		status: 401,
		headers: {
			"WWW-Authenticate": 'Basic realm="Admin"',
			"content-type": "text/plain; charset=utf-8",
		},
	});
}

export function requireAdminAuth(request: Request, env: AdminAuthEnv): Response | null {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader || !authHeader.startsWith("Basic ")) {
		return unauthorized();
	}

	const user = env.ADMIN_USER ?? "";
	const pass = env.ADMIN_PASS ?? "";
	if (!user || !pass) {
		return unauthorized();
	}

	let decoded = "";
	try {
		decoded = atob(authHeader.slice(6));
	} catch {
		return unauthorized();
	}

	const separator = decoded.indexOf(":");
	if (separator < 0) return unauthorized();

	const inputUser = decoded.slice(0, separator);
	const inputPass = decoded.slice(separator + 1);
	if (inputUser !== user || inputPass !== pass) {
		return unauthorized();
	}
	return null;
}
