import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type RawCacheDescriptor = {
	source: 'imdbapi.dev' | 'omdb';
	endpoint: 'titles' | 'videos' | 'episodes';
	key: string;
};

export type RawCacheEntry<TBody> = RawCacheDescriptor & {
	updatedAt: string;
	status: number;
	body: TBody;
};

/**
 * Cache-root and refresh overrides accepted by the public fetch functions in
 * episodeInfoFetch.ts and titleInfoFetch.ts. Defined here -- next to
 * {@link RawCacheDescriptor} and {@link fetchJsonWithRawCache} -- so both fetchers
 * share one canonical type instead of each maintaining an identical private copy.
 */
export type RawFetchOptions = {
	/** Overrides the default `.media-cache` directory; useful in tests for isolation. */
	cacheRoot?: string;
	/** When true, bypasses cached data and forces a fresh upstream fetch. */
	refreshRawCache?: boolean;
};

type FetchJsonWithRawCacheOptions = {
	descriptor: RawCacheDescriptor;
	url: string;
	cacheRoot?: string;
	refresh?: boolean;
	fetchImpl?: typeof fetch;
	now?: () => Date;
};

const defaultCacheRoot = fileURLToPath(new URL('../../../../.media-cache', import.meta.url));

/** Reads a cached raw provider response, returning null when absent or invalid. */
export async function readRawCache<TBody>(
	descriptor: RawCacheDescriptor,
	cacheRoot = defaultCacheRoot
): Promise<RawCacheEntry<TBody> | null> {
	try {
		const raw = await readFile(rawCachePath(descriptor, cacheRoot), 'utf-8');

		return JSON.parse(raw) as RawCacheEntry<TBody>;
	} catch {
		return null;
	}
}

/** Writes a full raw provider response with refresh metadata. */
export async function writeRawCache<TBody>(
	descriptor: RawCacheDescriptor,
	status: number,
	body: TBody,
	cacheRoot = defaultCacheRoot,
	now = new Date()
): Promise<void> {
	const cachePath = rawCachePath(descriptor, cacheRoot);
	const entry: RawCacheEntry<TBody> = {
		updatedAt: now.toISOString(),
		...descriptor,
		status,
		body
	};

	await mkdir(dirname(cachePath), { recursive: true });
	await writeFile(cachePath, JSON.stringify(entry, null, '\t') + '\n', 'utf-8');
}

/** Reads cached JSON first, or fetches and stores fresh JSON when needed. */
export async function fetchJsonWithRawCache<TBody>({
	descriptor,
	url,
	cacheRoot = defaultCacheRoot,
	refresh = shouldRefreshRawCache(),
	fetchImpl = fetch,
	now = () => new Date()
}: FetchJsonWithRawCacheOptions): Promise<TBody | null> {
	if (!refresh) {
		const cached = await readRawCache<TBody>(descriptor, cacheRoot);

		if (cached) {
			return cached.body;
		}
	}

	const response = await fetchImpl(url);

	if (!response.ok) {
		return null;
	}

	const body = (await response.json()) as TBody;
	await writeRawCache(descriptor, response.status, body, cacheRoot, now());

	return body;
}

/** Returns true when a build should overwrite raw provider cache files. */
export function shouldRefreshRawCache(): boolean {
	return import.meta.env.REFRESH_MEDIA_CACHE === '1' || process.env.REFRESH_MEDIA_CACHE === '1';
}

function rawCachePath(descriptor: RawCacheDescriptor, cacheRoot: string): string {
	return join(cacheRoot, descriptor.source, descriptor.endpoint, `${safeCacheKey(descriptor.key)}.json`);
}

function safeCacheKey(key: string): string {
	return key.replace(new RegExp('[^a-zA-Z0-9._-]', 'g'), '_');
}
