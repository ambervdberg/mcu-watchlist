// OMDb API key access for build-time provider calls.

/** Reads the OMDb key from Astro-loaded env first, then plain Node env. */
export function getOmdbApiKey(): string | undefined {
	return import.meta.env.OMDB_API_KEY || process.env.OMDB_API_KEY;
}
