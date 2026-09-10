// Resolves an IMDb id to its TMDB id via TMDB's /find endpoint.
import { fetchJsonWithRawCache, type RawFetchOptions } from '../rawResponseCache';
import { getTmdbApiKey } from './tmdbKey';

/** The kind of TMDB entity to resolve an IMDb id into. */
export type TmdbKind = 'movie' | 'tv';

type TmdbFindResponse = {
	movie_results?: Array<{ id: number }>;
	tv_results?: Array<{ id: number }>;
};

/**
 * Resolves an IMDb id to a TMDB id of the given kind.
 *
 * TMDB's /find can return both a movie and a tv match for the same IMDb id -- a series and
 * an unrelated movie sometimes share one. There is no way to pick the right one from the
 * response alone, so the caller must say which kind it wants. Null when TMDB has no match
 * of that kind.
 */
export async function resolveTmdbId(imdbId: string, kind: TmdbKind, options?: RawFetchOptions): Promise<number | null> {
	const apiKey = getTmdbApiKey();

	const data = await fetchJsonWithRawCache<TmdbFindResponse>({
		descriptor: { source: 'tmdb', endpoint: 'find', key: imdbId },
		url: `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id&api_key=${apiKey}`,
		cacheRoot: options?.cacheRoot,
		refresh: options?.refreshRawCache
	});

	if (!data) {
		return null;
	}

	return firstMatchOfKind(data, kind);
}

/** Picks the first result from the array matching the requested kind, when TMDB found one. */
function firstMatchOfKind(data: TmdbFindResponse, kind: TmdbKind): number | null {
	const results = kind === 'movie' ? data.movie_results : data.tv_results;
	const [match] = results ?? [];

	return match?.id ?? null;
}
