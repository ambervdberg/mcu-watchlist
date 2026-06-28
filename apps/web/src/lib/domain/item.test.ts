import { describe, expect, it } from 'vitest';
import { formatItemType, formatRuntimeMinutes, formatWatchedDate, isItem, isItemType, type Item } from './item';

// Minimal valid Item fixture, reused and tweaked per test so each assertion
// only varies the field under test.
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

describe('isItemType', () => {
	it.each(['movie', 'series', 'short', 'special'])('accepts %s', (type) => {
		expect(isItemType(type)).toBe(true);
	});

	it('rejects an unknown string', () => {
		expect(isItemType('documentary')).toBe(false);
	});

	it('rejects non-string values', () => {
		expect(isItemType(42)).toBe(false);
		expect(isItemType(null)).toBe(false);
		expect(isItemType(undefined)).toBe(false);
	});
});

describe('isItem', () => {
	it('accepts a fully populated item', () => {
		const item = makeItem({ phase: 1, runtimeMinutes: 126 });
		expect(isItem(item)).toBe(true);
	});

	it('accepts an item without the optional phase and runtimeMinutes fields', () => {
		expect(isItem(makeItem())).toBe(true);
	});

	it('rejects null and non-object values', () => {
		expect(isItem(null)).toBe(false);
		expect(isItem('iron-man')).toBe(false);
		expect(isItem(42)).toBe(false);
	});

	it('rejects an object missing a required field', () => {
		const withoutTitle: Partial<Item> = makeItem();
		delete withoutTitle.title;
		expect(isItem(withoutTitle)).toBe(false);
	});

	it('rejects an object with an invalid type value', () => {
		expect(isItem(makeItem({ type: 'documentary' as Item['type'] }))).toBe(false);
	});

	it('rejects an object where essential is not a boolean', () => {
		const withBadEssential = { ...makeItem(), essential: 'yes' };
		expect(isItem(withBadEssential)).toBe(false);
	});

	it('rejects an object where the optional phase field has the wrong type', () => {
		const withBadPhase = { ...makeItem(), phase: 'one' };
		expect(isItem(withBadPhase)).toBe(false);
	});

	it('rejects an object where the optional runtimeMinutes field has the wrong type', () => {
		const withBadRuntime = { ...makeItem(), runtimeMinutes: '126' };
		expect(isItem(withBadRuntime)).toBe(false);
	});
});

describe('item display helpers', () => {
	it('formats catalog type labels', () => {
		expect(formatItemType('movie')).toBe('Movie');
		expect(formatItemType('series')).toBe('Series');
		expect(formatItemType('short')).toBe('Short');
		expect(formatItemType('special')).toBe('Special');
	});

	it('formats runtime minutes', () => {
		expect(formatRuntimeMinutes(45)).toBe('45m');
		expect(formatRuntimeMinutes(126)).toBe('2h 6m');
	});

	it('formats watched dates as locale-friendly dates', () => {
		expect(formatWatchedDate('2026-06-22', 'en-US')).toBe('Jun 22, 2026');
	});
});
