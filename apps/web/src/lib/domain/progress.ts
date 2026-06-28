// Pure domain type and transitions for a user's watch progress.
// Zero framework / zero I/O: no fetch, no Date.now() reads, no Svelte imports.
// The current date is always passed in by the caller (the state layer), so
// these functions stay fully deterministic and trivially testable.

/** Per-user watch progress. Mirrors the shape persisted by PUT /api/progress. */
export interface Progress {
	/** Set of item ids the user has marked watched, represented as a presence map. */
	watchedIds: Record<string, true>;

	/** Set of item ids the user has marked skipped, represented as a presence map. */
	skippedIds: Record<string, true>;

	/** Item id -> "YYYY-MM-DD" the item was marked watched. Cleared on unwatch/skip. */
	watchedDates: Record<string, string>;

	/** Series item id -> array of watched episode ids within that series. */
	watchedEpisodes: Record<string, string[]>;
}

/** A Progress value with no watched/skipped items. Safe initial state for anonymous visitors. */
export function createEmptyProgress(): Progress {
	return {
		watchedIds: {},
		skippedIds: {},
		watchedDates: {},
		watchedEpisodes: {}
	};
}

/**
 * Returns a shallow copy of `record` with `key` removed.
 *
 * Small private helper so every "clear this id from this map" site below
 * reads as one line instead of a destructure-and-discard pattern (which also
 * trips `no-unused-vars` on the discarded binding).
 */
function omitKey<TValue>(record: Record<string, TValue>, key: string): Record<string, TValue> {
	const next = { ...record };
	delete next[key];
	return next;
}

/**
 * Marks `itemId` as watched on `progress`, stamping `watchedDates[itemId]` with
 * `today` (caller-supplied, format "YYYY-MM-DD").
 *
 * Enforces the watched/skipped mutual-exclusion invariant: marking an item
 * watched always clears it from skipped. Returns a new Progress; never
 * mutates the input.
 */
export function markWatched(progress: Progress, itemId: string, today: string): Progress {
	return {
		...progress,
		watchedIds: { ...progress.watchedIds, [itemId]: true },
		skippedIds: omitKey(progress.skippedIds, itemId),
		watchedDates: { ...progress.watchedDates, [itemId]: today }
	};
}

/**
 * Clears the watched flag for `itemId`.
 *
 * Also clears `watchedDates[itemId]` and `watchedEpisodes[itemId]`: un-watching
 * a series resets its per-episode progress too.
 */
export function unmarkWatched(progress: Progress, itemId: string): Progress {
	return {
		...progress,
		watchedIds: omitKey(progress.watchedIds, itemId),
		watchedDates: omitKey(progress.watchedDates, itemId),
		watchedEpisodes: omitKey(progress.watchedEpisodes, itemId)
	};
}

/**
 * Marks `itemId` as skipped on `progress`.
 *
 * Enforces the watched/skipped mutual-exclusion invariant: marking an item
 * skipped always clears it from watched, including its watchedDates stamp.
 * Episode progress is preserved unless the item is explicitly unwatched.
 */
export function markSkipped(progress: Progress, itemId: string): Progress {
	return {
		...progress,
		watchedIds: omitKey(progress.watchedIds, itemId),
		watchedDates: omitKey(progress.watchedDates, itemId),
		skippedIds: { ...progress.skippedIds, [itemId]: true }
	};
}

/** Clears the skipped flag for `itemId`. Leaves watched/watchedDates/watchedEpisodes untouched. */
export function unmarkSkipped(progress: Progress, itemId: string): Progress {
	return {
		...progress,
		skippedIds: omitKey(progress.skippedIds, itemId)
	};
}

/**
 * Toggles the watched flag for `itemId` to `nextWatched`, applying the
 * mutual-exclusion invariant either way. `today` is only used when
 * `nextWatched` is true (it stamps `watchedDates`); pass any string when
 * `nextWatched` is false, since unmarking never reads `today`.
 */
export function setWatched(progress: Progress, itemId: string, nextWatched: boolean, today: string): Progress {
	return nextWatched ? markWatched(progress, itemId, today) : unmarkWatched(progress, itemId);
}

/** Toggles the skipped flag for `itemId` to `nextSkipped`, applying the mutual-exclusion invariant either way. */
export function setSkipped(progress: Progress, itemId: string, nextSkipped: boolean): Progress {
	return nextSkipped ? markSkipped(progress, itemId) : unmarkSkipped(progress, itemId);
}

/**
 * Replaces the full watched-episode list for `seriesItemId` with `episodeIds`.
 *
 * The caller computes the next episode id array (e.g. by adding/removing one
 * id) and this function just stores it, keeping array-membership logic out of
 * the domain layer. An empty array removes the entry entirely so empty series
 * never linger in `watchedEpisodes`.
 */
export function setWatchedEpisodes(progress: Progress, seriesItemId: string, episodeIds: string[]): Progress {
	if (episodeIds.length === 0) {
		return { ...progress, watchedEpisodes: omitKey(progress.watchedEpisodes, seriesItemId) };
	}

	return {
		...progress,
		watchedEpisodes: { ...progress.watchedEpisodes, [seriesItemId]: episodeIds }
	};
}

/** Whether `itemId` is currently marked watched. */
export function isWatched(progress: Progress, itemId: string): boolean {
	return progress.watchedIds[itemId] === true;
}

/** Whether `itemId` is currently marked skipped. */
export function isSkipped(progress: Progress, itemId: string): boolean {
	return progress.skippedIds[itemId] === true;
}
