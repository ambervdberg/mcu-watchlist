// Shared OMDb by-season episode list fetch. Both the season premiere date
// (titleInfoFetch.ts) and each episode's imdbRating (episodeInfoFetch.ts) read this
// same response, so it is fetched once per season and cached through fetchJsonWithRawCache.
import { fetchJsonWithRawCache, type RawFetchOptions } from '../rawResponseCache';

/** One episode entry in OMDb's by-season response. */
export type OmdbSeasonEpisode = {
	Episode?: string;
	Released?: string;
	imdbRating?: string;
};

type OmdbSeasonResponse = {
	Response: string;
	Episodes?: OmdbSeasonEpisode[];
};

/**
 * Fetches OMDb's by-season episode list for one series season.
 *
 * Null on a missing/invalid season, an upstream failure, or a network error -- callers
 * treat all three the same way: an unresolved premiere date, or an episode rating of 'N/A'.
 */
export async function fetchOmdbSeason(
	imdbId: string,
	season: string,
	apiKey: string,
	options?: RawFetchOptions
): Promise<OmdbSeasonEpisode[] | null> {
	try {
		const data = await fetchJsonWithRawCache<OmdbSeasonResponse>({
			descriptor: { source: 'omdb', endpoint: 'season', key: `${imdbId}-s${season}` },
			url: `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&Season=${encodeURIComponent(season)}&apikey=${apiKey}`,
			cacheRoot: options?.cacheRoot,
			refresh: options?.refreshRawCache
		});

		return data && data.Response === 'True' ? (data.Episodes ?? []) : null;
	} catch {
		return null;
	}
}

/** Finds one episode's OMDb data in a season's episode list, matched by episode number. */
export function findOmdbEpisode(
	episodes: OmdbSeasonEpisode[] | null,
	episodeNumber: number
): OmdbSeasonEpisode | undefined {
	return episodes?.find((episode) => Number(episode.Episode) === episodeNumber);
}
