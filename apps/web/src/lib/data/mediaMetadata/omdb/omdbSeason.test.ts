import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOmdbSeason, findOmdbEpisode } from './omdbSeason';
import { writeRawCache } from '../rawResponseCache';
import { cleanupCacheRoots, createCacheRoot } from '../cacheRootTestHelper';

afterEach(async () => {
	vi.restoreAllMocks();
	await cleanupCacheRoots();
});

describe('fetchOmdbSeason', () => {
	it('fetches the by-season episode list', async () => {
		const cacheRoot = await createCacheRoot('omdb-season-cache-');
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					Response: 'True',
					Episodes: [
						{ Episode: '1', Released: '2015-04-10', imdbRating: '8.1' },
						{ Episode: '2', Released: '2015-04-17', imdbRating: '7.9' }
					]
				}),
				{ status: 200 }
			)
		);

		const episodes = await fetchOmdbSeason('tt3322312', '1', 'test-key', { cacheRoot });

		expect(episodes).toEqual([
			{ Episode: '1', Released: '2015-04-10', imdbRating: '8.1' },
			{ Episode: '2', Released: '2015-04-17', imdbRating: '7.9' }
		]);
		expect(fetchMock.mock.calls[0]?.[0]).toBe('https://www.omdbapi.com/?i=tt3322312&Season=1&apikey=test-key');
	});

	it('reuses the cached season response for both title and episode callers', async () => {
		const cacheRoot = await createCacheRoot('omdb-season-cache-');
		await writeRawCache(
			{ source: 'omdb', endpoint: 'season', key: 'tt3322312-s1' },
			200,
			{ Response: 'True', Episodes: [{ Episode: '1', Released: '2015-04-10', imdbRating: '8.1' }] },
			cacheRoot,
			new Date('2026-06-24T10:00:00.000Z')
		);
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		await fetchOmdbSeason('tt3322312', '1', 'test-key', { cacheRoot });
		await fetchOmdbSeason('tt3322312', '1', 'test-key', { cacheRoot });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns null when OMDb has no data for the season', async () => {
		const cacheRoot = await createCacheRoot('omdb-season-cache-');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ Response: 'False' }), { status: 200 })
		);

		const episodes = await fetchOmdbSeason('tt0000000', '1', 'test-key', { cacheRoot });

		expect(episodes).toBeNull();
	});

	it('returns null instead of throwing when the request fails', async () => {
		const cacheRoot = await createCacheRoot('omdb-season-cache-');
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

		const episodes = await fetchOmdbSeason('tt3322312', '1', 'test-key', { cacheRoot });

		expect(episodes).toBeNull();
	});
});

describe('findOmdbEpisode', () => {
	const episodes = [
		{ Episode: '1', Released: '2015-04-10', imdbRating: '8.1' },
		{ Episode: '2', Released: '2015-04-17', imdbRating: '7.9' }
	];

	it('finds the episode matching the given episode number', () => {
		expect(findOmdbEpisode(episodes, 2)).toEqual({ Episode: '2', Released: '2015-04-17', imdbRating: '7.9' });
	});

	it('returns undefined when there is no match', () => {
		expect(findOmdbEpisode(episodes, 9)).toBeUndefined();
	});

	it('returns undefined for a null episode list', () => {
		expect(findOmdbEpisode(null, 1)).toBeUndefined();
	});
});
