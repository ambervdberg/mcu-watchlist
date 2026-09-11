// Pure "what to watch next" pick for the timeline page's Up Next card. Zero
// framework / zero I/O: same shape as stats.ts, but walks the raw catalog order
// (not the filtered/search view) since Up Next always points at the next real item.

import type { Item } from './item';
import { isSkipped, isWatched, type Progress } from './progress';

/** One episode's display fields, baked at build time from the `episodes` Content Layer collection. */
export interface EpisodeSummary {
	id: string;
	title: string;
	episodeNumber: number;
}

/** The item (and, for a series, the episode) the visitor should watch next. */
export interface UpNext {
	/** The next unwatched, unskipped, in-scope catalog item. */
	item: Item;

	/** The next unwatched episode for a series item, or null for a non-series item or one with no baked episode data. */
	episode: EpisodeSummary | null;

	/** Count of unwatched episodes for a series item, or null when `episode` is null. */
	remainingEpisodes: number | null;

	/** Every episode id for the series, in order. Empty when there is no baked episode data. */
	allEpisodeIds: readonly string[];
}

/**
 * Picks the first item in `items` order that is neither watched, skipped, nor
 * excluded by `essentialOnly`, and resolves which episode is next for a series.
 * Returns null once nothing is left to watch.
 */
export function findUpNext(
	items: readonly Item[],
	progress: Progress,
	essentialOnly: boolean,
	episodesByItemId: Readonly<Record<string, readonly EpisodeSummary[]>>
): UpNext | null {
	const nextItem = items.find((item) =>
		isUpNextCandidate(item, progress, essentialOnly, episodesByItemId[item.id] ?? [])
	);

	return nextItem ? buildUpNext(nextItem, progress, episodesByItemId[nextItem.id] ?? []) : null;
}

/** Whether `item` is eligible to be the Up Next pick: not watched, not skipped, in scope. */
function isUpNextCandidate(
	item: Item,
	progress: Progress,
	essentialOnly: boolean,
	episodes: readonly EpisodeSummary[]
): boolean {
	if (isWatched(progress, item.id) || isSkipped(progress, item.id)) {
		return false;
	}

	if (isFullyWatchedSeries(item, progress, episodes)) {
		return false;
	}

	return !essentialOnly || item.essential;
}

/** True when `item` is a series whose baked episodes are all present in `progress.watchedEpisodes`. */
function isFullyWatchedSeries(item: Item, progress: Progress, episodes: readonly EpisodeSummary[]): boolean {
	if (item.type !== 'series' || episodes.length === 0) {
		return false;
	}

	const watchedEpisodeIds = progress.watchedEpisodes[item.id] ?? [];
	return episodes.every((episode) => watchedEpisodeIds.includes(episode.id));
}

/** Builds the UpNext result for `item`, resolving its next episode when it is a series with baked episode data. */
function buildUpNext(item: Item, progress: Progress, episodes: readonly EpisodeSummary[]): UpNext {
	if (item.type !== 'series' || episodes.length === 0) {
		return { item, episode: null, remainingEpisodes: null, allEpisodeIds: [] };
	}

	const orderedEpisodes = [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
	const watchedEpisodeIds = progress.watchedEpisodes[item.id] ?? [];
	const unwatchedEpisodes = orderedEpisodes.filter((episode) => !watchedEpisodeIds.includes(episode.id));

	return {
		item,
		episode: unwatchedEpisodes[0] ?? null,
		remainingEpisodes: unwatchedEpisodes.length,
		allEpisodeIds: orderedEpisodes.map((episode) => episode.id)
	};
}
