// The data-access boundary's lowest layer: a single fetch wrapper plus the
// error type every gateway throws on a non-OK response.
//
// Every request below uses credentials: "same-origin" so the HttpOnly signed
// session cookie (see apps/api/src/auth.ts) rides along automatically.

/**
 * Thrown by fetchJson whenever the server responds with a non-2xx status.
 * Carries both the HTTP status and the parsed JSON body (when present), so
 * callers can surface a server-provided validation message (e.g. "Enter a
 * valid email address.") instead of a generic error. `body` is `null` when
 * the response had no body or a non-JSON body.
 */
export class ApiError extends Error {
	readonly status: number;
	readonly body: unknown;

	constructor(message: string, status: number, body: unknown) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.body = body;
	}
}

/** Options accepted by fetchJson. A thin, typed subset of RequestInit. */
export type FetchJsonOptions = {
	method?: 'GET' | 'POST' | 'PUT';
	/** Serialized to JSON and sent with a Content-Type: application/json header. */
	body?: unknown;
};

/**
 * Reads a fetch Response body as JSON, tolerating an empty or non-JSON body
 * by resolving to null instead of throwing. Some endpoints (e.g. logout) can
 * return an empty body on success, and a malformed body should never mask the
 * real HTTP status in the thrown ApiError.
 */
async function readJsonBody(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

/**
 * Performs a fetch against `path` and resolves with the parsed JSON body.
 *
 * - Always sends `credentials: "same-origin"` so the session cookie is included.
 * - When `options.body` is provided, it is JSON-serialized and a
 *   `Content-Type: application/json` header is attached.
 * - On a non-OK response, throws an ApiError carrying the status and the
 *   parsed (or null) body instead of resolving.
 * - On an OK response with an empty/non-JSON body, resolves with null rather
 *   than throwing, since some success responses (e.g. logout) have no body.
 */
export async function fetchJson<T = unknown>(path: string, options: FetchJsonOptions = {}): Promise<T> {
	const hasBody = options.body !== undefined;

	const response = await fetch(path, {
		method: options.method ?? 'GET',
		credentials: 'same-origin',
		headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
		body: hasBody ? JSON.stringify(options.body) : undefined
	});

	if (!response.ok) {
		const errorBody = await readJsonBody(response);
		throw new ApiError(`${options.method ?? 'GET'} ${path} failed with ${response.status}`, response.status, errorBody);
	}

	return (await readJsonBody(response)) as T;
}
