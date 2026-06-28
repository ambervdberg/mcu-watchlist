import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildCacheRequests, isCliEntry, selectRequestsToFetch } from '../../../../../../scripts/media-cache.mjs';
import { cleanupCacheRoots, createCacheRoot } from './cacheRootTestHelper';

afterEach(async () => {
	await cleanupCacheRoots();
});

async function writeCacheEntry(cacheRoot: string, path: string, updatedAt: string): Promise<void> {
	const cachePath = join(cacheRoot, path);
	await mkdir(join(cachePath, '..'), { recursive: true });
	await writeFile(cachePath, JSON.stringify({ updatedAt, body: {} }), 'utf-8');
}

describe('media cache script', () => {
	it('builds cache requests for titles, videos, OMDb titles, and series episodes', () => {
		const requests = buildCacheRequests([
			{ id: 'loki-season-2', type: 'series', imdbId: 'tt9140554' },
			{ id: 'iron-man', type: 'movie', imdbId: 'tt0371746' },
			{ id: 'iron-man-duplicate', type: 'movie', imdbId: 'tt0371746' }
		]);

		expect(requests.map((request) => request.cachePath).sort()).toEqual([
			'imdbapi.dev/episodes/tt9140554-s2.json',
			'imdbapi.dev/titles/tt0371746.json',
			'imdbapi.dev/titles/tt9140554.json',
			'imdbapi.dev/videos/tt0371746.json',
			'imdbapi.dev/videos/tt9140554.json',
			'omdb/titles/tt0371746.json',
			'omdb/titles/tt9140554.json'
		]);
	});

	it('selects only missing cache files in missing mode', async () => {
		const cacheRoot = await createCacheRoot('media-cache-script-');
		await writeCacheEntry(cacheRoot, 'imdbapi.dev/titles/tt0371746.json', '2026-06-24T00:00:00.000Z');
		const requests = [
			{ cachePath: 'imdbapi.dev/titles/tt0371746.json' },
			{ cachePath: 'imdbapi.dev/videos/tt0371746.json' }
		];

		const selected = await selectRequestsToFetch(requests, cacheRoot, {
			mode: 'missing',
			now: new Date('2026-06-24T00:00:00.000Z'),
			maxAgeDays: 7
		});

		expect(selected.map((request) => request.cachePath)).toEqual(['imdbapi.dev/videos/tt0371746.json']);
	});

	it('selects missing and week-old cache files in stale mode', async () => {
		const cacheRoot = await createCacheRoot('media-cache-script-');
		await writeCacheEntry(cacheRoot, 'imdbapi.dev/titles/tt0371746.json', '2026-06-20T00:00:00.000Z');
		await writeCacheEntry(cacheRoot, 'imdbapi.dev/videos/tt0371746.json', '2026-06-10T00:00:00.000Z');
		const requests = [
			{ cachePath: 'imdbapi.dev/titles/tt0371746.json' },
			{ cachePath: 'imdbapi.dev/videos/tt0371746.json' },
			{ cachePath: 'omdb/titles/tt0371746.json' }
		];

		const selected = await selectRequestsToFetch(requests, cacheRoot, {
			mode: 'stale',
			now: new Date('2026-06-24T00:00:00.000Z'),
			maxAgeDays: 7
		});

		expect(selected.map((request) => request.cachePath)).toEqual([
			'imdbapi.dev/videos/tt0371746.json',
			'omdb/titles/tt0371746.json'
		]);
	});

	it('detects direct CLI execution from Windows paths', () => {
		expect(isCliEntry('file:///I:/marvel/scripts/media-cache.mjs', 'I:\\marvel\\scripts\\media-cache.mjs')).toBe(true);
	});
});
