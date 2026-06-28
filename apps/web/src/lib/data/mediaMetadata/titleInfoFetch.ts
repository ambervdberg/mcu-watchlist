// Build-time port of apps/api/src/media/titleInfoFetcher.ts. The mapping/scoring logic
// is intentionally identical to the API version (same upstream shapes, same trailer
// scoring heuristic) — this is a straight copy of behavior, not a reimplementation,
// so the two stay in lockstep until apps/api/src/media is deleted in a later subtask
// (marvel-h8a.3) and this file becomes the only copy.
import { fetchJsonWithRawCache } from './rawResponseCache';

/** OMDb/IMDb-sourced plot, rating, poster, runtime, and trailer metadata for a title. */
export type TitleInfo = {
	plot: string;
	imdbRating: string;
	poster: string;
	runtimeMinutes: number | null;
	released: string;
	trailer: TrailerInfo | null;
};

/** Trailer metadata picked from imdbapi.dev's videos endpoint. */
export type TrailerInfo = {
	id: string;
	name: string;
	description: string;
	url: string;
	embedUrl: string;
	imageUrl: string;
	runtimeSeconds: number | null;
};

/** OMDb's sentinel for a field it has no value for; treated the same as an empty string. */
function isMissingText(value: string): boolean {
	return value === '' || value === 'N/A';
}

/**
 * Merges a freshly-fetched {@link TitleInfo} over the last-known-good snapshot value so the
 * snapshot quality is monotonic: a field only ever refreshes to a *real* value, never
 * regresses to a sentinel. OMDb intermittently returns "N/A"/empty for a field even on an
 * otherwise-successful call; without this, that transient sentinel would overwrite good data
 * (e.g. wipe a real poster). Each field keeps `live` when it carries a real value, else falls
 * back to `prior`. Trailer needs no special-casing here: the loader only ever fetches a
 * trailer when none is cached (titleInfoLoader.ts), so a failed lookup leaves `live.trailer`
 * null with no prior trailer to lose, and a successful build either reuses the cached trailer
 * or finds a new one -- either way `live.trailer` is authoritative.
 */
export function mergeTitleInfoWithPrior(live: TitleInfo, prior: TitleInfo | undefined): TitleInfo {
	if (!prior) {
		return live;
	}

	return {
		plot: shouldKeepPriorPlot(live.plot, prior.plot) ? prior.plot : live.plot,
		imdbRating: isMissingText(live.imdbRating) && !isMissingText(prior.imdbRating) ? prior.imdbRating : live.imdbRating,
		poster: isMissingText(live.poster) && !isMissingText(prior.poster) ? prior.poster : live.poster,
		runtimeMinutes:
			live.runtimeMinutes === null && prior.runtimeMinutes !== null ? prior.runtimeMinutes : live.runtimeMinutes,
		released: isMissingText(live.released) && !isMissingText(prior.released) ? prior.released : live.released,
		trailer: live.trailer
	};
}

/** Keeps richer existing plot text when a new provider only supplies a shorter summary. */
function shouldKeepPriorPlot(livePlot: string, priorPlot: string): boolean {
	return isMissingText(livePlot) || (!isMissingText(priorPlot) && priorPlot.length > livePlot.length);
}

type OmdbResponse = {
	Response: string;
	Plot?: string;
	imdbRating?: string;
	Poster?: string;
	Runtime?: string;
	Released?: string;
};

type ImdbApiDevResponse = {
	plot?: string;
	primaryImage?: {
		url?: string;
	};
	runtimeSeconds?: number;
	rating?: {
		aggregateRating?: number;
	};
};

type ImdbVideo = {
	id?: string;
	type?: string;
	name?: string;
	primaryImage?: {
		url?: string;
	};
	description?: string;
	runtimeSeconds?: number;
};

type ImdbVideosResponse = {
	videos?: ImdbVideo[];
};

type RawFetchOptions = {
	cacheRoot?: string;
	refreshRawCache?: boolean;
};

/** Parses OMDb runtime strings like "126 min" into minutes. */
function parseRuntimeMinutes(runtime: string | undefined): number | null {
	if (!runtime) {
		return null;
	}

	const match = new RegExp(/(\d+)/).exec(runtime);

	return match ? Number(match[1]) : null;
}

/** Converts IMDb runtime seconds into whole minutes for display. */
function runtimeSecondsToMinutes(runtimeSeconds: number | undefined): number | null {
	return typeof runtimeSeconds === 'number' ? Math.round(runtimeSeconds / 60) : null;
}

