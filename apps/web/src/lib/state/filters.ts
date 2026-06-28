// Filters store: the active type/phase/essential-only/search inputs, plus the derived
// "what's visible right now" view over a given catalog and progress. Mirrors the old
// app's four mutable globals (`currentFilter`, `essentialOnly`, plus the search input's
// DOM value) but as one cohesive, testable unit with explicit setters.
//
// This store deliberately does not hold the catalog (`Item[]`) or progress itself -- those
// live in lib/data and the progress store respectively. `visibleItems`/`stats` take both as
// parameters so this store stays a pure "filter state" concern (Single Responsibility),
// and so the UI can pass whichever catalog/progress are in scope at the call site.

import { atom } from 'nanostores';
import { computeStats, type Stats } from '../domain/stats';
import {
	createDefaultFilterState,
	getVisibleItems,
	type FilterState,
	type PhaseFilter,
	type TypeFilter
} from '../domain/filters';
import type { Item } from '../domain/item';
import type { Progress } from '../domain/progress';

/** The store shape returned by `createFiltersStore`: the filters atom plus the setters/derived reads. */
export interface FiltersStore {
	/** The full active filter/search state. Starts at the neutral "show everything" default. */
	filters: ReturnType<typeof atom<FilterState>>;

	/** Sets the type/status filter (one of the seven `data-filter` values ported from the old toolbar). */
	setTypeFilter(typeFilter: TypeFilter): void;

	/** Sets the phase filter ("all" or a specific MCU phase number). */
	setPhaseFilter(phaseFilter: PhaseFilter): void;

	/** Sets whether only "essential" items should be shown. */
	setEssentialOnly(essentialOnly: boolean): void;

	/** Sets the free-text search term. */
	setSearch(search: string): void;

	/** Resets every filter/search input back to its neutral default. */
	reset(): void;

	/**
	 * The subset of `items` visible under the current filter/search state and `progress`.
	 * A plain method, not a derived store, because it takes parameters: callers (page
	 * islands) recompute this from their own reactive read of `filters` where reactivity is
	 * actually needed, keeping this store catalog/progress-agnostic.
	 */
	visibleItems(items: readonly Item[], progress: Progress): Item[];

	/**
	 * Aggregated watch-progress stats over `items`, scoped to the same filters as
	 * `visibleItems` (minus search, per domain/stats.ts's documented scoping rule). Same
	 * "plain method, caller recomputes on read" reasoning as `visibleItems` above.
	 */
	stats(items: readonly Item[], progress: Progress): Stats;
}

/** Builds a FiltersStore. Production uses the `filtersStore` singleton below; tests build their own isolated instance. */
export function createFiltersStore(): FiltersStore {
	const filters = atom<FilterState>(createDefaultFilterState());

	function setTypeFilter(typeFilter: TypeFilter): void {
		filters.set({ ...filters.get(), typeFilter });
	}

	function setPhaseFilter(phaseFilter: PhaseFilter): void {
		filters.set({ ...filters.get(), phaseFilter });
	}

	function setEssentialOnly(essentialOnly: boolean): void {
		filters.set({ ...filters.get(), essentialOnly });
	}

	function setSearch(search: string): void {
		filters.set({ ...filters.get(), search });
	}

	function reset(): void {
		filters.set(createDefaultFilterState());
	}

	function visibleItems(items: readonly Item[], progress: Progress): Item[] {
		return getVisibleItems(items, filters.get(), progress);
	}

	function stats(items: readonly Item[], progress: Progress): Stats {
		return computeStats(items, filters.get(), progress);
	}

	return { filters, setTypeFilter, setPhaseFilter, setEssentialOnly, setSearch, reset, visibleItems, stats };
}

/** The production filters store. Islands import this directly; it holds no gateway, so there's nothing to inject. */
export const filtersStore = createFiltersStore();
