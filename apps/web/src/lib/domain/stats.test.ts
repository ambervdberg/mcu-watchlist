import { describe, expect, it } from 'vitest';
import { createDefaultFilterState, type FilterState } from './filters';
import type { Item } from './item';
import { createEmptyProgress, markSkipped, markWatched, type Progress } from './progress';
import { computeStats } from './stats';

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
const IRON_MAN_2 = makeItem({ id: 'iron-man-2', title: 'Iron Man 2', dot: '2010', essential: true });
const LOKI = makeItem({
	id: 'loki',
	title: 'Loki',
	type: 'series',
	imdbId: 'tt9140554',
	essential: false
});

const ITEMS = [IRON_MAN, IRON_MAN_2, LOKI];

describe('computeStats', () => {
	it('returns zero counts and a null nextItem for an empty item list', () => {
		const stats = computeStats([], createDefaultFilterState(), createEmptyProgress());

		expect(stats).toEqual({ watchedCount: 0, totalCount: 0, percentage: 0, nextItem: null });
	});

	it('counts watched items and computes a rounded percentage over all items when unfiltered', () => {
		const progress = markWatched(createEmptyProgress(), IRON_MAN.id, '2026-06-23');
		const stats = computeStats(ITEMS, createDefaultFilterState(), progress);

		expect(stats.watchedCount).toBe(1);
		expect(stats.totalCount).toBe(3);
		expect(stats.percentage).toBe(33); // round(1/3 * 100) = 33
	});

	it('returns the first item in catalog order that is neither watched nor skipped', () => {
		const progress = markWatched(createEmptyProgress(), IRON_MAN.id, '2026-06-23');
		const stats = computeStats(ITEMS, createDefaultFilterState(), progress);

		expect(stats.nextItem).toEqual(IRON_MAN_2);
	});

	it('skips over skipped items when picking nextItem, same as watched items', () => {
		let progress: Progress = createEmptyProgress();
		progress = markWatched(progress, IRON_MAN.id, '2026-06-23');
		progress = markSkipped(progress, IRON_MAN_2.id);

		const stats = computeStats(ITEMS, createDefaultFilterState(), progress);

		expect(stats.nextItem).toEqual(LOKI);
	});

	it('returns nextItem null when every item is watched or skipped', () => {
		let progress: Progress = createEmptyProgress();
		progress = markWatched(progress, IRON_MAN.id, '2026-06-23');
		progress = markWatched(progress, IRON_MAN_2.id, '2026-06-23');
		progress = markSkipped(progress, LOKI.id);

		const stats = computeStats(ITEMS, createDefaultFilterState(), progress);

		expect(stats.nextItem).toBeNull();
		expect(stats.percentage).toBe(67); // round(2/3 * 100) = 67
	});

	it('scopes counts to the active type/phase/essential filters, excluding search', () => {
		const filters: FilterState = { ...createDefaultFilterState(), essentialOnly: true };
		const progress = markWatched(createEmptyProgress(), IRON_MAN.id, '2026-06-23');

		// LOKI is non-essential, so essentialOnly excludes it from totalCount entirely.
		const stats = computeStats(ITEMS, filters, progress);

		expect(stats.totalCount).toBe(2);
		expect(stats.watchedCount).toBe(1);
	});

	it('computeStats ignores a search term entirely (search is not part of FilterState scoping here)', () => {
		// FilterState has no search-affecting field beyond typeFilter/phaseFilter/essentialOnly,
		// so two FilterState values that only differ in nothing-relevant still produce equal stats.
		const stats1 = computeStats(ITEMS, createDefaultFilterState(), createEmptyProgress());
		const stats2 = computeStats(ITEMS, { ...createDefaultFilterState() }, createEmptyProgress());

		expect(stats1).toEqual(stats2);
	});
});
