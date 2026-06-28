import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchEpisodeInfoFromImdbApiDev } from './episodeInfoFetch';
import { writeRawCache } from './rawResponseCache';

const cacheRoots: string[] = [];

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(cacheRoots.map((root) => rm(root, { recursive: true, force: true })));
	cacheRoots.length = 0;
});

async function createCacheRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'episode-info-cache-'));
	cacheRoots.push(root);
	return root;
}

describe('fetchEpisodeInfoFromImdbApiDev', () => {
	it('uses cached imdbapi.dev episode data without fetching', async () => {
		const cacheRoot = await createCacheRoot();
		await writeRawCache(
			{ source: 'imdbapi.dev', endpoint: 'episodes', key: 'tt9140560-s1' },
			200,
			{
				episodes: [
					{
						id: 'tt9601584',
						title: 'Filmed Before a Live Studio Audience',
						episodeNumber: 1,
						runtimeSeconds: 1800,
						plot: 'Cached episode.',
						primaryImage: { url: 'https://example.com/episode.jpg' },
						rating: { aggregateRating: 7.3 },
						releaseDate: { year: 2021, month: 1, day: 15 }
					}
				],
				totalCount: 1
			},
			cacheRoot,
			new Date('2026-06-24T10:00:00.000Z')
		);
		const fetchMock = vi.spyOn(globalThis, 'fetch');

		const episodeInfo = await fetchEpisodeInfoFromImdbApiDev('tt9140560', '1', { cacheRoot });

		expect(fetchMock).not.toHaveBeenCalled();
		expect(episodeInfo?.episodes[0]).toEqual({
			id: 'tt9601584',
			title: 'Filmed Before a Live Studio Audience',
			episodeNumber: 1,
			runtimeSeconds: 1800,
			plot: 'Cached episode.',
			posterUrl: 'https://example.com/episode.jpg',
			imdbRating: '7.3',
			released: '2021-01-15'
		});
	});
});
