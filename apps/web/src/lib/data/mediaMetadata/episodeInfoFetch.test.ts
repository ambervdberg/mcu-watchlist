import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	fetchEpisodeInfoFromTmdb,
	mergeEpisodeInfoWithPrior,
	type Episode,
	type EpisodeInfo
} from './episodeInfoFetch';
import { writeRawCache } from './rawResponseCache';
import { cleanupCacheRoots, createCacheRoot } from './cacheRootTestHelper';

afterEach(async () => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	await cleanupCacheRoots();
});

/** A fully-populated, good prior episode to merge fresh fetches against. */
function goodPriorEpisode(overrides: Partial<Episode> = {}): Episode {
	return {
		id: 'tt9601584',
		title: 'Filmed Before a Live Studio Audience',
		episodeNumber: 1,
		runtimeSeconds: 1800,
		plot: 'A real episode plot.',
		posterUrl: 'https://example.com/episode.jpg',
		imdbRating: '7.3',
		released: '2021-01-15',
		...overrides
	};
}

// Response bodies can only be read once, so each of these is a factory -- every
// mockResolvedValueOnce call below needs its own fresh Response instance.
function tmdbFindResponse(): Response {
	return new Response(JSON.stringify({ movie_results: [], tv_results: [{ id: 9140560 }] }), { status: 200 });
}

function tmdbSeasonResponse(): Response {
	return new Response(
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
	);
}

function tmdbConfigResponse(): Response {
	return new Response(
		JSON.stringify({ images: { secure_base_url: 'https://image.tmdb.org/t/p/', still_sizes: ['w300'] } }),
		{ status: 200 }
	);
}

