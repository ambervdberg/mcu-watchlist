import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTrailerFromTmdb } from './tmdbTrailer';
import { writeRawCache } from '../rawResponseCache';
import { cleanupCacheRoots, createCacheRoot } from '../cacheRootTestHelper';

afterEach(async () => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	await cleanupCacheRoots();
});

describe('fetchTrailerFromTmdb', () => {
	it('picks the official trailer over a non-official one', async () => {
		const cacheRoot = await createCacheRoot('tmdb-trailer-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					results: [
						{ site: 'YouTube', type: 'Trailer', key: 'abc123', name: 'Teaser Trailer', official: false },
						{ site: 'YouTube', type: 'Trailer', key: 'def456', name: 'Official Trailer', official: true }
					]
				}),
				{ status: 200 }
			)
		);

		const trailer = await fetchTrailerFromTmdb(1726, 'movie', undefined, { cacheRoot });

		expect(trailer).toEqual({
			id: 'def456',
			name: 'Official Trailer',
			description: '',
			url: 'https://www.youtube.com/watch?v=def456',
			embedUrl: 'https://www.youtube.com/embed/def456',
			imageUrl: 'https://img.youtube.com/vi/def456/hqdefault.jpg',
			runtimeSeconds: null
		});
	});

	it('ignores non-YouTube and non-Trailer videos', async () => {
		const cacheRoot = await createCacheRoot('tmdb-trailer-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					results: [
						{ site: 'Vimeo', type: 'Trailer', key: 'skip1', name: 'Not YouTube' },
						{ site: 'YouTube', type: 'Clip', key: 'skip2', name: 'Not a trailer' }
					]
				}),
				{ status: 200 }
			)
		);

		const trailer = await fetchTrailerFromTmdb(1726, 'movie', undefined, { cacheRoot });

		expect(trailer).toBeNull();
	});

	it('fetches a series season trailer from the season videos endpoint', async () => {
		const cacheRoot = await createCacheRoot('tmdb-trailer-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					results: [{ site: 'YouTube', type: 'Trailer', key: 'season1', name: 'Season 1 Trailer', official: true }]
				}),
				{ status: 200 }
			)
		);

		const trailer = await fetchTrailerFromTmdb(2734, 'tv', '1', { cacheRoot });

		expect(trailer?.id).toBe('season1');
		expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.themoviedb.org/3/tv/2734/season/1/videos?api_key=test-key');
	});

	it('uses cached video data without fetching', async () => {
		const cacheRoot = await createCacheRoot('tmdb-trailer-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		await writeRawCache(
			{ source: 'tmdb', endpoint: 'videos', key: '1726' },
			200,
			{ results: [{ site: 'YouTube', type: 'Trailer', key: 'cached1', name: 'Cached Trailer', official: true }] },
			cacheRoot,
			new Date('2026-06-24T10:00:00.000Z')
		);
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		const trailer = await fetchTrailerFromTmdb(1726, 'movie', undefined, { cacheRoot });

		expect(fetchMock).not.toHaveBeenCalled();
		expect(trailer?.id).toBe('cached1');
	});
});
