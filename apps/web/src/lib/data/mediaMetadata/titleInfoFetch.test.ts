// Regression tests for fetchTitleInfo (OMDb title/season fields + TMDB trailer) and for
// mergeTitleInfoWithPrior's "prior wins except released/imdbRating" merge rule.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTitleInfo, mergeTitleInfoWithPrior, type TitleInfo, type TrailerInfo } from './titleInfoFetch';
import { cleanupCacheRoots, createCacheRoot } from './cacheRootTestHelper';

const trailer: TrailerInfo = {
	id: 'vi123',
	name: 'Official Trailer',
	description: '',
	url: 'https://www.imdb.com/video/vi123/',
	embedUrl: 'https://www.imdb.com/videoembed/vi123',
	imageUrl: 'https://example.com/t.jpg',
	runtimeSeconds: 120
};

afterEach(async () => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	await cleanupCacheRoots();
});

/** A fully-populated, good snapshot entry to merge fresh fetches against. */
function goodPrior(): TitleInfo {
	return {
		plot: 'A real plot.',
		imdbRating: '8.1',
		imdbVotes: '1,234,567',
		poster: 'https://example.com/poster.jpg',
		runtimeMinutes: 126,
		released: '02 May 2008',
		trailer
	};
}

/** A fresh fetch where OMDb returned sentinels for every field. */
function sentinelLive(): TitleInfo {
	return {
		plot: '',
		imdbRating: 'N/A',
		imdbVotes: 'N/A',
		poster: 'N/A',
		runtimeMinutes: null,
		released: 'N/A',
		trailer: null
	};
}

/** A minimal successful OMDb title response, with fields overridable per test. */
function omdbTitleResponse(overrides: Record<string, string> = {}): Response {
	return new Response(
		JSON.stringify({
			Response: 'True',
			Plot: 'A billionaire builds an armored suit.',
			imdbRating: '7.9',
			imdbVotes: '1,111,111',
			Poster: 'https://example.com/iron-man.jpg',
			Runtime: '126 min',
			Released: '02 May 2008',
			...overrides
		}),
		{ status: 200 }
	);
}

describe('mergeTitleInfoWithPrior', () => {
	it('returns live unchanged when there is no prior entry', () => {
		const live = sentinelLive();

		expect(mergeTitleInfoWithPrior(live, undefined)).toBe(live);
	});

	it('keeps prior plot, poster, runtime and trailer even when live has fresh values', () => {
		const live: TitleInfo = {
			plot: 'Updated plot.',
			imdbRating: '8.4',
			imdbVotes: '2,000,000',
			poster: 'https://example.com/new.jpg',
			runtimeMinutes: 130,
			released: '03 May 2008',
			trailer: null
		};

		const merged = mergeTitleInfoWithPrior(live, goodPrior());

		expect(merged.plot).toBe('A real plot.');
		expect(merged.poster).toBe('https://example.com/poster.jpg');
		expect(merged.runtimeMinutes).toBe(126);
		expect(merged.trailer).toEqual(trailer);
	});

	it('fills plot, poster, runtime and trailer from live when prior has no real value yet', () => {
		const live: TitleInfo = {
			plot: 'Fresh plot.',
			imdbRating: '7.0',
			imdbVotes: '500,000',
			poster: 'https://example.com/p.jpg',
			runtimeMinutes: 100,
			released: '01 Jan 2020',
			trailer
		};

		const merged = mergeTitleInfoWithPrior(live, sentinelLive());

		expect(merged.plot).toBe('Fresh plot.');
		expect(merged.poster).toBe('https://example.com/p.jpg');
		expect(merged.runtimeMinutes).toBe(100);
		expect(merged.trailer).toEqual(trailer);
	});

	it('takes live released, imdbRating and imdbVotes whenever the live value is real', () => {
		const live: TitleInfo = {
			...goodPrior(),
			imdbRating: '8.4',
			imdbVotes: '2,000,000',
			released: '03 May 2008'
		};

		const merged = mergeTitleInfoWithPrior(live, goodPrior());

		expect(merged.imdbRating).toBe('8.4');
		expect(merged.imdbVotes).toBe('2,000,000');
		expect(merged.released).toBe('03 May 2008');
	});

	it('keeps prior released, imdbRating and imdbVotes when live returns a sentinel', () => {
		const merged = mergeTitleInfoWithPrior(sentinelLive(), goodPrior());

		expect(merged.imdbRating).toBe('8.1');
		expect(merged.imdbVotes).toBe('1,234,567');
		expect(merged.released).toBe('02 May 2008');
	});
});

