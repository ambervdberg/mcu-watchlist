// TMDB API key access for build-time provider calls.

/** Reads the TMDB key from Astro-loaded env first, then plain Node env. Throws when missing. */
export function getTmdbApiKey(): string {
	const apiKey = import.meta.env.TMDB_API_KEY || process.env.TMDB_API_KEY;

	if (!apiKey) {
		throw new Error('TMDB_API_KEY is not configured.');
	}

	return apiKey;
}
