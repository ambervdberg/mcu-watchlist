// Pure domain type for a single catalog entry (movie, series, short, or special).
// Zero framework / zero I/O: this module must never import from svelte, fetch, or DOM APIs.
//
// `phase` is intentionally optional: no current catalog entry sets it, but
// lib/state's phase filter (see filters.ts) is designed to support it once
// phase metadata is added to the catalog.

/** The four kinds of catalog entry the timeline can contain. */
export type ItemType = 'movie' | 'series' | 'short' | 'special';

/** A single MCU catalog entry (movie, series, short film, or special). */
export interface Item {
	/** Stable slug used as the row key for progress and as the detail page URL. */
	id: string;

	/** Display title, e.g. "Iron Man". */
	title: string;

	/** Free-text in-universe timeline label, e.g. "2010" or "1943-1945". */
	timeline: string;

	/** Free-text era/grouping label, e.g. "2008-2012". */
	era: string;

	/** Short label shown on the timeline dot, e.g. "2010" or "BC". */
	dot: string;

	/** Catalog entry kind. */
	type: ItemType;

	/** MCU phase number, when known. Optional: not every catalog entry has one yet. */
	phase?: number;

	/** IMDb title id (e.g. "tt0371746"), used for IMDb links and OMDb/imdbapi lookups. */
	imdbId: string;

	/** Runtime in minutes, for movies/specials/shorts. Series omit this (episodes vary). */
	runtimeMinutes?: number;

	/** Whether this entry is flagged "essential" viewing in the essential-only filter. */
	essential: boolean;
}

const ITEM_TYPES: readonly ItemType[] = ['movie', 'series', 'short', 'special'];
const ITEM_TYPE_LABELS: Record<ItemType, string> = {
	movie: 'Movie',
	series: 'Series',
	short: 'Short',
	special: 'Special'
};

/** Returns the user-facing label for a catalog entry type. */
export function formatItemType(type: ItemType): string {
	return ITEM_TYPE_LABELS[type];
}

/** Formats runtime minutes as "1h 23m", or just "45m" under an hour. */
export function formatRuntimeMinutes(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;

	return hours === 0 ? `${remainingMinutes}m` : `${hours}h ${remainingMinutes}m`;
}

/** Formats an ISO "YYYY-MM-DD" date for display. */
export function formatWatchedDate(isoDate: string, locale?: string): string {
	const parsed = new Date(`${isoDate}T00:00:00`);

	return parsed.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Type guard: narrows an arbitrary value to {@link ItemType}. */
export function isItemType(value: unknown): value is ItemType {
	return typeof value === 'string' && (ITEM_TYPES as readonly string[]).includes(value);
}

/**
 * Type guard: narrows an arbitrary value to {@link Item}.
 *
 * Checks every required field's presence and type. Optional fields (`phase`,
 * `runtimeMinutes`) are only validated when present, since `undefined` is a
 * valid value for them.
 */
export function isItem(value: unknown): value is Item {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;

	const hasRequiredFields =
		typeof candidate.id === 'string' &&
		typeof candidate.title === 'string' &&
		typeof candidate.timeline === 'string' &&
		typeof candidate.era === 'string' &&
		typeof candidate.dot === 'string' &&
		isItemType(candidate.type) &&
		typeof candidate.imdbId === 'string' &&
		typeof candidate.essential === 'boolean';

	if (!hasRequiredFields) {
		return false;
	}

	const hasValidPhase = candidate.phase === undefined || typeof candidate.phase === 'number';
	const hasValidRuntime = candidate.runtimeMinutes === undefined || typeof candidate.runtimeMinutes === 'number';

	return hasValidPhase && hasValidRuntime;
}
