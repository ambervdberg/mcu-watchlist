// Pure trailer-selection logic: scoring heuristics and stable IMDb URL builders.
// No network I/O; all functions are deterministic given their inputs.
import type { ImdbVideo } from './titleInfoTypes';

// IMDb's videos endpoint has no season/episode metadata field; the season a
// trailer belongs to (if any) only ever shows up inside its name, e.g.
// "Season 3: Official Trailer" or "Marvel's Daredevil: Season 1". Season-less
// names (most movies, and some shows' generic trailers) match neither branch
// and fall through to the keyword scoring below untouched.
function scoreSeasonMatch(name: string, season: string | undefined): number {
	if (!season) {
		return 0;
	}

	const match = name.match(/season\s+(\d+)/);

	if (!match) {
		return 0;
	}

	return Number(match[1]) === Number(season) ? 50 : -50;
}

/** Returns a weighted value for picking the most useful trailer from IMDb videos. */
export function scoreTrailer(video: ImdbVideo, season: string | undefined): number {
	const name = video.name?.toLowerCase() ?? '';
	const description = video.description?.toLowerCase() ?? '';
	let score = scoreSeasonMatch(name, season);

	// Prefer the canonical official trailer over regional cuts or shorter peeks.
	if (name.includes('official trailer')) score += 30;
	if (description.includes('official trailer')) score += 15;
	if (name.includes('trailer')) score += 10;
	if (name.includes('teaser')) score -= 5;
	if (name.includes('sneak peek')) score -= 10;

	return score;
}

/** Creates a stable IMDb video URL for the selected video id. */
export function createTrailerUrl(videoId: string): string {
	return `https://www.imdb.com/video/${encodeURIComponent(videoId)}/`;
}

/** Creates a stable IMDb embed URL for in-app trailer playback. */
export function createTrailerEmbedUrl(videoId: string): string {
	return `https://www.imdb.com/videoembed/${encodeURIComponent(videoId)}`;
}