describe('fetchEpisodeInfoFromTmdb', () => {
	it('resolves the TMDB id from the IMDb id, then fetches its season episode list', async () => {
		const cacheRoot = await createCacheRoot('episode-info-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.stubEnv('OMDB_API_KEY', '');
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(tmdbFindResponse())
			.mockResolvedValueOnce(tmdbSeasonResponse())
			.mockResolvedValueOnce(tmdbConfigResponse());

		const episodeInfo = await fetchEpisodeInfoFromTmdb('tt9140560', '1', { cacheRoot });

		expect(episodeInfo?.episodes[0]?.title).toBe('Web of Fire');
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('returns null without throwing when TMDB has no match for the IMDb id', async () => {
		const cacheRoot = await createCacheRoot('episode-info-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ movie_results: [], tv_results: [] }), { status: 200 })
		);

		const episodeInfo = await fetchEpisodeInfoFromTmdb('tt0000000', '1', { cacheRoot });

		expect(episodeInfo).toBeNull();
	});

	it('returns null without throwing when TMDB_API_KEY is not configured', async () => {
		const cacheRoot = await createCacheRoot('episode-info-cache-');
		vi.stubEnv('TMDB_API_KEY', '');

		const episodeInfo = await fetchEpisodeInfoFromTmdb('tt9140560', '1', { cacheRoot });

		expect(episodeInfo).toBeNull();
	});

	it('uses cached TMDB find data without fetching it again', async () => {
		const cacheRoot = await createCacheRoot('episode-info-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.stubEnv('OMDB_API_KEY', '');
		await writeRawCache(
			{ source: 'tmdb', endpoint: 'find', key: 'tt9140560' },
			200,
			{ movie_results: [], tv_results: [{ id: 9140560 }] },
			cacheRoot,
			new Date('2026-06-24T10:00:00.000Z')
		);
		await writeRawCache(
			{ source: 'tmdb', endpoint: 'season', key: '9140560-s1' },
			200,
			{ episodes: [{ id: 1, name: 'Cached', episode_number: 1, air_date: '2025-01-01' }] },
			cacheRoot,
			new Date('2026-06-24T10:00:00.000Z')
		);
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(tmdbConfigResponse());

		const episodeInfo = await fetchEpisodeInfoFromTmdb('tt9140560', '1', { cacheRoot });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(episodeInfo?.episodes[0]?.title).toBe('Cached');
	});

	it("overlays each episode's imdbRating from OMDb's by-season endpoint, matched by episode number", async () => {
		const cacheRoot = await createCacheRoot('episode-info-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.stubEnv('OMDB_API_KEY', 'omdb-key');
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(tmdbFindResponse())
			.mockResolvedValueOnce(tmdbSeasonResponse())
			.mockResolvedValueOnce(tmdbConfigResponse())
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						Response: 'True',
						Episodes: [{ Episode: '1', Released: '2025-01-29', imdbRating: '8.2' }]
					}),
					{ status: 200 }
				)
			);

		const episodeInfo = await fetchEpisodeInfoFromTmdb('tt9140560', '1', { cacheRoot });

		expect(episodeInfo?.episodes[0]?.imdbRating).toBe('8.2');
	});

	it("leaves imdbRating as 'N/A' when OMDb has no rating for that episode", async () => {
		const cacheRoot = await createCacheRoot('episode-info-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.stubEnv('OMDB_API_KEY', 'omdb-key');
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(tmdbFindResponse())
			.mockResolvedValueOnce(tmdbSeasonResponse())
			.mockResolvedValueOnce(tmdbConfigResponse())
			.mockResolvedValueOnce(new Response(JSON.stringify({ Response: 'True', Episodes: [] }), { status: 200 }));

		const episodeInfo = await fetchEpisodeInfoFromTmdb('tt9140560', '1', { cacheRoot });

		expect(episodeInfo?.episodes[0]?.imdbRating).toBe('N/A');
	});

	it("leaves imdbRating as 'N/A' when the OMDb season call fails", async () => {
		const cacheRoot = await createCacheRoot('episode-info-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.stubEnv('OMDB_API_KEY', 'omdb-key');
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(tmdbFindResponse())
			.mockResolvedValueOnce(tmdbSeasonResponse())
			.mockResolvedValueOnce(tmdbConfigResponse())
			.mockResolvedValueOnce(new Response('', { status: 500 }));

		const episodeInfo = await fetchEpisodeInfoFromTmdb('tt9140560', '1', { cacheRoot });

		expect(episodeInfo?.episodes[0]?.imdbRating).toBe('N/A');
	});

	it("leaves TMDB's placeholder imdbRating in place when OMDB_API_KEY is not configured", async () => {
		const cacheRoot = await createCacheRoot('episode-info-cache-');
		vi.stubEnv('TMDB_API_KEY', 'test-key');
		vi.stubEnv('OMDB_API_KEY', '');
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(tmdbFindResponse())
			.mockResolvedValueOnce(tmdbSeasonResponse())
			.mockResolvedValueOnce(tmdbConfigResponse());

		const episodeInfo = await fetchEpisodeInfoFromTmdb('tt9140560', '1', { cacheRoot });

		expect(episodeInfo?.episodes[0]?.imdbRating).toBe('N/A');
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});

describe('mergeEpisodeInfoWithPrior', () => {
	it('returns live unchanged when there is no prior entry', () => {
		const live: EpisodeInfo = { episodes: [goodPriorEpisode()], totalCount: 1 };

		expect(mergeEpisodeInfoWithPrior(live, undefined)).toBe(live);
	});

	it('keeps prior title, plot, posterUrl and runtimeSeconds even when live has fresh values', () => {
		const live: EpisodeInfo = {
			episodes: [
				goodPriorEpisode({
					title: 'Updated Title',
					plot: 'Updated plot.',
					posterUrl: 'https://example.com/new.jpg',
					runtimeSeconds: 2000
				})
			],
			totalCount: 1
		};
		const prior: EpisodeInfo = { episodes: [goodPriorEpisode()], totalCount: 1 };

		const merged = mergeEpisodeInfoWithPrior(live, prior);

		expect(merged.episodes[0]).toMatchObject({
			title: 'Filmed Before a Live Studio Audience',
			plot: 'A real episode plot.',
			posterUrl: 'https://example.com/episode.jpg',
			runtimeSeconds: 1800
		});
	});

	it('takes live released and imdbRating whenever the live value is real', () => {
		const live: EpisodeInfo = {
			episodes: [goodPriorEpisode({ imdbRating: '8.0', released: '2021-01-20' })],
			totalCount: 1
		};
		const prior: EpisodeInfo = { episodes: [goodPriorEpisode()], totalCount: 1 };

		const merged = mergeEpisodeInfoWithPrior(live, prior);

		expect(merged.episodes[0]?.imdbRating).toBe('8.0');
		expect(merged.episodes[0]?.released).toBe('2021-01-20');
	});

	it('keeps prior released and imdbRating when live returns a sentinel', () => {
		const live: EpisodeInfo = { episodes: [goodPriorEpisode({ imdbRating: 'N/A', released: 'N/A' })], totalCount: 1 };
		const prior: EpisodeInfo = { episodes: [goodPriorEpisode()], totalCount: 1 };

		const merged = mergeEpisodeInfoWithPrior(live, prior);

		expect(merged.episodes[0]?.imdbRating).toBe('7.3');
		expect(merged.episodes[0]?.released).toBe('2021-01-15');
	});

	it('keeps a live episode with no prior match as-is (a newly aired episode)', () => {
		const newEpisode = goodPriorEpisode({ episodeNumber: 2, title: 'New Episode' });
		const live: EpisodeInfo = { episodes: [goodPriorEpisode(), newEpisode], totalCount: 2 };
		const prior: EpisodeInfo = { episodes: [goodPriorEpisode()], totalCount: 1 };

		const merged = mergeEpisodeInfoWithPrior(live, prior);

		expect(merged.episodes).toHaveLength(2);
		expect(merged.episodes[1]).toEqual(newEpisode);
	});
});
