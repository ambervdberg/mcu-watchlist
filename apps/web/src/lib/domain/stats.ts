// Pure aggregation over items + progress. Stats use the same active
// type/phase/essential-only scope as the catalog view while deliberately
// excluding the search term.

import { matchesActiveFilters, type FilterState } from './filters';
import type { Item } from './item';
import { isSkipped, isWatched, type Progress } from './progress';

/** Aggregated watch-progress numbers for the currently filtered scope of items. */
export interface Stats {
	/** Count of in-scope items marked watched. */
	watchedCount: number;

	/** Count of in-scope items, regardless of watch status. */
	totalCount: number;

	/** Whole-number percentage (0-100) of in-scope items watched. 0 when totalCount is 0. */
	percentage: number;

	/**
	 * The first in-scope item that is neither watched nor skipped, in catalog
	 * order, or null when every in-scope item has been watched or skipped.
	 * Rendered as "Everything is watched" when absent; that display-string
	 * mapping belongs to the UI layer, not here.
	 */
	nextItem: Item | null;
}

/**
 * Computes watch-progress stats over `items`, scoped to the same
 * type/phase/essential-only filters as the catalog view.
 * Search is intentionally excluded from stats.
 */
export function computeStats(items: readonly Item[], filters: FilterState, progress: Progress): Stats {
	const scopedItems = items.filter((item) => matchesActiveFilters(item, filters, progress));

	const watchedCount = scopedItems.filter((item) => isWatched(progress, item.id)).length;
	const totalCount = scopedItems.length;
	const percentage = totalCount === 0 ? 0 : Math.round((watchedCount / totalCount) * 100);
	const nextItem = scopedItems.find((item) => !isWatched(progress, item.id) && !isSkipped(progress, item.id)) ?? null;

	return { watchedCount, totalCount, percentage, nextItem };
}