/** Maps imdbapi.dev title metadata into the local title info DTO. */
function mapImdbApiDevTitle(data: ImdbApiDevResponse, trailer: TrailerInfo | null, isSeriesSeason: boolean): TitleInfo {
	const aggregateRating = data.rating?.aggregateRating;

	return {
		plot: data.plot ?? '',
		imdbRating: typeof aggregateRating === 'number' ? aggregateRating.toFixed(1) : 'N/A',
		poster: data.primaryImage?.url ?? 'N/A',
		runtimeMinutes: isSeriesSeason ? null : runtimeSecondsToMinutes(data.runtimeSeconds),
		released: 'N/A',
		trailer
	};
}

/** Returns true when imdbapi.dev supplied enough fields to avoid an OMDb call. */
function hasUsableTitleMetadata(titleInfo: TitleInfo): boolean {
	return (
		!isMissingText(titleInfo.plot) ||
		!isMissingText(titleInfo.imdbRating) ||
		!isMissingText(titleInfo.poster) ||
		titleInfo.runtimeMinutes !== null
	);
}

/** Reads OMDb key from Astro-loaded .env first, then plain Node env. */
function getOmdbApiKey(): string | undefined {
	return import.meta.env.OMDB_API_KEY || process.env.OMDB_API_KEY;
}

// IMDb's videos endpoint has no season/episode metadata field; the season a
// trailer belongs to (if any) only ever shows up inside its name, e.g.
// "Season 3: Official Trailer" or "Marvel's Daredevil: Season 1". Season-less
// names (most movies, and some shows' generic trailers) match neither branch
// and fall through to the keyword scoring below untouched.
function scoreSeasonMatch(name: string, season: string | undefined): number {
	if (!season) {
		return 0;
	}

	const match = name.match(/season\s+(\d+)/);

	if (!match) {
		return 0;
	}

	return Number(match[1]) === Number(season) ? 50 : -50;
}

/** Returns a weighted value for picking the most useful trailer from IMDb videos. */
function scoreTrailer(video: ImdbVideo, season: string | undefined): number {
	const name = video.name?.toLowerCase() ?? '';
	const description = video.description?.toLowerCase() ?? '';
	let score = scoreSeasonMatch(name, season);

	// Prefer the canonical official trailer over regional cuts or shorter peeks.
	if (name.includes('official trailer')) score += 30;
	if (description.includes('official trailer')) score += 15;
	if (name.includes('trailer')) score += 10;
	if (name.includes('teaser')) score -= 5;
	if (name.includes('sneak peek')) score -= 10;

	return score;
}

/** Creates a stable IMDb video URL for the selected video id. */
function createTrailerUrl(videoId: string): string {
	return `https://www.imdb.com/video/${encodeURIComponent(videoId)}/`;
}

/** Creates a stable IMDb embed URL for in-app trailer playback. */
function createTrailerEmbedUrl(videoId: string): string {
	return `https://www.imdb.com/videoembed/${encodeURIComponent(videoId)}`;
}

/**
 * Fetches the best available trailer from imdbapi.dev with exponential backoff for rate limits.
 *
 * Returns `null` ONLY when the lookup completed and the title genuinely has no
 * trailer. THROWS on any upstream failure (network error, non-2xx, rate limit after retries)
 * so the caller can tell "no trailer exists" apart from "lookup failed" — the
 * latter must preserve a previously-known trailer rather than overwrite it with
 * `null`.
 */
