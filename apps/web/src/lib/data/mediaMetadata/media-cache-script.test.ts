import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	buildCacheRequests,
	isCliEntry,
	runMediaCacheRefresh,
	selectRequestsToFetch
} from '../../../../../../scripts/media-cache.mjs';
import { cleanupCacheRoots, createCacheRoot } from './cacheRootTestHelper';

/** Writes an items.ts file that parseCatalogItems can read, holding a single catalog item. */
async function writeItemsFile(itemsPath: string, id: string, type: string, imdbId: string): Promise<void> {
	const content = `export const items = [\n\t{ id: '${id}', type: '${type}', imdbId: '${imdbId}' }\n];\n`;
	await writeFile(itemsPath, content, 'utf-8');
}

/** Writes a cached TMDB "find" response holding the given movie/tv result arrays. */
async function writeFindCache(
	cacheRoot: string,
	imdbId: string,
	body: { movie_results?: Array<{ id: number }>; tv_results?: Array<{ id: number }> }
): Promise<void> {
	const cachePath = join(cacheRoot, 'tmdb', 'find', `${imdbId}.json`);
	await mkdir(join(cachePath, '..'), { recursive: true });
	await writeFile(
		cachePath,
		JSON.stringify({ updatedAt: '2026-06-24T00:00:00.000Z', source: 'tmdb', endpoint: 'find', key: imdbId, body }),
		'utf-8'
	);
}

afterEach(async () => {
	await cleanupCacheRoots();
});

async function writeCacheEntry(cacheRoot: string, path: string, updatedAt: string): Promise<void> {
	const cachePath = join(cacheRoot, path);
	await mkdir(join(cachePath, '..'), { recursive: true });
	await writeFile(cachePath, JSON.stringify({ updatedAt, body: {} }), 'utf-8');
}

describe('media cache script', () => {
	it('builds cache requests for TMDB find/season/videos and OMDb titles/season', () => {
		const requests = buildCacheRequests([
			{ id: 'loki-season-2', type: 'series', imdbId: 'tt9140554' },
			{ id: 'iron-man', type: 'movie', imdbId: 'tt0371746' },
			{ id: 'iron-man-duplicate', type: 'movie', imdbId: 'tt0371746' }
		]);

		expect(requests.map((request) => request.cachePath).sort()).toEqual([
			'omdb/season/tt9140554-s2.json',
			'omdb/titles/tt0371746.json',
			'omdb/titles/tt9140554.json',
			'tmdb/find/tt0371746.json',
			'tmdb/find/tt9140554.json',
			'tmdb/season/tt9140554-s2.json',
			'tmdb/videos/tt0371746.json',
			'tmdb/videos/tt9140554-s2.json'
		]);
	});

	it('selects only missing cache files in missing mode', async () => {
		const cacheRoot = await createCacheRoot('media-cache-script-');
		await writeCacheEntry(cacheRoot, 'tmdb/find/tt0371746.json', '2026-06-24T00:00:00.000Z');
		const requests = [{ cachePath: 'tmdb/find/tt0371746.json' }, { cachePath: 'tmdb/videos/tt0371746.json' }];

		const selected = await selectRequestsToFetch(requests, cacheRoot, {
			mode: 'missing',
			now: new Date('2026-06-24T00:00:00.000Z'),
			maxAgeDays: 7
		});

		expect(selected.map((request) => request.cachePath)).toEqual(['tmdb/videos/tt0371746.json']);
	});

	it('selects missing and week-old cache files in stale mode', async () => {
		const cacheRoot = await createCacheRoot('media-cache-script-');
		await writeCacheEntry(cacheRoot, 'tmdb/find/tt0371746.json', '2026-06-20T00:00:00.000Z');
		await writeCacheEntry(cacheRoot, 'tmdb/videos/tt0371746.json', '2026-06-10T00:00:00.000Z');
		const requests = [
			{ cachePath: 'tmdb/find/tt0371746.json' },
			{ cachePath: 'tmdb/videos/tt0371746.json' },
			{ cachePath: 'omdb/titles/tt0371746.json' }
		];

		const selected = await selectRequestsToFetch(requests, cacheRoot, {
			mode: 'stale',
			now: new Date('2026-06-24T00:00:00.000Z'),
			maxAgeDays: 7
		});

		expect(selected.map((request) => request.cachePath)).toEqual([
			'tmdb/videos/tt0371746.json',
			'omdb/titles/tt0371746.json'
		]);
	});

	it('detects direct CLI execution from Windows paths', () => {
		expect(isCliEntry('file:///I:/marvel/scripts/media-cache.mjs', 'I:\\marvel\\scripts\\media-cache.mjs')).toBe(true);
	});

	it('resolves the tv id, not the movie id, for a series item when find returns both', async () => {
		const cacheRoot = await createCacheRoot('media-cache-script-');
		const itemsPath = join(cacheRoot, 'items.ts');
		const envPath = join(cacheRoot, '.env');
		await writeItemsFile(itemsPath, 'daredevil-season-1', 'series', 'tt3322312');
		await writeFile(envPath, 'TMDB_API_KEY=test-key\n', 'utf-8');
		await writeFindCache(cacheRoot, 'tt3322312', {
			movie_results: [{ id: 1747255 }],
			tv_results: [{ id: 61889 }]
		});
		const calledUrls: string[] = [];
		const fetchImpl: typeof fetch = async (input) => {
			calledUrls.push(String(input));
			return new Response(JSON.stringify({}), { status: 200 });
		};

		await runMediaCacheRefresh({
			mode: 'missing',
			cacheRoot,
			itemsPath,
			envPath,
			now: new Date('2026-06-24T00:00:00.000Z'),
			fetchImpl
		});

		const seasonUrl = calledUrls.find((url) => url.includes('/season/1'));
		expect(seasonUrl).toContain('/tv/61889/season/1');
	});

	it('reports a 404 on an unaired TMDB season and its videos as a skip, not a failure', async () => {
		const cacheRoot = await createCacheRoot('media-cache-script-');
		const itemsPath = join(cacheRoot, 'items.ts');
		const envPath = join(cacheRoot, '.env');
		await writeItemsFile(itemsPath, 'daredevil-born-again-season-3', 'series', 'tt18923754');
		await writeFile(envPath, 'TMDB_API_KEY=test-key\n', 'utf-8');
		await writeFindCache(cacheRoot, 'tt18923754', { movie_results: [], tv_results: [{ id: 202555 }] });
		const fetchImpl = async () => new Response('Not Found', { status: 404 });
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (message: string) => logs.push(message);

		let results;
		try {
			results = await runMediaCacheRefresh({
				mode: 'missing',
				cacheRoot,
				itemsPath,
				envPath,
				now: new Date('2026-06-24T00:00:00.000Z'),
				fetchImpl
			});
		} finally {
			console.log = originalLog;
		}

		expect(results.fetched).toBe(0);
		expect(results.failed).toBe(0);
		expect(
			logs.some((line) => line.includes('tmdb/season/tt18923754-s3.json') && line.includes('season not on TMDB yet'))
		).toBe(true);
		expect(
			logs.some((line) => line.includes('tmdb/videos/tt18923754-s3.json') && line.includes('season not on TMDB yet'))
		).toBe(true);
	});
});
