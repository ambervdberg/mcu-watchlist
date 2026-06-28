// Pure predicates over the catalog: which items are visible given active
// filter/search state. Zero framework / zero I/O: no DOM, no Svelte imports.
//
// FilterState plus Progress make every filtering decision explicit,
// deterministic, and directly unit-testable.
//
// `typeFilter` intentionally combines catalog type (movie/series/short/
// special), watch status (watched/skipped/todo), and "all" because the UI
// presents those as one segmented control. `phaseFilter` is a separate axis
// for future phase metadata; today every active path uses "all".

import type { Item } from './item';
import { isSkipped, isWatched, type Progress } from './progress';

/**
 * The combined type/status filter behind the timeline filter controls:
 * all | movie | series | short | special | watched | skipped | todo.
 */
export type TypeFilter = 'all' | 'movie' | 'series' | 'short' | 'special' | 'watched' | 'skipped' | 'todo';

/** Phase filter: either "all" (no phase restriction) or a specific MCU phase number. */
export type PhaseFilter = 'all' | number;

/** The full set of active filter/search inputs that decide catalog visibility. */
export interface FilterState {
	typeFilter: TypeFilter;
	phaseFilter: PhaseFilter;
	essentialOnly: boolean;
	search: string;
}

/** A FilterState with every filter at its neutral/inactive value. */
export function createDefaultFilterState(): FilterState {
	return {
		typeFilter: 'all',
		phaseFilter: 'all',
		essentialOnly: false,
		search: ''
	};
}

/**
 * Whether `item` passes the type/status, phase, and essential-only filters
 * (everything in {@link FilterState} except free-text search).
 *
 * Exported separately from {@link getVisibleItems} because stats.ts scopes
 * its counts to active filters while intentionally excluding free-text search.
 */
export function matchesActiveFilters(item: Item, filters: FilterState, progress: Progress): boolean {
	const matchesType =
		filters.typeFilter === 'all' ||
		filters.typeFilter === item.type ||
		(filters.typeFilter === 'watched' && isWatched(progress, item.id)) ||
		(filters.typeFilter === 'skipped' && isSkipped(progress, item.id)) ||
		(filters.typeFilter === 'todo' && !isWatched(progress, item.id) && !isSkipped(progress, item.id));

	const matchesPhase = filters.phaseFilter === 'all' || filters.phaseFilter === item.phase;

	const matchesEssential = !filters.essentialOnly || item.essential;

	return matchesType && matchesPhase && matchesEssential;
}

/**
 * Whether `item`'s searchable text contains `query` (case-insensitive).
 *
 * Searches title, timeline, and era joined with a space, case-insensitively.
 * An empty/whitespace-only query matches everything.
 */
function matchesSearch(item: Item, query: string): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	const searchable = [item.title, item.timeline, item.era].join(' ').toLowerCase();

	return searchable.includes(normalizedQuery);
}

/** Returns the subset of `items` visible under the current filters, search term, and progress. */
export function getVisibleItems(items: readonly Item[], filters: FilterState, progress: Progress): Item[] {
	return items.filter((item) => matchesActiveFilters(item, filters, progress) && matchesSearch(item, filters.search));
}
