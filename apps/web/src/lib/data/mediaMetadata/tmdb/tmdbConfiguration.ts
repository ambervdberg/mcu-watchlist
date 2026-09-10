// TMDB image host and still-image size, read from TMDB's /configuration endpoint.
// See https://developer.themoviedb.org/reference/configuration-details.
import { fetchJsonWithRawCache, type RawFetchOptions } from '../rawResponseCache';
import { getTmdbApiKey } from './tmdbKey';

const FALLBACK_BASE_URL = 'https://image.tmdb.org/t/p/';
const FALLBACK_STILL_SIZE = 'w300';
const PREFERRED_STILL_SIZE = 'w300';

type TmdbConfigurationResponse = {
	images?: {
		secure_base_url?: string;
		still_sizes?: string[];
	};
};

/** Image host and still-image size to build a TMDB episode image URL with. */
export type TmdbImageConfig = {
	baseUrl: string;
	stillSize: string;
};

/**
 * Fetches TMDB's image configuration, cached once per build like every other TMDB call.
 *
 * Falls back to a fixed host and the 'w300' still size on a missing key, an upstream
 * failure, or a response with no usable image host -- logging that the fallback was used,
 * so a build still works without ever hard-failing on this call.
 */
export async function fetchTmdbImageConfig(options?: RawFetchOptions): Promise<TmdbImageConfig> {
	try {
		return await fetchLiveImageConfig(options);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`[tmdbConfiguration] falling back to default image host: ${message}`);

		return { baseUrl: FALLBACK_BASE_URL, stillSize: FALLBACK_STILL_SIZE };
	}
}

/** Fetches and parses TMDB's configuration response. Throws on any failure. */
async function fetchLiveImageConfig(options: RawFetchOptions | undefined): Promise<TmdbImageConfig> {
	const apiKey = getTmdbApiKey();
	const data = await fetchJsonWithRawCache<TmdbConfigurationResponse>({
		descriptor: { source: 'tmdb', endpoint: 'configuration', key: 'default' },
		url: `https://api.themoviedb.org/3/configuration?api_key=${apiKey}`,
		cacheRoot: options?.cacheRoot,
		refresh: options?.refreshRawCache
	});

	const baseUrl = data?.images?.secure_base_url;

	if (!baseUrl) {
		throw new Error('TMDB configuration response has no image base URL.');
	}

	return { baseUrl, stillSize: pickStillSize(data?.images?.still_sizes) };
}

/** Picks the preferred still size when TMDB offers it, else 'original'. */
function pickStillSize(stillSizes: string[] | undefined): string {
	return stillSizes?.includes(PREFERRED_STILL_SIZE) ? PREFERRED_STILL_SIZE : 'original';
}
