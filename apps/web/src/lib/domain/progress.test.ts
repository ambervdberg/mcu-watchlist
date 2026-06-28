import { describe, expect, it } from 'vitest';
import {
	createEmptyProgress,
	isSkipped,
	isWatched,
	markSkipped,
	markWatched,
	setSkipped,
	setWatched,
	setWatchedEpisodes,
	unmarkSkipped,
	unmarkWatched,
	type Progress
} from './progress';

const TODAY = '2026-06-23';
const ITEM_ID = 'iron-man';

describe('createEmptyProgress', () => {
	it('returns all-empty maps', () => {
		expect(createEmptyProgress()).toEqual({
			watchedIds: {},
			skippedIds: {},
			watchedDates: {},
			watchedEpisodes: {}
		});
	});
});

describe('markWatched', () => {
	it('sets the watched flag and stamps watchedDates with the supplied date', () => {
		const result = markWatched(createEmptyProgress(), ITEM_ID, TODAY);

		expect(isWatched(result, ITEM_ID)).toBe(true);
		expect(result.watchedDates[ITEM_ID]).toBe(TODAY);
	});

	it('clears the item from skippedIds (mutual exclusion invariant)', () => {
		const skipped = markSkipped(createEmptyProgress(), ITEM_ID);
		const result = markWatched(skipped, ITEM_ID, TODAY);

		expect(isSkipped(result, ITEM_ID)).toBe(false);
		expect(isWatched(result, ITEM_ID)).toBe(true);
	});

	it('does not mutate the input progress', () => {
		const original = createEmptyProgress();
		markWatched(original, ITEM_ID, TODAY);

		expect(original).toEqual(createEmptyProgress());
	});

	it("leaves other items' progress untouched", () => {
		const withOther = markWatched(createEmptyProgress(), 'other-item', '2026-01-01');
		const result = markWatched(withOther, ITEM_ID, TODAY);

		expect(isWatched(result, 'other-item')).toBe(true);
		expect(result.watchedDates['other-item']).toBe('2026-01-01');
	});
});

describe('unmarkWatched', () => {
	it('clears the watched flag, the watchedDates stamp, and watchedEpisodes for that item', () => {
		const watched = markWatched(createEmptyProgress(), ITEM_ID, TODAY);
		const withEpisodes = setWatchedEpisodes(watched, ITEM_ID, ['ep1', 'ep2']);

		const result = unmarkWatched(withEpisodes, ITEM_ID);

		expect(isWatched(result, ITEM_ID)).toBe(false);
		expect(result.watchedDates[ITEM_ID]).toBeUndefined();
		expect(result.watchedEpisodes[ITEM_ID]).toBeUndefined();
	});

	it('is a safe no-op when the item was never watched', () => {
		const result = unmarkWatched(createEmptyProgress(), ITEM_ID);
		expect(result).toEqual(createEmptyProgress());
	});
});

describe('markSkipped', () => {
	it('sets the skipped flag', () => {
		const result = markSkipped(createEmptyProgress(), ITEM_ID);
		expect(isSkipped(result, ITEM_ID)).toBe(true);
	});

	it('clears the item from watchedIds and watchedDates (mutual exclusion invariant)', () => {
		const watched = markWatched(createEmptyProgress(), ITEM_ID, TODAY);
		const result = markSkipped(watched, ITEM_ID);

		expect(isWatched(result, ITEM_ID)).toBe(false);
		expect(result.watchedDates[ITEM_ID]).toBeUndefined();
		expect(isSkipped(result, ITEM_ID)).toBe(true);
	});

	it('does not clear watchedEpisodes when marking skipped', () => {
		const watched = markWatched(createEmptyProgress(), ITEM_ID, TODAY);
		const withEpisodes = setWatchedEpisodes(watched, ITEM_ID, ['ep1']);

		const result = markSkipped(withEpisodes, ITEM_ID);

		expect(result.watchedEpisodes[ITEM_ID]).toEqual(['ep1']);
	});
});

describe('unmarkSkipped', () => {
	it('clears the skipped flag without touching watched state', () => {
		const skipped = markSkipped(createEmptyProgress(), ITEM_ID);
		const result = unmarkSkipped(skipped, ITEM_ID);

		expect(isSkipped(result, ITEM_ID)).toBe(false);
	});
});

describe('setWatched / setSkipped (toggle helpers)', () => {
	it('setWatched(true) is equivalent to markWatched', () => {
		const result = setWatched(createEmptyProgress(), ITEM_ID, true, TODAY);
		expect(isWatched(result, ITEM_ID)).toBe(true);
		expect(result.watchedDates[ITEM_ID]).toBe(TODAY);
	});

	it('setWatched(false) is equivalent to unmarkWatched', () => {
		const watched = markWatched(createEmptyProgress(), ITEM_ID, TODAY);
		const result = setWatched(watched, ITEM_ID, false, TODAY);
		expect(isWatched(result, ITEM_ID)).toBe(false);
	});

	it('setSkipped(true) is equivalent to markSkipped', () => {
		const result = setSkipped(createEmptyProgress(), ITEM_ID, true);
		expect(isSkipped(result, ITEM_ID)).toBe(true);
	});

	it('setSkipped(false) is equivalent to unmarkSkipped', () => {
		const skipped = markSkipped(createEmptyProgress(), ITEM_ID);
		const result = setSkipped(skipped, ITEM_ID, false);
		expect(isSkipped(result, ITEM_ID)).toBe(false);
	});

	it('round-trips watched -> skipped -> watched cleanly, never leaving both flags set', () => {
		let progress: Progress = createEmptyProgress();
		progress = setWatched(progress, ITEM_ID, true, TODAY);
		progress = setSkipped(progress, ITEM_ID, true);

		expect(isWatched(progress, ITEM_ID)).toBe(false);
		expect(isSkipped(progress, ITEM_ID)).toBe(true);

		progress = setWatched(progress, ITEM_ID, true, TODAY);

		expect(isWatched(progress, ITEM_ID)).toBe(true);
		expect(isSkipped(progress, ITEM_ID)).toBe(false);
	});
});

describe('setWatchedEpisodes', () => {
	it('stores the given episode id array for the series item', () => {
		const result = setWatchedEpisodes(createEmptyProgress(), 'loki', ['s1e1', 's1e2']);
		expect(result.watchedEpisodes['loki']).toEqual(['s1e1', 's1e2']);
	});

	it('removes the entry entirely when given an empty array', () => {
		const withEpisodes = setWatchedEpisodes(createEmptyProgress(), 'loki', ['s1e1']);
		const result = setWatchedEpisodes(withEpisodes, 'loki', []);

		expect(result.watchedEpisodes['loki']).toBeUndefined();
		expect(Object.prototype.hasOwnProperty.call(result.watchedEpisodes, 'loki')).toBe(false);
	});

	it('does not mutate the input progress', () => {
		const original = createEmptyProgress();
		setWatchedEpisodes(original, 'loki', ['s1e1']);

		expect(original.watchedEpisodes).toEqual({});
	});
});

describe('isWatched / isSkipped', () => {
	it('return false for an id with no progress entry', () => {
		const progress = createEmptyProgress();
		expect(isWatched(progress, 'unknown')).toBe(false);
		expect(isSkipped(progress, 'unknown')).toBe(false);
	});
});
