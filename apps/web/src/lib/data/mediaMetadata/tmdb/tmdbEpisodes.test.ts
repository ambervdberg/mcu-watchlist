import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchEpisodesFromTmdb } from './tmdbEpisodes';
import { writeRawCache } from '../rawResponseCache';
import { cleanupCacheRoots, createCacheRoot } from '../cacheRootTestHelper';

const configResponse = new Response(
	JSON.stringify({ images: { secure_base_url: 'https://image.tmdb.org/t/p/', still_sizes: ['w92', 'w300'] } }),
	{ status: 200 }
);

afterEach(async () => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	await cleanupCacheRoots();
});

describe('fetchEpisodesFromTmdb', () => {
	it('maps TMDB season episodes to the shared Episode shape, with a placeholder imdbRating', async () => {
		const cacheRoot = await createCacheRoot('tmdb-episodes-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						episodes: [
							{
								id: 4638167,
								name: 'Web of Fire',
								overview: 'Peter faces a new threat.',
								still_path: '/abc.jpg',
								runtime: 42,
								air_date: '2025-01-29',
								episode_number: 1
							}
						]
					}),
					{ status: 200 }
				)
			)
			.mockResolvedValueOnce(configResponse);

		const episodeInfo = await fetchEpisodesFromTmdb(2734, '1', { cacheRoot });

		expect(episodeInfo?.episodes[0]).toEqual({
			id: '4638167',
			title: 'Web of Fire',
			episodeNumber: 1,
			runtimeSeconds: 2520,
			plot: 'Peter faces a new threat.',
			posterUrl: 'https://image.tmdb.org/t/p/w300/abc.jpg',
			imdbRating: 'N/A',
			released: '2025-01-29'
		});
		expect(episodeInfo?.totalCount).toBe(1);
	});

	it('returns empty posterUrl when TMDB has no still image', async () => {
		const cacheRoot = await createCacheRoot('tmdb-episodes-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						episodes: [{ id: 1, name: 'Untitled', still_path: null, episode_number: 2 }]
					}),
					{ status: 200 }
				)
			)
			.mockResolvedValueOnce(configResponse);

		const episodeInfo = await fetchEpisodesFromTmdb(2734, '2', { cacheRoot });

		expect(episodeInfo?.episodes[0]?.posterUrl).toBe('');
		expect(episodeInfo?.episodes[0]?.runtimeSeconds).toBeNull();
	});

	it('returns null when the season has no episodes, without fetching image configuration', async () => {
		const cacheRoot = await createCacheRoot('tmdb-episodes-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ episodes: [] }), { status: 200 }));

		const episodeInfo = await fetchEpisodesFromTmdb(2734, '3', { cacheRoot });

		expect(episodeInfo).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('uses cached season data without fetching it again', async () => {
		const cacheRoot = await createCacheRoot('tmdb-episodes-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		await writeRawCache(
			{ source: 'tmdb', endpoint: 'season', key: '2734-s1' },
			200,
			{ episodes: [{ id: 1, name: 'Cached', episode_number: 1, air_date: '2025-01-01' }] },
			cacheRoot,
			new Date('2026-06-24T10:00:00.000Z')
		);
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(configResponse);

		const episodeInfo = await fetchEpisodesFromTmdb(2734, '1', { cacheRoot });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.themoviedb.org/3/configuration?api_key=test-key');
		expect(episodeInfo?.episodes[0]?.title).toBe('Cached');
	});
});
