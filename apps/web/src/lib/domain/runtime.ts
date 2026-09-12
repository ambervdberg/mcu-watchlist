// Pure aggregation of watch-time totals over items + progress + baked runtime data.
// Same active-filter scope as stats.ts (search excluded). Zero framework, zero I/O.

import { formatRuntimeMinutes } from './item';
import { matchesActiveFilters, type FilterState } from './filters';
import type { Item } from './item';
import { isSkipped, isWatched, type Progress } from './progress';

/** Runtime for one catalog item: whole-item minutes plus per-episode minutes for series. */
export interface ItemRuntime {
	/** Full item runtime in minutes (full season for a series). 0 when unknown. */
	totalMinutes: number;

	/** Episode id -> runtime minutes. Empty for non-series items. */
	episodeMinutes: Record<string, number>;
}

/** Baked runtime data for every catalog item, keyed by catalog item id. */
export type RuntimeIndex = Record<string, ItemRuntime>;

/** Aggregated watch-time totals for the currently filtered scope of items. */
export interface RuntimeTotals {
	/** Minutes already watched across in-scope items. */
	watchedMinutes: number;

	/** Minutes left to watch across in-scope items, excluding skipped items. */
	remainingMinutes: number;

	/** Whole-number percentage (0-100) of watched / (watched + remaining). 0 when both are 0. */
	watchedPercentage: number;
}

/**
 * Computes watch-time totals over `items`, scoped to the same type/phase/essential-only
 * filters as the catalog view. Search is intentionally excluded, matching computeStats.
 */
export function computeRuntimeTotals(
	items: readonly Item[],
	filters: FilterState,
	progress: Progress,
	runtimeIndex: RuntimeIndex
): RuntimeTotals {
	const scopedItems = items.filter((item) => matchesActiveFilters(item, filters, progress));

	let watchedMinutes = 0;
	let remainingMinutes = 0;

	for (const item of scopedItems) {
		const runtime = runtimeIndex[item.id] ?? { totalMinutes: 0, episodeMinutes: {} };
		watchedMinutes += watchedMinutesFor(item, progress, runtime);
		remainingMinutes += remainingMinutesFor(item, progress, runtime);
	}

	const watchedPercentage = watchedPercentageOf(watchedMinutes, remainingMinutes);

	return { watchedMinutes, remainingMinutes, watchedPercentage };
}

/**
 * Minutes already watched for one item: the whole runtime when fully watched, otherwise
 * the sum of its watched episodes' minutes (0 for an unwatched, non-series item).
 */
function watchedMinutesFor(item: Item, progress: Progress, runtime: ItemRuntime): number {
	if (isWatched(progress, item.id)) {
		return runtime.totalMinutes;
	}

	return watchedEpisodeMinutesFor(item, progress, runtime);
}

/** Sum of minutes for the item's watched episode ids. Unknown episode ids contribute 0. */
function watchedEpisodeMinutesFor(item: Item, progress: Progress, runtime: ItemRuntime): number {
	const watchedEpisodeIds = progress.watchedEpisodes[item.id] ?? [];

	return watchedEpisodeIds.reduce((sum, episodeId) => sum + (runtime.episodeMinutes[episodeId] ?? 0), 0);
}

/**
 * Minutes left to watch for one item: 0 once watched or skipped, otherwise the total
 * runtime minus whatever episode minutes are already watched, floored at 0.
 */
function remainingMinutesFor(item: Item, progress: Progress, runtime: ItemRuntime): number {
	if (isWatched(progress, item.id) || isSkipped(progress, item.id)) {
		return 0;
	}

	const watched = watchedEpisodeMinutesFor(item, progress, runtime);

	return Math.max(0, runtime.totalMinutes - watched);
}

/** Whole-number watched percentage of watched + remaining. 0 when both are 0. */
function watchedPercentageOf(watchedMinutes: number, remainingMinutes: number): number {
	const total = watchedMinutes + remainingMinutes;

	return total === 0 ? 0 : Math.round((watchedMinutes / total) * 100);
}

/** Minutes in one day, for the days/hours split in formatWatchTime. */
const MINUTES_PER_DAY = 1440;

/** Minutes in one hour, for the days/hours split in formatWatchTime. */
const MINUTES_PER_HOUR = 60;

/**
 * Formats a minute count as watch time: "Xd Yh" from a full day upward (hours part
 * dropped when 0, e.g. "3d"), otherwise delegates to formatRuntimeMinutes ("1h 23m"/"45m").
 */
export function formatWatchTime(minutes: number): string {
	if (minutes < MINUTES_PER_DAY) {
		return formatRuntimeMinutes(minutes);
	}

	const days = Math.floor(minutes / MINUTES_PER_DAY);
	const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);

	return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}
