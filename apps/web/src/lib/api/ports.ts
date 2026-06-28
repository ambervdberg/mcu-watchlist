// Gateway interfaces (ports) for the data-access boundary, plus the request
// and response DTOs that describe the existing Azure Functions API contract
// (see docs/superpowers/specs/2026-06-23-svelte-frontend-rebuild-design.md
// section 2). The app depends on these abstractions, never on a concrete
// HTTP or fake implementation directly (Dependency Inversion) — see
// http-gateways.ts and fakes.ts for the two implementations.
//
// Deliberately independent of src/lib/domain: the api layer sits below
// domain in the dependency graph (api -> domain would be backwards), so
// these DTOs are plain, locally-defined shapes rather than imported domain
// types, even where they overlap with one.

/** Response shape of GET /api/me (apps/api/src/functions/me.ts). */
export type MeResponse = { authenticated: false } | { authenticated: true; user: { id: string; email: string } };

/** Request body for POST /api/auth/request-link. */
export type RequestLinkRequest = {
	email: string;
	/** Where consume-link should redirect after a successful sign-in. */
	returnPath?: string;
};

/** Response body for POST /api/auth/request-link (also used for the 400 validation-error body). */
export type RequestLinkResponse = {
	message: string;
};

/**
 * Reads and mutates the current user's session: who is signed in, and the
 * sign-in/sign-out actions. Backed by GET /api/me, POST /api/auth/request-link,
 * and POST /api/logout.
 */
export interface SessionGateway {
	/** Fetches the current session state. Never throws on anonymous; that is a normal `{ authenticated: false }` result. */
	me(): Promise<MeResponse>;

	/** Requests a magic sign-in link be emailed for `email`, redirecting to `returnPath` once consumed. */
	requestLink(request: RequestLinkRequest): Promise<RequestLinkResponse>;

	/** Clears the local session cookie server-side. Does not touch stored progress. */
	logout(): Promise<void>;
}

/** Trailer metadata shape (mirrors TrailerInfo in lib/data/mediaMetadata/titleInfoFetch.ts). */
export type TrailerDto = {
	id: string;
	name: string;
	description: string;
	url: string;
	embedUrl: string;
	imageUrl: string;
	runtimeSeconds: number | null;
};

/** Title info shape (matches titleInfo collection schema in content.config.ts). */
export type TitleInfoDto = {
	plot: string;
	imdbRating: string;
	poster: string;
	runtimeMinutes: number | null;
	released: string;
	trailer: TrailerDto | null;
};

/** Episode entry shape (matches episodeSchema in content.config.ts). */
export type EpisodeDto = {
	id: string;
	title: string;
	episodeNumber: number;
	runtimeSeconds: number | null;
	plot: string;
	posterUrl: string;
	imdbRating: string;
	released: string;
};

/** Episodes collection entry (matches episodes schema in content.config.ts). */
export type EpisodesCollectionDto = {
	episodes: EpisodeDto[];
	totalCount: number;
};

/** Shape shared by GET and PUT /api/progress (apps/api/src/functions/progress.ts). */
export type ProgressDto = {
	watchedIds: string[];
	skippedIds: string[];
	watchedDates: Record<string, string>;
	watchedEpisodes: Record<string, string[]>;
};

/**
 * Loads and saves the signed-in user's watched/skipped progress. Backed by
 * GET and PUT /api/progress, both of which require an authenticated session.
 */
export interface ProgressGateway {
	/**
	 * Loads the current user's progress.
	 *
	 * Resolves to `null` when the visitor is anonymous (the API returns 401),
	 * which callers must treat as "no progress yet", not as an error. Any
	 * other non-OK response still rejects with an ApiError, since that is a
	 * genuine failure rather than an expected anonymous state.
	 */
	load(): Promise<ProgressDto | null>;

	/** Persists progress for the current user. The server echoes back the saved shape. */
	save(progress: ProgressDto): Promise<ProgressDto>;
}
