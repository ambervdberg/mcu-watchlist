// Best YouTube trailer for a movie, or for one series season, sourced from TMDB.
import { fetchJsonWithRawCache, type RawFetchOptions } from '../rawResponseCache';
import type { ImdbVideo, TrailerInfo } from '../titleInfoTypes';
import { scoreTrailer } from '../trailerPicker';
import type { TmdbKind } from './tmdbId';
import { getTmdbApiKey } from './tmdbKey';

const YOUTUBE_WATCH_BASE_URL = 'https://www.youtube.com/watch?v=';
const YOUTUBE_EMBED_BASE_URL = 'https://www.youtube.com/embed/';
const YOUTUBE_THUMBNAIL_BASE_URL = 'https://img.youtube.com/vi/';

/** One video entry from TMDB's movie/season videos endpoints. */
type TmdbVideo = {
	site?: string;
	key?: string;
	type?: string;
	official?: boolean;
	name?: string;
};

/** A TMDB video already confirmed to carry a usable YouTube key. */
type TmdbTrailerVideo = TmdbVideo & { key: string };

type TmdbVideosResponse = {
	results?: TmdbVideo[];
};

/** Fetches the best YouTube trailer for a movie, or for one series season. Null when TMDB has none. */
export async function fetchTrailerFromTmdb(
	tmdbId: number,
	kind: TmdbKind,
	season: string | undefined,
	options?: RawFetchOptions
): Promise<TrailerInfo | null> {
	const apiKey = getTmdbApiKey();

	const data = await fetchJsonWithRawCache<TmdbVideosResponse>({
		descriptor: { source: 'tmdb', endpoint: 'videos', key: videoCacheKey(tmdbId, season) },
		url: videoUrl(tmdbId, kind, season, apiKey),
		cacheRoot: options?.cacheRoot,
		refresh: options?.refreshRawCache
	});

	if (!data) {
		return null;
	}

	const best = pickBestTrailer(data.results ?? [], season);

	return best ? toTrailerInfo(best) : null;
}

/** Cache key distinguishing a movie's videos from one series season's videos. */
function videoCacheKey(tmdbId: number, season: string | undefined): string {
	return season ? `${tmdbId}-s${season}` : String(tmdbId);
}

/** Builds the TMDB videos URL for a movie or for one series season. */
function videoUrl(tmdbId: number, kind: TmdbKind, season: string | undefined, apiKey: string): string {
	const path = kind === 'movie' ? `movie/${tmdbId}` : `tv/${tmdbId}/season/${encodeURIComponent(season ?? '1')}`;

	return `https://api.themoviedb.org/3/${path}/videos?api_key=${apiKey}`;
}

/** Picks the highest-scoring official YouTube trailer, or null when there is no candidate. */
function pickBestTrailer(videos: TmdbVideo[], season: string | undefined): TmdbTrailerVideo | null {
	const candidates = videos.filter(isYoutubeTrailer);
	const [best] = candidates.toSorted((a, b) => scoreForSelection(b, season) - scoreForSelection(a, season));

	return best ?? null;
}

/** True for a YouTube trailer video that carries a playable key. */
function isYoutubeTrailer(video: TmdbVideo): video is TmdbTrailerVideo {
	return video.site === 'YouTube' && video.type === 'Trailer' && Boolean(video.key);
}

/**
 * Scores a TMDB video for selection: reuses trailerPicker's name/season heuristic and adds a
 * strong boost for TMDB's own official flag, which trailerPicker has no concept of.
 */
function scoreForSelection(video: TmdbTrailerVideo, season: string | undefined): number {
	const officialBonus = video.official ? 100 : 0;

	return officialBonus + scoreTrailer(asImdbVideoShape(video), season);
}

/** Maps a TMDB video into the shape trailerPicker's scoreTrailer expects. */
function asImdbVideoShape(video: TmdbTrailerVideo): ImdbVideo {
	return {
		id: video.key,
		type: 'trailer',
		name: video.name
	};
}

/** Maps the selected TMDB video into the shared TrailerInfo DTO. */
function toTrailerInfo(video: TmdbTrailerVideo): TrailerInfo {
	return {
		id: video.key,
		name: video.name ?? 'Trailer',
		description: '',
		url: `${YOUTUBE_WATCH_BASE_URL}${video.key}`,
		embedUrl: `${YOUTUBE_EMBED_BASE_URL}${video.key}`,
		imageUrl: `${YOUTUBE_THUMBNAIL_BASE_URL}${video.key}/hqdefault.jpg`,
		runtimeSeconds: null
	};
}
