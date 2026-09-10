// Resolves an IMDb id to its TMDB id via TMDB's /find endpoint.
import { fetchJsonWithRawCache, type RawFetchOptions } from '../rawResponseCache';
import { getTmdbApiKey } from './tmdbKey';

/** The kind of TMDB entity a resolved id refers to. */
export type TmdbKind = 'movie' | 'tv';

/** A TMDB id resolved from an IMDb id, together with its entity kind. */
export type TmdbIdResult = {
	id: number;
	kind: TmdbKind;
};

type TmdbFindResponse = {
	movie_results?: Array<{ id: number }>;
	tv_results?: Array<{ id: number }>;
};

/** Resolves an IMDb id to a TMDB id and kind. Null when TMDB has neither a movie nor a tv match. */
export async function resolveTmdbId(imdbId: string, options?: RawFetchOptions): Promise<TmdbIdResult | null> {
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

	return firstMovieResult(data) ?? firstTvResult(data);
}

/** Picks the first movie match, when TMDB found one. */
function firstMovieResult(data: TmdbFindResponse): TmdbIdResult | null {
	const [movie] = data.movie_results ?? [];

	return movie ? { id: movie.id, kind: 'movie' } : null;
}

/** Picks the first tv match, when TMDB found one. */
function firstTvResult(data: TmdbFindResponse): TmdbIdResult | null {
	const [tv] = data.tv_results ?? [];

	return tv ? { id: tv.id, kind: 'tv' } : null;
}
