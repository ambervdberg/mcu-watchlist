// Public DTO types and the shared raw response type used across this mediaMetadata module.

/** OMDb/IMDb-sourced plot, rating, poster, runtime, and trailer metadata for a title. */
export type TitleInfo = {
	plot: string;
	imdbRating: string;
	poster: string;
	runtimeMinutes: number | null;
	released: string;
	trailer: TrailerInfo | null;
};

/** Trailer metadata picked from TMDB's videos endpoint. */
export type TrailerInfo = {
	id: string;
	name: string;
	description: string;
	url: string;
	embedUrl: string;
	imageUrl: string;
	runtimeSeconds: number | null;
};

/**
 * A single video entry, normalized from TMDB's /movie|tv/:id/videos response.
 * Shared between trailerPicker (scoring) and titleInfoFetch (fetching + mapping).
 */
export type ImdbVideo = {
	id?: string;
	type?: string;
	name?: string;
	primaryImage?: {
		url?: string;
	};
	description?: string;
	runtimeSeconds?: number;
};
