// Build-time title metadata fetch: OMDb for plot/rating/poster/runtime/released,
// TMDB for the trailer. See tmdb/ for the TMDB client this file is built on.
import { fetchJsonWithRawCache, type RawFetchOptions } from './rawResponseCache';
import { getOmdbApiKey } from './omdb/omdbKey';
import { fetchOmdbSeason, findOmdbEpisode } from './omdb/omdbSeason';
import { resolveTmdbId } from './tmdb/tmdbId';
import { fetchTrailerFromTmdb } from './tmdb/tmdbTrailer';

// Re-export public DTOs so existing importers (titleInfoLoader, tests, etc.) need no changes.
export type { TitleInfo, TrailerInfo } from './titleInfoTypes';
import type { TitleInfo, TrailerInfo } from './titleInfoTypes';

/**
 * Fetches title metadata for one catalog item: OMDb for plot/rating/poster/runtime, the
 * season's own premiere date for a series season, and a TMDB trailer when none is cached.
 *
 * Throws only when OMDB_API_KEY is missing or OMDb has no data for this title -- the
 * loader falls back to the committed snapshot on that failure. A trailer lookup failure
 * never throws, see resolveTrailer below.
 */
export async function fetchTitleInfo(
	imdbId: string,
	season: string | undefined,
	cachedTrailer?: { trailer: TrailerInfo },
	options?: RawFetchOptions
): Promise<TitleInfo> {
	const trailer = await resolveTrailer(imdbId, season, cachedTrailer, options);
	const apiKey = getOmdbApiKey();

	if (!apiKey) {
		throw new Error('OMDB_API_KEY is not configured.');
	}

	const omdbInfo = await fetchOmdbTitleInfo(imdbId, apiKey, options);
	const released = season
		? await resolveSeasonReleased(imdbId, season, apiKey, omdbInfo.released, options)
		: omdbInfo.released;

	return { ...omdbInfo, released, trailer };
}

/** OMDb's sentinel for a field it has no value for; treated the same as an empty string. */
function isMissingText(value: string): boolean {
	return value === '' || value === 'N/A';
}

/**
 * Merges a freshly-fetched {@link TitleInfo} over the last-known-good snapshot value.
 *
 * Never overwrites real prior data: plot, poster, runtimeMinutes and trailer keep the prior
 * value whenever it is real, since none of those change once a title is published -- a fresh
 * fetch only fills a gap (empty/`N/A`/`null`) that the prior entry never had a real value for.
 * `released` and `imdbRating` are the fields that genuinely do change over time (a season
 * gets a real air date, a rating keeps moving), so those take the live value whenever it is
 * real, falling back to prior only when live is a sentinel.
 */
export function mergeTitleInfoWithPrior(live: TitleInfo, prior: TitleInfo | undefined): TitleInfo {
	if (!prior) {
		return live;
	}

	return {
		plot: isMissingText(prior.plot) ? live.plot : prior.plot,
		imdbRating: isMissingText(live.imdbRating) ? prior.imdbRating : live.imdbRating,
		poster: isMissingText(prior.poster) ? live.poster : prior.poster,
		runtimeMinutes: prior.runtimeMinutes === null ? live.runtimeMinutes : prior.runtimeMinutes,
		released: isMissingText(live.released) ? prior.released : live.released,
		trailer: prior.trailer ?? live.trailer
	};
}

/**
 * Resolves the trailer for a title: reuses a cached trailer when one exists (trailers are
 * immutable once published), otherwise resolves the TMDB id and fetches its trailer. Never
 * throws -- a resolution or fetch failure just leaves the trailer `null` for this build.
 */
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
		const kind = season ? 'tv' : 'movie';
		const tmdbId = await resolveTmdbId(imdbId, kind, options);

		if (!tmdbId) {
			return null;
		}

		return await fetchTrailerFromTmdb(tmdbId, kind, season, options);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`[titleInfoFetch] trailer fetch failed for ${imdbId}: ${message}`);
		return null;
	}
}

type OmdbResponse = {
	Response: string;
	Plot?: string;
	imdbRating?: string;
	Poster?: string;
	Runtime?: string;
	Released?: string;
};

/** Title-level fields sourced from OMDb; `released` here is the show/movie level date. */
type OmdbTitleFields = Omit<TitleInfo, 'trailer'>;

/** Fetches title metadata from OMDb. Throws when OMDb has no data for this title. */
async function fetchOmdbTitleInfo(
	imdbId: string,
	apiKey: string,
	options: RawFetchOptions | undefined
): Promise<OmdbTitleFields> {
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
		released: data.Released ?? 'N/A'
	};
}

/**
 * Resolves a series season's own premiere date.
 *
 * Season 1's premiere always coincides with the show-level `Released` date (the show's
 * launch date IS its first season's premiere), so season 1 falls back to it when the
 * season lookup fails or has no real date yet. A later season has no such coincidence:
 * when it has no real premiere date of its own, it genuinely hasn't aired yet, so this
 * throws rather than borrowing an unrelated date -- the loader then skips creating an
 * entry for it entirely (see fetchTitleInfo's caller in titleInfoLoader.ts).
 */
async function resolveSeasonReleased(
	imdbId: string,
	season: string,
	apiKey: string,
	showReleased: string,
	options: RawFetchOptions | undefined
): Promise<string> {
	const premiereReleased = await fetchSeasonPremiereReleased(imdbId, season, apiKey, options);

	if (premiereReleased) {
		return premiereReleased;
	}

	if (season === '1') {
		return showReleased;
	}

	throw new Error(`No real premiere date yet for season ${season} of ${imdbId}.`);
}

/**
 * Released date of a season's episode 1, read from the shared OMDb by-season fetch and
 * converted to the snapshot's "DD Mon YYYY" format. Null on an upstream failure or a
 * not-yet-real date.
 */
async function fetchSeasonPremiereReleased(
	imdbId: string,
	season: string,
	apiKey: string,
	options: RawFetchOptions | undefined
): Promise<string | null> {
	const episodes = await fetchOmdbSeason(imdbId, season, apiKey, options);
	const premiereEpisode = findOmdbEpisode(episodes, 1);

	return isoDateToDisplayFormat(premiereEpisode?.Released);
}

/** Parses OMDb runtime strings like "126 min" into minutes. */
function parseRuntimeMinutes(runtime: string | undefined): number | null {
	if (!runtime) {
		return null;
	}

	const match = new RegExp(/(\d+)/).exec(runtime);

	return match ? Number(match[1]) : null;
}

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Converts OMDb's by-season "YYYY-MM-DD" date into the snapshot's "DD Mon YYYY" format. */
function isoDateToDisplayFormat(isoDate: string | undefined): string | null {
	const match = isoDate ? new RegExp(/^(\d{4})-(\d{2})-(\d{2})$/).exec(isoDate) : null;

	if (!match) {
		return null;
	}

	const [, year, month, day] = match;
	const monthName = MONTH_ABBREVIATIONS[Number(month) - 1];

	return monthName ? `${day} ${monthName} ${year}` : null;
}
