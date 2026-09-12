import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import { createEmptyProgress, markSkipped, markWatched, setWatchedEpisodes, type Progress } from './progress';
import { findUpNext, type EpisodeSummary } from './upNext';

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

const HAWKEYE = makeItem({
	id: 'hawkeye',
	title: 'Hawkeye',
	dot: '2021',
	type: 'series',
	imdbId: 'tt10160804',
	essential: false
});

const ITEMS = [IRON_MAN, IRON_MAN_2, LOKI];

const LOKI_EPISODES: readonly EpisodeSummary[] = [
	{ id: 'loki-e1', title: 'Glorious Purpose', episodeNumber: 1 },
	{ id: 'loki-e2', title: 'The Variant', episodeNumber: 2 },
	{ id: 'loki-e3', title: 'Lamentis', episodeNumber: 3 }
];

describe('findUpNext', () => {
	it('returns the first item in catalog order when progress is empty', () => {
		const upNext = findUpNext(ITEMS, createEmptyProgress(), false, {});

		expect(upNext).toEqual({ item: IRON_MAN, episode: null, remainingEpisodes: null, allEpisodeIds: [] });
	});

	it('skips a watched item and returns the next one', () => {
		const progress = markWatched(createEmptyProgress(), IRON_MAN.id, '2026-06-23');
		const upNext = findUpNext(ITEMS, progress, false, {});

		expect(upNext?.item).toEqual(IRON_MAN_2);
	});

	it('skips a skipped item and returns the next one', () => {
		const progress = markSkipped(createEmptyProgress(), IRON_MAN.id);
		const upNext = findUpNext(ITEMS, progress, false, {});

		expect(upNext?.item).toEqual(IRON_MAN_2);
	});

	it('skips a non-essential item when essentialOnly is true', () => {
		let progress: Progress = createEmptyProgress();
		progress = markWatched(progress, IRON_MAN.id, '2026-06-23');
		progress = markWatched(progress, IRON_MAN_2.id, '2026-06-23');

		const upNext = findUpNext(ITEMS, progress, true, { [LOKI.id]: LOKI_EPISODES });

		expect(upNext).toBeNull();
	});

	it('returns the next unwatched episode and remaining count for a partly watched series', () => {
		let progress: Progress = createEmptyProgress();
		progress = markWatched(progress, IRON_MAN.id, '2026-06-23');
		progress = markWatched(progress, IRON_MAN_2.id, '2026-06-23');
		progress = setWatchedEpisodes(progress, LOKI.id, ['loki-e1']);

		const upNext = findUpNext(ITEMS, progress, false, { [LOKI.id]: LOKI_EPISODES });

		expect(upNext?.item).toEqual(LOKI);
		expect(upNext?.episode).toEqual(LOKI_EPISODES[1]);
		expect(upNext?.remainingEpisodes).toBe(2);
		expect(upNext?.allEpisodeIds).toEqual(['loki-e1', 'loki-e2', 'loki-e3']);
	});

	it('falls through to the next item once a series is marked watched', () => {
		let progress: Progress = createEmptyProgress();
		progress = markWatched(progress, IRON_MAN.id, '2026-06-23');
		progress = markWatched(progress, IRON_MAN_2.id, '2026-06-23');
		progress = markWatched(progress, LOKI.id, '2026-06-23');

		const upNext = findUpNext(ITEMS, progress, false, { [LOKI.id]: LOKI_EPISODES });

		expect(upNext).toBeNull();
	});

	it('returns null when every item is watched or skipped', () => {
		let progress: Progress = createEmptyProgress();
		progress = markWatched(progress, IRON_MAN.id, '2026-06-23');
		progress = markSkipped(progress, IRON_MAN_2.id);
		progress = markWatched(progress, LOKI.id, '2026-06-23');

		const upNext = findUpNext(ITEMS, progress, false, { [LOKI.id]: LOKI_EPISODES });

		expect(upNext).toBeNull();
	});

	it('skips a series with all baked episodes watched but not marked watched, returns the next item', () => {
		let progress: Progress = createEmptyProgress();
		progress = markWatched(progress, IRON_MAN.id, '2026-06-23');
		progress = markWatched(progress, IRON_MAN_2.id, '2026-06-23');
		progress = setWatchedEpisodes(progress, LOKI.id, ['loki-e1', 'loki-e2', 'loki-e3']);

		const upNext = findUpNext([...ITEMS, HAWKEYE], progress, false, { [LOKI.id]: LOKI_EPISODES });

		expect(upNext?.item).toEqual(HAWKEYE);
	});

	it('returns the series item with a null episode when no episode data is baked', () => {
		let progress: Progress = createEmptyProgress();
		progress = markWatched(progress, IRON_MAN.id, '2026-06-23');
		progress = markWatched(progress, IRON_MAN_2.id, '2026-06-23');

		const upNext = findUpNext(ITEMS, progress, false, {});

		expect(upNext).toEqual({ item: LOKI, episode: null, remainingEpisodes: null, allEpisodeIds: [] });
	});
});
