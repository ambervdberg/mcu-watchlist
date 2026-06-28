// Regression tests for mergeTitleInfoWithPrior: a successful OMDb fetch that returns a
// sentinel ("N/A"/empty) for a field must never regress a previously-good value in the
// snapshot. (Trailer preservation is handled upstream in the loader, which only fetches a
// trailer when none is cached, so there is nothing to merge here for it.)

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTitleInfo, mergeTitleInfoWithPrior, type TitleInfo, type TrailerInfo } from './titleInfoFetch';
import { writeRawCache } from './rawResponseCache';

const trailer: TrailerInfo = {
	id: 'vi123',
	name: 'Official Trailer',
	description: '',
	url: 'https://www.imdb.com/video/vi123/',
	embedUrl: 'https://www.imdb.com/videoembed/vi123',
	imageUrl: 'https://example.com/t.jpg',
	runtimeSeconds: 120
};

const cacheRoots: string[] = [];

afterEach(async () => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	await Promise.all(cacheRoots.map((root) => rm(root, { recursive: true, force: true })));
	cacheRoots.length = 0;
});

async function createCacheRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'title-info-cache-'));
	cacheRoots.push(root);
	return root;
}

/** A fully-populated, good snapshot entry to merge fresh fetches against. */
function goodPrior(): TitleInfo {
	return {
		plot: 'A real plot.',
		imdbRating: '8.1',
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
		poster: 'N/A',
		runtimeMinutes: null,
		released: 'N/A',
		trailer: null
	};
}

describe('mergeTitleInfoWithPrior', () => {
	it('returns live unchanged when there is no prior entry', () => {
		const live = sentinelLive();

		expect(mergeTitleInfoWithPrior(live, undefined)).toBe(live);
	});

	it('keeps prior values when the live fetch returns sentinels for every field', () => {
		const merged = mergeTitleInfoWithPrior(sentinelLive(), goodPrior());

		expect(merged.plot).toBe('A real plot.');
		expect(merged.imdbRating).toBe('8.1');
		expect(merged.poster).toBe('https://example.com/poster.jpg');
		expect(merged.runtimeMinutes).toBe(126);
		expect(merged.released).toBe('02 May 2008');
	});

	it('always takes the live trailer (the loader fetches one only when none is cached)', () => {
		// Live carries no trailer; prior has one. The merge does not resurrect it -- the loader
		// already decided to look again precisely because no trailer was cached.
		const merged = mergeTitleInfoWithPrior(sentinelLive(), goodPrior());

		expect(merged.trailer).toBeNull();
	});

	it('prefers fresh real values over the prior snapshot', () => {
		const live: TitleInfo = {
			plot: 'Updated plot.',
			imdbRating: '8.4',
			poster: 'https://example.com/new.jpg',
			runtimeMinutes: 130,
			released: '03 May 2008',
			trailer
		};

		const merged = mergeTitleInfoWithPrior(live, goodPrior());

		expect(merged.plot).toBe('Updated plot.');
		expect(merged.imdbRating).toBe('8.4');
		expect(merged.poster).toBe('https://example.com/new.jpg');
		expect(merged.runtimeMinutes).toBe(130);
		expect(merged.released).toBe('03 May 2008');
		expect(merged.trailer).toEqual(trailer);
	});

	it('does not regress a single field while refreshing the others', () => {
		// OMDb dropped only the poster this build; everything else is fresh and real.
		const live: TitleInfo = {
			plot: 'Updated plot.',
			imdbRating: '8.4',
			poster: 'N/A',
			runtimeMinutes: 130,
			released: '03 May 2008',
			trailer
		};

		const merged = mergeTitleInfoWithPrior(live, goodPrior());

		expect(merged.poster).toBe('https://example.com/poster.jpg');
		expect(merged.plot).toBe('Updated plot.');
	});

	it('keeps the prior plot when the live fetch returns a shorter summary', () => {
		const live: TitleInfo = {
			...goodPrior(),
			plot: 'Short plot.'
		};

		const merged = mergeTitleInfoWithPrior(live, goodPrior());

		expect(merged.plot).toBe('A real plot.');
	});
});

describe('fetchTitleInfo', () => {
	it('uses imdbapi.dev title data without requiring an OMDb API key', async () => {
		const cacheRoot = await createCacheRoot();
		vi.stubEnv('OMDB_API_KEY', '');
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					plot: 'A billionaire builds an armored suit.',
					primaryImage: { url: 'https://example.com/iron-man.jpg' },
					runtimeSeconds: 7560,
					rating: { aggregateRating: 7.9 }
				}),
				{ status: 200 }
			)
		);

		const titleInfo = await fetchTitleInfo('tt0371746', undefined, { trailer }, undefined, { cacheRoot });

		expect(titleInfo).toEqual({
			plot: 'A billionaire builds an armored suit.',
			imdbRating: '7.9',
			poster: 'https://example.com/iron-man.jpg',
			runtimeMinutes: 126,
			released: 'N/A',
			trailer
		});
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.imdbapi.dev/titles/tt0371746');
	});

	it('uses cached imdbapi.dev title data without fetching', async () => {
		const cacheRoot = await createCacheRoot();
		await writeRawCache(
			{ source: 'imdbapi.dev', endpoint: 'titles', key: 'tt0371746' },
			200,
			{
				plot: 'Cached plot.',
				primaryImage: { url: 'https://example.com/cached.jpg' },
				runtimeSeconds: 7560,
				rating: { aggregateRating: 7.9 }
			},
			cacheRoot,
			new Date('2026-06-24T10:00:00.000Z')
		);
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		const titleInfo = await fetchTitleInfo('tt0371746', undefined, { trailer }, undefined, { cacheRoot });

		expect(fetchMock).not.toHaveBeenCalled();
		expect(titleInfo.plot).toBe('Cached plot.');
		expect(titleInfo.runtimeMinutes).toBe(126);
	});

	it('ignores imdbapi.dev runtime for series seasons', async () => {
		const cacheRoot = await createCacheRoot();
		vi.stubEnv('OMDB_API_KEY', '');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					plot: 'Series plot.',
					primaryImage: { url: 'https://example.com/series.jpg' },
					runtimeSeconds: 2400,
					rating: { aggregateRating: 7.9 }
				}),
				{ status: 200 }
			)
		);

		const titleInfo = await fetchTitleInfo('tt9140560', '1', { trailer }, undefined, { cacheRoot });

		expect(titleInfo.runtimeMinutes).toBeNull();
	});

	it('uses the configured OMDb key when imdbapi.dev title data is unusable', async () => {
		const cacheRoot = await createCacheRoot();
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						Response: 'True',
						Plot: 'Fallback plot.',
						imdbRating: '8.0',
						Poster: 'https://example.com/fallback.jpg',
						Runtime: '120 min',
						Released: '01 Jan 2000'
					}),
					{ status: 200 }
				)
			);

		const titleInfo = await fetchTitleInfo('tt0371746', undefined, { trailer }, undefined, { cacheRoot });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[1]?.[0]).toBe('https://www.omdbapi.com/?i=tt0371746&apikey=test-key&plot=full');
		expect(titleInfo.plot).toBe('Fallback plot.');
	});

	it('skips OMDb fallback when prior snapshot data is usable', async () => {
		const cacheRoot = await createCacheRoot();
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

		const titleInfo = await fetchTitleInfo('tt0371746', undefined, { trailer }, goodPrior(), { cacheRoot });

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.imdbapi.dev/titles/tt0371746');
		expect(titleInfo).toEqual(goodPrior());
	});
});
