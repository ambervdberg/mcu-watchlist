// Build-time port of apps/api/src/media/episodeInfoFetcher.ts. Same upstream shape and
// mapping as the API version — see titleInfoFetch.ts's file doc for why this is a
// straight copy rather than a reimplementation.
import { fetchJsonWithRawCache, type RawFetchOptions } from './rawResponseCache';

/** A single episode as returned by imdbapi.dev's per-season episode list. */
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

type ImdbApiDevEpisode = {
	id: string;
	title?: string;
	episodeNumber?: number;
	runtimeSeconds?: number;
	plot?: string;
	primaryImage?: {
		url?: string;
	};
	rating?: {
		aggregateRating?: number;
	};
	releaseDate?: {
		year?: number;
		month?: number;
		day?: number;
	};
};

type ImdbApiDevEpisodesResponse = {
	episodes?: ImdbApiDevEpisode[];
	totalCount?: number;
};

function formatReleaseDate(releaseDate: ImdbApiDevEpisode['releaseDate']): string {
	if (!releaseDate?.year || !releaseDate.month || !releaseDate.day) {
		return 'N/A';
	}

	const year = String(releaseDate.year).padStart(4, '0');
	const month = String(releaseDate.month).padStart(2, '0');
	const day = String(releaseDate.day).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

function toEpisode(raw: ImdbApiDevEpisode): Episode {
	const aggregateRating = raw.rating?.aggregateRating;

	return {
		id: raw.id,
		title: raw.title ?? '',
		episodeNumber: raw.episodeNumber ?? 0,
		runtimeSeconds: raw.runtimeSeconds ?? null,
		plot: raw.plot ?? '',
		posterUrl: raw.primaryImage?.url ?? 'N/A',
		imdbRating: typeof aggregateRating === 'number' ? aggregateRating.toFixed(1) : 'N/A',
		released: formatReleaseDate(raw.releaseDate)
	};
}

// A failed upstream call (network error or non-2xx) is treated the same as
// "no episodes yet" rather than a thrown error, since the most common cause
// is an unreleased season that hasn't aired on IMDb yet. The loader (see
// episodeInfoLoader.ts) treats null the same as a fetch failure and falls
// back to the committed snapshot, so an unreleased season simply keeps
// whatever the snapshot last recorded (typically also empty) rather than
// erroring the whole build.
export async function fetchEpisodeInfoFromImdbApiDev(
	imdbId: string,
	season: string,
	options?: RawFetchOptions
): Promise<EpisodeInfo | null> {
	try {
		const data = await fetchJsonWithRawCache<ImdbApiDevEpisodesResponse>({
			descriptor: { source: 'imdbapi.dev', endpoint: 'episodes', key: `${imdbId}-s${season}` },
			url: `https://api.imdbapi.dev/titles/${encodeURIComponent(imdbId)}/episodes?season=${encodeURIComponent(season)}`,
			cacheRoot: options?.cacheRoot,
			refresh: options?.refreshRawCache
		});

		if (!data) return null;

		const episodes = data.episodes ?? [];

		if (episodes.length === 0) {
			return null;
		}

		return {
			episodes: episodes.map(toEpisode),
			totalCount: data.totalCount ?? episodes.length
		};
	} catch {
		return null;
	}
}
