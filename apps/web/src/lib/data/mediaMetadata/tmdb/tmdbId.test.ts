import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTmdbId } from './tmdbId';
import { writeRawCache } from '../rawResponseCache';
import { cleanupCacheRoots, createCacheRoot } from '../cacheRootTestHelper';

afterEach(async () => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	await cleanupCacheRoots();
});

describe('resolveTmdbId', () => {
	it('resolves a movie id from movie_results when asked for movie', async () => {
		const cacheRoot = await createCacheRoot('tmdb-id-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ movie_results: [{ id: 1726 }], tv_results: [] }), { status: 200 })
			);

		const result = await resolveTmdbId('tt0371746', 'movie', { cacheRoot });

		expect(result).toBe(1726);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			'https://api.themoviedb.org/3/find/tt0371746?external_source=imdb_id&api_key=test-key'
		);
	});

	it('resolves a tv id from tv_results when asked for tv', async () => {
		const cacheRoot = await createCacheRoot('tmdb-id-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ movie_results: [], tv_results: [{ id: 2734 }] }), { status: 200 })
		);

		const result = await resolveTmdbId('tt9140560', 'tv', { cacheRoot });

		expect(result).toBe(2734);
	});

	it('returns the tv id when the response also holds an unrelated movie match', async () => {
		const cacheRoot = await createCacheRoot('tmdb-id-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ movie_results: [{ id: 1747255 }], tv_results: [{ id: 61889 }] }), {
				status: 200
			})
		);

		const result = await resolveTmdbId('tt3322312', 'tv', { cacheRoot });

		expect(result).toBe(61889);
	});

	it('returns null when TMDB has no match of the requested kind', async () => {
		const cacheRoot = await createCacheRoot('tmdb-id-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ movie_results: [], tv_results: [] }), { status: 200 })
		);

		const result = await resolveTmdbId('tt0000000', 'movie', { cacheRoot });

		expect(result).toBeNull();
	});

	it('uses cached find data without fetching', async () => {
		const cacheRoot = await createCacheRoot('tmdb-id-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		await writeRawCache(
			{ source: 'tmdb', endpoint: 'find', key: 'tt0371746' },
			200,
			{ movie_results: [{ id: 1726 }], tv_results: [] },
			cacheRoot,
			new Date('2026-06-24T10:00:00.000Z')
		);
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		const result = await resolveTmdbId('tt0371746', 'movie', { cacheRoot });

		expect(fetchMock).not.toHaveBeenCalled();
		expect(result).toBe(1726);
	});
});
