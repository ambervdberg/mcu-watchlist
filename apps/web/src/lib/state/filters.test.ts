// Tests for createFiltersStore(). Exercises the setters/reset against the filters atom
// directly, and visibleItems()/stats() against a small hand-built catalog + domain
// Progress value, since this store does not own either of those (see module doc in
// filters.ts).

import { describe, expect, it } from 'vitest';
import { createEmptyProgress, markSkipped, markWatched } from '../domain/progress';
import type { Item } from '../domain/item';
import { createFiltersStore } from './filters';

const ITEMS: Item[] = [
	{
		id: 'iron-man',
		title: 'Iron Man',
		timeline: '2010',
		era: '2008-2012',
		dot: '2010',
		type: 'movie',
		imdbId: 'tt1',
		essential: true
	},
	{
		id: 'thor',
		title: 'Thor',
		timeline: '2011',
		era: '2008-2012',
		dot: '2011',
		type: 'movie',
		imdbId: 'tt2',
		essential: false
	},
	{
		id: 'loki',
		title: 'Loki',
		timeline: '2012-2050',
		era: '2021-2023',
		dot: '2012',
		type: 'series',
		imdbId: 'tt3',
		essential: true
	}
];

describe('createFiltersStore()', () => {
	it('starts at the neutral default filter state', () => {
		const store = createFiltersStore();

		expect(store.filters.get()).toEqual({ typeFilter: 'all', phaseFilter: 'all', essentialOnly: false, search: '' });
	});

	describe('setters', () => {
		it('setTypeFilter() updates only typeFilter', () => {
			const store = createFiltersStore();
			store.setTypeFilter('movie');

			expect(store.filters.get().typeFilter).toBe('movie');
			expect(store.filters.get().phaseFilter).toBe('all');
		});

		it('setPhaseFilter() updates only phaseFilter', () => {
			const store = createFiltersStore();
			store.setPhaseFilter(4);

			expect(store.filters.get().phaseFilter).toBe(4);
		});

		it('setEssentialOnly() updates only essentialOnly', () => {
			const store = createFiltersStore();
			store.setEssentialOnly(true);

			expect(store.filters.get().essentialOnly).toBe(true);
		});

		it('setSearch() updates only search', () => {
			const store = createFiltersStore();
			store.setSearch('thor');

			expect(store.filters.get().search).toBe('thor');
		});

		it('reset() restores every field to the neutral default after changes', () => {
			const store = createFiltersStore();
			store.setTypeFilter('movie');
			store.setPhaseFilter(2);
			store.setEssentialOnly(true);
			store.setSearch('thor');

			store.reset();

			expect(store.filters.get()).toEqual({ typeFilter: 'all', phaseFilter: 'all', essentialOnly: false, search: '' });
		});
	});

	describe('visibleItems()', () => {
		it('returns every item under the default (no-op) filter state', () => {
			const store = createFiltersStore();

			expect(store.visibleItems(ITEMS, createEmptyProgress())).toHaveLength(3);
		});

		it('narrows by typeFilter', () => {
			const store = createFiltersStore();
			store.setTypeFilter('movie');

			const visible = store.visibleItems(ITEMS, createEmptyProgress());

			expect(visible.map((item) => item.id)).toEqual(['iron-man', 'thor']);
		});

		it('narrows by essentialOnly', () => {
			const store = createFiltersStore();
			store.setEssentialOnly(true);

			const visible = store.visibleItems(ITEMS, createEmptyProgress());

			expect(visible.map((item) => item.id)).toEqual(['iron-man', 'loki']);
		});

		it('narrows by search across title/timeline/era', () => {
			const store = createFiltersStore();
			store.setSearch('2011');

			const visible = store.visibleItems(ITEMS, createEmptyProgress());

			expect(visible.map((item) => item.id)).toEqual(['thor']);
		});

		it('typeFilter "watched" uses the supplied progress', () => {
			const store = createFiltersStore();
			store.setTypeFilter('watched');
			const progress = markWatched(createEmptyProgress(), 'thor', '2026-01-01');

			const visible = store.visibleItems(ITEMS, progress);

			expect(visible.map((item) => item.id)).toEqual(['thor']);
		});
	});

	describe('stats()', () => {
		it('computes watched/total/percentage scoped to the active filters, excluding search', () => {
			const store = createFiltersStore();
			store.setSearch('nonexistent-term-still-counts-in-stats');
			const progress = markWatched(createEmptyProgress(), 'iron-man', '2026-01-01');

			const stats = store.stats(ITEMS, progress);

			expect(stats).toEqual({ watchedCount: 1, totalCount: 3, percentage: 33, nextItem: ITEMS[1] });
		});

		it('reports nextItem as null once every in-scope item is watched or skipped', () => {
			const store = createFiltersStore();
			let progress = markWatched(createEmptyProgress(), 'iron-man', '2026-01-01');
			progress = markWatched(progress, 'thor', '2026-01-01');
			progress = markSkipped(progress, 'loki');

			const stats = store.stats(ITEMS, progress);

			expect(stats.nextItem).toBeNull();
		});
	});
});
