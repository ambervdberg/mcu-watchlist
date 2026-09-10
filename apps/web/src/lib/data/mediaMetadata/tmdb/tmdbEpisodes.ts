// Per-season episode list from TMDB, mapped to the shared Episode/EpisodeInfo shape.
// imdbRating is a placeholder here -- episodeInfoFetch.ts overlays the real OMDb rating.
import { fetchJsonWithRawCache, type RawFetchOptions } from '../rawResponseCache';
import type { Episode, EpisodeInfo } from '../episodeInfoFetch';
import { getTmdbApiKey } from './tmdbKey';
import { fetchTmdbImageConfig, type TmdbImageConfig } from './tmdbConfiguration';

type TmdbEpisode = {
	id: number;
	name?: string;
	overview?: string;
	still_path?: string | null;
	runtime?: number | null;
	air_date?: string;
	episode_number?: number;
};

type TmdbSeasonResponse = {
	episodes?: TmdbEpisode[];
};

/** Fetches TMDB's per-season episode list. Null on upstream failure or an empty/unaired season. */
export async function fetchEpisodesFromTmdb(
	tmdbId: number,
	season: string,
	options?: RawFetchOptions
): Promise<EpisodeInfo | null> {
	try {
		const apiKey = getTmdbApiKey();
		const data = await fetchJsonWithRawCache<TmdbSeasonResponse>({
			descriptor: { source: 'tmdb', endpoint: 'season', key: `${tmdbId}-s${season}` },
			url: `https://api.themoviedb.org/3/tv/${tmdbId}/season/${encodeURIComponent(season)}?api_key=${apiKey}`,
			cacheRoot: options?.cacheRoot,
			refresh: options?.refreshRawCache
		});

		const episodes = data?.episodes ?? [];

		if (episodes.length === 0) {
			return null;
		}

		const imageConfig = await fetchTmdbImageConfig(options);

		return {
			episodes: episodes.map((episode) => toEpisode(episode, imageConfig)),
			totalCount: episodes.length
		};
	} catch {
		return null;
	}
}

/** Maps one TMDB episode into the shared Episode DTO. */
function toEpisode(raw: TmdbEpisode, imageConfig: TmdbImageConfig): Episode {
	return {
		id: String(raw.id),
		title: raw.name ?? '',
		episodeNumber: raw.episode_number ?? 0,
		runtimeSeconds: typeof raw.runtime === 'number' ? raw.runtime * 60 : null,
		plot: raw.overview ?? '',
		posterUrl: raw.still_path ? `${imageConfig.baseUrl}${imageConfig.stillSize}${raw.still_path}` : '',
		imdbRating: 'N/A',
		released: raw.air_date ?? 'N/A'
	};
}
