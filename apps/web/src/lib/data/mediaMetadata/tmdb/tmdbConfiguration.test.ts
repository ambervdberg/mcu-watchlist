import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTmdbImageConfig } from './tmdbConfiguration';
import { cleanupCacheRoots, createCacheRoot } from '../cacheRootTestHelper';

afterEach(async () => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	await cleanupCacheRoots();
});

describe('fetchTmdbImageConfig', () => {
	it('reads the image host and still size from TMDB configuration', async () => {
		const cacheRoot = await createCacheRoot('tmdb-config-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					images: {
						base_url: 'http://image.tmdb.org/t/p/',
						secure_base_url: 'https://image.tmdb.org/t/p/',
						still_sizes: ['w92', 'w185', 'w300', 'original']
					}
				}),
				{ status: 200 }
			)
		);

		const config = await fetchTmdbImageConfig({ cacheRoot });

		expect(config).toEqual({ baseUrl: 'https://image.tmdb.org/t/p/', stillSize: 'w300' });
		expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.themoviedb.org/3/configuration?api_key=test-key');
	});

	it("falls back to 'original' when TMDB does not offer w300", async () => {
		const cacheRoot = await createCacheRoot('tmdb-config-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					images: { secure_base_url: 'https://image.tmdb.org/t/p/', still_sizes: ['w92', 'original'] }
				}),
				{ status: 200 }
			)
		);

		const config = await fetchTmdbImageConfig({ cacheRoot });

		expect(config.stillSize).toBe('original');
	});

	it('falls back to the default host and w300 when the request fails', async () => {
		const cacheRoot = await createCacheRoot('tmdb-config-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const config = await fetchTmdbImageConfig({ cacheRoot });

		expect(config).toEqual({ baseUrl: 'https://image.tmdb.org/t/p/', stillSize: 'w300' });
		expect(warnSpy).toHaveBeenCalledTimes(1);
	});

	it('falls back to the default host and w300 when TMDB_API_KEY is not configured', async () => {
		const cacheRoot = await createCacheRoot('tmdb-config-cache-');
		vi.stubEnv('TMDB_API_KEY', '');
		vi.spyOn(console, 'warn').mockImplementation(() => {});

		const config = await fetchTmdbImageConfig({ cacheRoot });

		expect(config).toEqual({ baseUrl: 'https://image.tmdb.org/t/p/', stillSize: 'w300' });
	});

	it('uses the cached configuration response without fetching again', async () => {
		const cacheRoot = await createCacheRoot('tmdb-config-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(
					JSON.stringify({ images: { secure_base_url: 'https://image.tmdb.org/t/p/', still_sizes: ['w300'] } }),
					{ status: 200 }
				)
			);

		await fetchTmdbImageConfig({ cacheRoot });
		await fetchTmdbImageConfig({ cacheRoot });

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
