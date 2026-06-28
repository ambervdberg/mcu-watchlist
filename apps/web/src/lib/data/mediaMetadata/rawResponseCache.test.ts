import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJsonWithRawCache, readRawCache, writeRawCache, type RawCacheDescriptor } from './rawResponseCache';

const descriptor: RawCacheDescriptor = {
	source: 'imdbapi.dev',
	endpoint: 'titles',
	key: 'tt0371746'
};

const cacheRoots: string[] = [];

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(cacheRoots.map((root) => rm(root, { recursive: true, force: true })));
	cacheRoots.length = 0;
});

async function createCacheRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'media-cache-'));
	cacheRoots.push(root);
	return root;
}

describe('raw response cache', () => {
	it('writes full raw response bodies with update metadata', async () => {
		const cacheRoot = await createCacheRoot();
		const body = { id: 'tt0371746', nested: { value: true } };

		await writeRawCache(descriptor, 200, body, cacheRoot, new Date('2026-06-24T10:00:00.000Z'));

		const cacheEntry = await readRawCache<typeof body>(descriptor, cacheRoot);

		expect(cacheEntry).toEqual({
			updatedAt: '2026-06-24T10:00:00.000Z',
			source: 'imdbapi.dev',
			endpoint: 'titles',
			key: 'tt0371746',
			status: 200,
			body
		});
	});

	it('uses cached JSON without fetching unless refresh is requested', async () => {
		const cacheRoot = await createCacheRoot();
		await writeRawCache(descriptor, 200, { id: 'cached' }, cacheRoot, new Date('2026-06-24T10:00:00.000Z'));
		const fetchMock = vi.fn<() => Promise<Response>>();

		const body = await fetchJsonWithRawCache<{ id: string }>({
			descriptor,
			url: 'https://api.imdbapi.dev/titles/tt0371746',
			cacheRoot,
			fetchImpl: fetchMock
		});

		expect(body).toEqual({ id: 'cached' });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('overwrites cached JSON when refresh is requested', async () => {
		const cacheRoot = await createCacheRoot();
		await writeRawCache(descriptor, 200, { id: 'cached' }, cacheRoot, new Date('2026-06-24T10:00:00.000Z'));
		const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'fresh' }), { status: 200 }));

		const body = await fetchJsonWithRawCache<{ id: string }>({
			descriptor,
			url: 'https://api.imdbapi.dev/titles/tt0371746',
			cacheRoot,
			refresh: true,
			fetchImpl: fetchMock,
			now: () => new Date('2026-06-24T11:00:00.000Z')
		});

		const cacheEntry = await readRawCache<{ id: string }>(descriptor, cacheRoot);

		expect(body).toEqual({ id: 'fresh' });
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(cacheEntry?.updatedAt).toBe('2026-06-24T11:00:00.000Z');
		expect(cacheEntry?.body).toEqual({ id: 'fresh' });
	});
});
