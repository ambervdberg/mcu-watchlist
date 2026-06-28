import { describe, expect, it } from 'vitest';
import { createDefaultFilterState, getVisibleItems, matchesActiveFilters, type FilterState } from './filters';
import type { Item } from './item';
import { createEmptyProgress, markSkipped, markWatched, type Progress } from './progress';

function makeItem(overrides: Partial<Item> = {}): Item {
	return {
		id: 'iron-man',
		title: 'Iron Man',
		timeline: '2008',
		era: '2008-2012',
		dot: '2008',
		type: 'movie',
		imdbId: 'tt0371746',
		essential: true,
		...overrides
	};
}

const IRON_MAN = makeItem();
const LOKI = makeItem({
	id: 'loki',
	title: 'Loki',
	timeline: '2012, 2050s',
	era: 'Multiverse Saga',
	dot: '2012',
	type: 'series',
	imdbId: 'tt9140554',
	essential: false,
	phase: 4
});

describe('createDefaultFilterState', () => {
	it('returns the neutral toolbar state', () => {
		expect(createDefaultFilterState()).toEqual({
			typeFilter: 'all',
			phaseFilter: 'all',
			essentialOnly: false,
			search: ''
		});
	});
});

describe('matchesActiveFilters', () => {
	const empty = createEmptyProgress();

	it("typeFilter 'all' matches every item regardless of type", () => {
		const filters: FilterState = { ...createDefaultFilterState(), typeFilter: 'all' };
		expect(matchesActiveFilters(IRON_MAN, filters, empty)).toBe(true);
		expect(matchesActiveFilters(LOKI, filters, empty)).toBe(true);
	});

	it('typeFilter matching item.type passes only that type', () => {
		const filters: FilterState = { ...createDefaultFilterState(), typeFilter: 'series' };
		expect(matchesActiveFilters(LOKI, filters, empty)).toBe(true);
		expect(matchesActiveFilters(IRON_MAN, filters, empty)).toBe(false);
	});

	it("typeFilter 'watched' passes only items marked watched in progress", () => {
		const filters: FilterState = { ...createDefaultFilterState(), typeFilter: 'watched' };
		const watchedProgress = markWatched(empty, IRON_MAN.id, '2026-06-23');

		expect(matchesActiveFilters(IRON_MAN, filters, watchedProgress)).toBe(true);
		expect(matchesActiveFilters(LOKI, filters, watchedProgress)).toBe(false);
	});

	it("typeFilter 'skipped' passes only items marked skipped in progress", () => {
		const filters: FilterState = { ...createDefaultFilterState(), typeFilter: 'skipped' };
		const skippedProgress = markSkipped(empty, IRON_MAN.id);

		expect(matchesActiveFilters(IRON_MAN, filters, skippedProgress)).toBe(true);
		expect(matchesActiveFilters(LOKI, filters, skippedProgress)).toBe(false);
	});

	it("typeFilter 'todo' passes only items that are neither watched nor skipped", () => {
		const filters: FilterState = { ...createDefaultFilterState(), typeFilter: 'todo' };
		const watchedProgress = markWatched(empty, IRON_MAN.id, '2026-06-23');

		expect(matchesActiveFilters(IRON_MAN, filters, watchedProgress)).toBe(false);
		expect(matchesActiveFilters(LOKI, filters, watchedProgress)).toBe(true);
	});

	it("phaseFilter 'all' is a no-op even for items without a phase", () => {
		const filters: FilterState = { ...createDefaultFilterState(), phaseFilter: 'all' };
		expect(matchesActiveFilters(IRON_MAN, filters, empty)).toBe(true);
	});

	it('phaseFilter set to a number matches only items with that exact phase', () => {
		const filters: FilterState = { ...createDefaultFilterState(), phaseFilter: 4 };
		expect(matchesActiveFilters(LOKI, filters, empty)).toBe(true);
		expect(matchesActiveFilters(IRON_MAN, filters, empty)).toBe(false);
	});

	it('essentialOnly true excludes non-essential items', () => {
		const filters: FilterState = { ...createDefaultFilterState(), essentialOnly: true };
		expect(matchesActiveFilters(IRON_MAN, filters, empty)).toBe(true);
		expect(matchesActiveFilters(LOKI, filters, empty)).toBe(false);
	});

	it('combines typeFilter, phaseFilter, and essentialOnly with AND semantics', () => {
		const filters: FilterState = { typeFilter: 'series', phaseFilter: 4, essentialOnly: true, search: '' };
		// LOKI matches type and phase but fails essentialOnly.
		expect(matchesActiveFilters(LOKI, filters, empty)).toBe(false);
	});
});

describe('getVisibleItems', () => {
	const items = [IRON_MAN, LOKI];
	const empty: Progress = createEmptyProgress();

	it('returns all items when filters are default and search is empty', () => {
		const result = getVisibleItems(items, createDefaultFilterState(), empty);
		expect(result).toEqual([IRON_MAN, LOKI]);
	});

	it('filters by search term across title, timeline, and era, case-insensitively', () => {
		const filters: FilterState = { ...createDefaultFilterState(), search: 'IRON' };
		expect(getVisibleItems(items, filters, empty)).toEqual([IRON_MAN]);
	});

	it('matches search against the era field, not just the title', () => {
		const filters: FilterState = { ...createDefaultFilterState(), search: 'multiverse' };
		expect(getVisibleItems(items, filters, empty)).toEqual([LOKI]);
	});

	it('matches search against the timeline field', () => {
		const filters: FilterState = { ...createDefaultFilterState(), search: '2050s' };
		expect(getVisibleItems(items, filters, empty)).toEqual([LOKI]);
	});

	it('treats a whitespace-only search as no search filter', () => {
		const filters: FilterState = { ...createDefaultFilterState(), search: '   ' };
		expect(getVisibleItems(items, filters, empty)).toEqual([IRON_MAN, LOKI]);
	});

	it('combines type filter and search: search narrows what the type filter already passed', () => {
		const filters: FilterState = { ...createDefaultFilterState(), typeFilter: 'series', search: 'iron' };
		expect(getVisibleItems(items, filters, empty)).toEqual([]);
	});

	it('returns an empty array when nothing matches', () => {
		const filters: FilterState = { ...createDefaultFilterState(), search: 'thanos' };
		expect(getVisibleItems(items, filters, empty)).toEqual([]);
	});
});