describe('fetchTitleInfo', () => {
	it('reuses a cached trailer without calling TMDB', async () => {
		const cacheRoot = await createCacheRoot('title-info-cache-');
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(omdbTitleResponse());

		const titleInfo = await fetchTitleInfo('tt0371746', undefined, { trailer }, { cacheRoot });

		expect(titleInfo.trailer).toEqual(trailer);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe('https://www.omdbapi.com/?i=tt0371746&apikey=test-key&plot=full');
	});

	it('resolves a trailer from TMDB when none is cached', async () => {
		const cacheRoot = await createCacheRoot('title-info-cache-');
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		vi.stubEnv('TMDB_API_KEY', 'tmdb-key');
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ movie_results: [{ id: 1726 }], tv_results: [] }), { status: 200 })
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						results: [{ site: 'YouTube', type: 'Trailer', key: 'abc123', official: true, name: 'Official Trailer' }]
					}),
					{ status: 200 }
				)
			)
			.mockResolvedValueOnce(omdbTitleResponse());

		const titleInfo = await fetchTitleInfo('tt0371746', undefined, undefined, { cacheRoot });

		expect(titleInfo.trailer?.id).toBe('abc123');
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('leaves the trailer null without throwing when TMDB_API_KEY is not configured', async () => {
		const cacheRoot = await createCacheRoot('title-info-cache-');
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		vi.stubEnv('TMDB_API_KEY', '');
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(omdbTitleResponse());

		const titleInfo = await fetchTitleInfo('tt0371746', undefined, undefined, { cacheRoot });

		expect(titleInfo.trailer).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('throws when OMDB_API_KEY is not configured', async () => {
		const cacheRoot = await createCacheRoot('title-info-cache-');
		vi.stubEnv('OMDB_API_KEY', '');

		await expect(fetchTitleInfo('tt0371746', undefined, { trailer }, { cacheRoot })).rejects.toThrow(
			'OMDB_API_KEY is not configured.'
		);
	});

	it('does not call the season endpoint for a movie', async () => {
		const cacheRoot = await createCacheRoot('title-info-cache-');
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(omdbTitleResponse());

		await fetchTitleInfo('tt0371746', undefined, { trailer }, { cacheRoot });

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("uses the season endpoint's own episode 1 release date for a series season", async () => {
		const cacheRoot = await createCacheRoot('title-info-cache-');
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(omdbTitleResponse({ Released: '10 Apr 2015' }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						Response: 'True',
						Episodes: [
							{ Episode: '1', Released: '2015-04-10' },
							{ Episode: '2', Released: '2015-04-17' }
						]
					}),
					{ status: 200 }
				)
			);

		const titleInfo = await fetchTitleInfo('tt3322312', '1', { trailer }, { cacheRoot });

		expect(titleInfo.released).toBe('10 Apr 2015');
		expect(fetchMock.mock.calls[1]?.[0]).toBe('https://www.omdbapi.com/?i=tt3322312&Season=1&apikey=test-key');
	});

	it('falls back to the show-level released date when the season premiere date is N/A', async () => {
		const cacheRoot = await createCacheRoot('title-info-cache-');
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(omdbTitleResponse({ Released: '04 Mar 2025' }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						Response: 'True',
						Episodes: [
							{ Episode: '1', Released: 'N/A' },
							{ Episode: '2', Released: '2025-03-04' }
						]
					}),
					{ status: 200 }
				)
			);

		const titleInfo = await fetchTitleInfo('tt18923754', '1', { trailer }, { cacheRoot });

		expect(titleInfo.released).toBe('04 Mar 2025');
	});

	it('throws for a later season with no real premiere date yet, instead of borrowing an unrelated date', async () => {
		const cacheRoot = await createCacheRoot('title-info-cache-');
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(omdbTitleResponse({ Released: '04 Mar 2025' }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ Response: 'True', Episodes: [{ Episode: '1', Released: 'N/A' }] }), {
					status: 200
				})
			);

		await expect(fetchTitleInfo('tt18923754', '3', { trailer }, { cacheRoot })).rejects.toThrow(
			'No real premiere date yet for season 3'
		);
	});

	it('falls back to the show-level released date for season 1 when the season endpoint call fails', async () => {
		const cacheRoot = await createCacheRoot('title-info-cache-');
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(omdbTitleResponse({ Released: '10 Apr 2015' }))
			.mockResolvedValueOnce(new Response('', { status: 500 }));

		const titleInfo = await fetchTitleInfo('tt3322312', '1', { trailer }, { cacheRoot });

		expect(titleInfo.released).toBe('10 Apr 2015');
	});
});
