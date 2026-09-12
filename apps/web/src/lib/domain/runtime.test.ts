import { describe, expect, it } from 'vitest';
import { createDefaultFilterState, type FilterState } from './filters';
import type { Item } from './item';
import { createEmptyProgress, markSkipped, markWatched, setWatchedEpisodes, type Progress } from './progress';
import { computeRuntimeTotals, formatWatchTime, type RuntimeIndex } from './runtime';

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

const RUNTIME_INDEX: RuntimeIndex = {
	'iron-man': { totalMinutes: 126, episodeMinutes: {} },
	'iron-man-2': { totalMinutes: 124, episodeMinutes: {} },
	loki: {
		totalMinutes: 300,
		episodeMinutes: { 'loki-e1': 50, 'loki-e2': 50, 'loki-e3': 50, 'loki-e4': 50, 'loki-e5': 50, 'loki-e6': 50 }
	}
};

describe('computeRuntimeTotals', () => {
	it('returns zero totals for an empty item list', () => {
		const totals = computeRuntimeTotals([], createDefaultFilterState(), createEmptyProgress(), RUNTIME_INDEX);

		expect(totals).toEqual({ watchedMinutes: 0, remainingMinutes: 0, watchedPercentage: 0 });
	});

	it('scopes to the active type/phase/essential filters, excluding search', () => {
		const filters: FilterState = { ...createDefaultFilterState(), essentialOnly: true };

		// LOKI is non-essential, so it drops out of scope entirely, taking its 300 minutes with it.
		const totals = computeRuntimeTotals(ITEMS, filters, createEmptyProgress(), RUNTIME_INDEX);

		expect(totals.remainingMinutes).toBe(126 + 124);
	});

	it('counts a whole item watched fully once marked watched', () => {
		const progress = markWatched(createEmptyProgress(), IRON_MAN.id, '2026-06-23');
		const totals = computeRuntimeTotals(ITEMS, createDefaultFilterState(), progress, RUNTIME_INDEX);

		expect(totals.watchedMinutes).toBe(126);
		expect(totals.remainingMinutes).toBe(124 + 300);
	});

	it('counts only watched episode minutes for a partially watched series', () => {
		const progress = setWatchedEpisodes(createEmptyProgress(), LOKI.id, ['loki-e1', 'loki-e2']);
		const totals = computeRuntimeTotals(ITEMS, createDefaultFilterState(), progress, RUNTIME_INDEX);

		expect(totals.watchedMinutes).toBe(100);
		expect(totals.remainingMinutes).toBe(126 + 124 + 200);
	});

	it('excludes a skipped item from remainingMinutes entirely', () => {
		const progress = markSkipped(createEmptyProgress(), IRON_MAN_2.id);
		const totals = computeRuntimeTotals(ITEMS, createDefaultFilterState(), progress, RUNTIME_INDEX);

		expect(totals.watchedMinutes).toBe(0);
		expect(totals.remainingMinutes).toBe(126 + 300);
	});

	it('treats an item missing from the runtime index as zero minutes, without throwing', () => {
		const runtimeIndex: RuntimeIndex = { 'iron-man': RUNTIME_INDEX['iron-man'] };

		const totals = computeRuntimeTotals(ITEMS, createDefaultFilterState(), createEmptyProgress(), runtimeIndex);

		expect(totals.remainingMinutes).toBe(126);
	});

	it('ignores unknown watched episode ids, contributing zero minutes for them', () => {
		const progress = setWatchedEpisodes(createEmptyProgress(), LOKI.id, ['loki-e1', 'unknown-episode']);
		const totals = computeRuntimeTotals(ITEMS, createDefaultFilterState(), progress, RUNTIME_INDEX);

		expect(totals.watchedMinutes).toBe(50);
	});

	it('rounds watchedPercentage to the nearest whole number', () => {
		let progress: Progress = createEmptyProgress();
		progress = markWatched(progress, IRON_MAN.id, '2026-06-23');

		const filters: FilterState = { ...createDefaultFilterState(), typeFilter: 'movie' };
		const totals = computeRuntimeTotals(ITEMS, filters, progress, RUNTIME_INDEX);

		// watched 126 / (126 + 124) = 50.4% -> rounds to 50.
		expect(totals.watchedPercentage).toBe(50);
	});
});

describe('formatWatchTime', () => {
	it('formats 0 minutes as "0m"', () => {
		expect(formatWatchTime(0)).toBe('0m');
	});

	it('formats 45 minutes as "45m"', () => {
		expect(formatWatchTime(45)).toBe('45m');
	});

	it('formats 90 minutes as "1h 30m"', () => {
		expect(formatWatchTime(90)).toBe('1h 30m');
	});

	it('formats exactly one day (1440 minutes) as "1d", dropping a zero hours part', () => {
		expect(formatWatchTime(1440)).toBe('1d');
	});

	it('formats 1500 minutes as "1d 1h"', () => {
		expect(formatWatchTime(1500)).toBe('1d 1h');
	});
});
