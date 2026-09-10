// Build-time episode list fetch: resolves the IMDb id to TMDB, fetches the season's
// episode list from TMDB, then overlays each episode's imdbRating from OMDb -- TMDB's own
// vote_average is a different audience on a different scale, not an IMDb rating.
// See tmdb/ for the TMDB client this file is built on.
import type { RawFetchOptions } from './rawResponseCache';
import { getOmdbApiKey } from './omdb/omdbKey';
import { fetchOmdbSeason, findOmdbEpisode } from './omdb/omdbSeason';
import { resolveTmdbId } from './tmdb/tmdbId';
import { fetchEpisodesFromTmdb } from './tmdb/tmdbEpisodes';

/** A single episode in one series season. */
export type Episode = {
	id: string;
	title: string;
	episodeNumber: number;
	runtimeSeconds: number | null;
	plot: string;
	posterUrl: string;
	imdbRating: string;
	released: string;
};

/** Episode list for one series season. */
export type EpisodeInfo = {
	episodes: Episode[];
	totalCount: number;
};

/**
 * Fetches TMDB's per-season episode list for an IMDb-identified series season, then
 * overlays each episode's real imdbRating from OMDb's by-season endpoint.
 *
 * Null when TMDB has no match for the IMDb id, or the season has no episodes yet -- both
 * are expected outcomes (an unreleased or not-yet-catalogued season), not errors, so the
 * loader treats null the same as an upstream failure and falls back to the snapshot.
 */
export async function fetchEpisodeInfoFromTmdb(
	imdbId: string,
	season: string,
	options?: RawFetchOptions
): Promise<EpisodeInfo | null> {
	try {
		const tmdbId = await resolveTmdbId(imdbId, 'tv', options);

		if (!tmdbId) {
			return null;
		}

		const episodeInfo = await fetchEpisodesFromTmdb(tmdbId, season, options);

		return episodeInfo && (await withOmdbRatings(episodeInfo, imdbId, season, options));
	} catch {
		return null;
	}
}

/**
 * Overlays each episode's imdbRating from OMDb's by-season endpoint, matched by episode
 * number. Leaves TMDB's placeholder 'N/A' in place when OMDB_API_KEY is missing, OMDb has
 * no rating for that episode, or the call fails -- mergeEpisodeWithPrior below then keeps
 * whatever the snapshot already had.
 */
async function withOmdbRatings(
	episodeInfo: EpisodeInfo,
	imdbId: string,
	season: string,
	options: RawFetchOptions | undefined
): Promise<EpisodeInfo> {
	const apiKey = getOmdbApiKey();

	if (!apiKey) {
		return episodeInfo;
	}

	const omdbEpisodes = await fetchOmdbSeason(imdbId, season, apiKey, options);
	const episodes = episodeInfo.episodes.map((episode) => ({
		...episode,
		imdbRating: findOmdbEpisode(omdbEpisodes, episode.episodeNumber)?.imdbRating ?? 'N/A'
	}));

	return { ...episodeInfo, episodes };
}

/** OMDb/IMDb sentinel-text convention shared with titleInfoFetch's merge rule. */
function isMissingText(value: string): boolean {
	return value === '' || value === 'N/A';
}

/**
 * Merges a freshly-fetched {@link EpisodeInfo} over the prior snapshot, matched by
 * episodeNumber, following the same "prior wins except released/imdbRating" rule as
 * mergeTitleInfoWithPrior: title, plot, posterUrl and runtimeSeconds never change once an
 * episode is published, so the prior value is kept whenever it is real. released and
 * imdbRating do change over time, so those take the live value whenever it is real. A live
 * episode with no prior match is a newly aired episode and is kept as-is.
 */
export function mergeEpisodeInfoWithPrior(live: EpisodeInfo, prior: EpisodeInfo | undefined): EpisodeInfo {
	if (!prior) {
		return live;
	}

	const priorByNumber = new Map(prior.episodes.map((episode) => [episode.episodeNumber, episode]));
	const episodes = live.episodes.map((episode) =>
		mergeEpisodeWithPrior(episode, priorByNumber.get(episode.episodeNumber))
	);

	return { episodes, totalCount: episodes.length };
}

/** Merges one live episode over its prior snapshot match, or returns it unchanged when new. */
function mergeEpisodeWithPrior(live: Episode, prior: Episode | undefined): Episode {
	if (!prior) {
		return live;
	}

	return {
		id: prior.id,
		title: isMissingText(prior.title) ? live.title : prior.title,
		episodeNumber: prior.episodeNumber,
		runtimeSeconds: prior.runtimeSeconds === null ? live.runtimeSeconds : prior.runtimeSeconds,
		plot: isMissingText(prior.plot) ? live.plot : prior.plot,
		posterUrl: isMissingText(prior.posterUrl) ? live.posterUrl : prior.posterUrl,
		imdbRating: isMissingText(live.imdbRating) ? prior.imdbRating : live.imdbRating,
		released: isMissingText(live.released) ? prior.released : live.released
	};
}