async function fetchTrailer(
	imdbId: string,
	season: string | undefined,
	options: RawFetchOptions | undefined
): Promise<TrailerInfo | null> {
	let lastError: Error | null = null;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const data = await fetchJsonWithRawCache<ImdbVideosResponse>({
				descriptor: { source: 'imdbapi.dev', endpoint: 'videos', key: imdbId },
				url: `https://api.imdbapi.dev/titles/${encodeURIComponent(imdbId)}/videos`,
				cacheRoot: options?.cacheRoot,
				refresh: options?.refreshRawCache
			});

			if (!data) {
				const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			// Success; break out and process response
			return processTrailerResponse(data, imdbId, season);
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (attempt < 2) {
				const delay = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	// All retries exhausted
	throw lastError ?? new Error('Unknown error fetching trailer');
}

async function processTrailerResponse(
	data: ImdbVideosResponse,
	imdbId: string,
	season: string | undefined
): Promise<TrailerInfo | null> {
	const trailers = (data.videos ?? []).filter((video) => video.id && video.type === 'trailer');
	const [trailer] = trailers.toSorted((a, b) => scoreTrailer(b, season) - scoreTrailer(a, season));

	if (!trailer?.id) {
		console.debug(`[titleInfoFetch] no trailer found for ${imdbId}`);
		return null;
	}

	const result = {
		id: trailer.id,
		name: trailer.name ?? 'Trailer',
		description: trailer.description ?? '',
		url: createTrailerUrl(trailer.id),
		embedUrl: createTrailerEmbedUrl(trailer.id),
		imageUrl: trailer.primaryImage?.url ?? '',
		runtimeSeconds: typeof trailer.runtimeSeconds === 'number' ? trailer.runtimeSeconds : null
	};
	console.debug(`[titleInfoFetch] found trailer for ${imdbId}: ${result.id}`);
	return result;
}

// The trailer lives behind a separate, flakier upstream (imdbapi.dev) than the OMDb call.
// The loader only passes a cachedTrailer once one is known (trailers are immutable once
// published), so we fetch only when none is cached yet; a failed lookup leaves trailer null
// without losing anything, and the loader simply tries again on the next build.
async function resolveTrailer(
	imdbId: string,
	season: string | undefined,
	cachedTrailer: { trailer: TrailerInfo } | undefined,
	options: RawFetchOptions | undefined
): Promise<TrailerInfo | null> {
	if (cachedTrailer) {
		return cachedTrailer.trailer;
	}

	try {
		return await fetchTrailer(imdbId, season, options);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`[titleInfoFetch] trailer fetch failed for ${imdbId}: ${message}`);
		return null;
	}
}

/** Returns usable imdbapi.dev title metadata, or null on upstream failure / insufficient data. */
async function tryFetchImdbApiDevTitleInfo(
	imdbId: string,
	season: string | undefined,
	trailer: TrailerInfo | null,
	options: RawFetchOptions | undefined
): Promise<TitleInfo | null> {
	try {
		const data = await fetchJsonWithRawCache<ImdbApiDevResponse>({
			descriptor: { source: 'imdbapi.dev', endpoint: 'titles', key: imdbId },
			url: `https://api.imdbapi.dev/titles/${encodeURIComponent(imdbId)}`,
			cacheRoot: options?.cacheRoot,
			refresh: options?.refreshRawCache
		});

		if (!data) {
			return null;
		}

		const titleInfo = mapImdbApiDevTitle(data, trailer, Boolean(season));

		return hasUsableTitleMetadata(titleInfo) ? titleInfo : null;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`[titleInfoFetch] imdbapi.dev title fetch failed for ${imdbId}: ${message}`);
		return null;
	}
}

/** Fetches title metadata from OMDb. Throws when the key is missing or OMDb has no data. */
async function fetchOmdbTitleInfo(
	imdbId: string,
	trailer: TrailerInfo | null,
	options: RawFetchOptions | undefined
): Promise<TitleInfo> {
	const apiKey = getOmdbApiKey();

	if (!apiKey) {
		throw new Error('OMDB_API_KEY is not configured.');
	}

	const data = await fetchJsonWithRawCache<OmdbResponse>({
		descriptor: { source: 'omdb', endpoint: 'titles', key: imdbId },
		url: `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${apiKey}&plot=full`,
		cacheRoot: options?.cacheRoot,
		refresh: options?.refreshRawCache
	});

	if (!data) {
		throw new Error('OMDb request failed.');
	}

	if (data.Response !== 'True') {
		throw new Error('OMDb returned no data for this title.');
	}

	return {
		plot: data.Plot ?? '',
		imdbRating: data.imdbRating ?? 'N/A',
		poster: data.Poster ?? 'N/A',
		runtimeMinutes: parseRuntimeMinutes(data.Runtime),
		released: data.Released ?? 'N/A',
		trailer
	};
}

/**
 * Fetches imdbapi.dev title metadata, then falls back to OMDb when it is not usable.
 *
 * Throws only when imdbapi.dev could not provide usable title data and OMDb is missing,
 * fails, or returns no data; the loader falls back to the committed snapshot.
 */
export async function fetchTitleInfo(
	imdbId: string,
	season: string | undefined,
	// When the snapshot already holds an actual trailer for this title, the caller passes it
	// here so we reuse it and skip the imdbapi.dev videos call entirely. Trailers are
	// effectively immutable once published, so re-fetching them only burns rate limit on the
	// flakier upstream (the source of the trailer-wipe bug). When no trailer is cached yet we
	// look again. `undefined` = no trailer cached, do the lookup; `{ trailer }` = reuse it.
	cachedTrailer?: { trailer: TrailerInfo },
	priorTitleInfo?: TitleInfo,
	options?: RawFetchOptions
): Promise<TitleInfo> {
	const trailer = await resolveTrailer(imdbId, season, cachedTrailer, options);

	const imdbApiDevTitleInfo = await tryFetchImdbApiDevTitleInfo(imdbId, season, trailer, options);

	if (imdbApiDevTitleInfo) {
		return imdbApiDevTitleInfo;
	}

	if (priorTitleInfo && hasUsableTitleMetadata(priorTitleInfo)) {
		return { ...priorTitleInfo, trailer };
	}

	return fetchOmdbTitleInfo(imdbId, trailer, options);
}
