import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** @typedef {'imdbapi.dev' | 'omdb'} CacheSource */
/** @typedef {'titles' | 'videos' | 'episodes'} CacheEndpoint */
/** @typedef {'missing' | 'stale'} CacheRefreshMode */
/** @typedef {{ id: string, type: string, imdbId: string }} CatalogItem */
/** @typedef {{ source: CacheSource, endpoint: CacheEndpoint, key: string, cachePath: string }} CacheRequest */
/** @typedef {{ mode: CacheRefreshMode, now: Date, maxAgeDays: number }} CacheSelectionOptions */
/** @typedef {{ total: number, selected: number, fetched: number, skipped: number, failed: number }} CacheRefreshResults */
/** @typedef {{ mode: CacheRefreshMode, cacheRoot?: string, itemsPath?: string, envPath?: string, now?: Date, maxAgeDays?: number, dryRun?: boolean, fetchImpl?: typeof fetch }} CacheRefreshOptions */
/** @typedef {{ mode: CacheRefreshMode, dryRun: boolean, maxAgeDays: number }} CliOptions */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const WEB_ROOT = join(REPO_ROOT, 'apps', 'web');
const DEFAULT_CACHE_ROOT = join(WEB_ROOT, '.media-cache');
const DEFAULT_ITEMS_PATH = join(WEB_ROOT, 'src', 'lib', 'data', 'items.ts');
const DEFAULT_ENV_PATH = join(WEB_ROOT, '.env');
const DEFAULT_MAX_AGE_DAYS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Builds all raw cache requests expected by the catalog.
 * @param {CatalogItem[]} items
 * @returns {CacheRequest[]}
 */
export function buildCacheRequests(items) {
	/** @type {Map<string, CacheRequest>} */
	const requests = new Map();

	for (const item of items) {
		if (!item.imdbId) {
			continue;
		}

		addRequest(requests, createRequest('imdbapi.dev', 'titles', item.imdbId));
		addRequest(requests, createRequest('imdbapi.dev', 'videos', item.imdbId));
		addRequest(requests, createRequest('omdb', 'titles', item.imdbId));

		if (item.type === 'series') {
			const season = getSeasonNumber(item.id);
			addRequest(requests, createRequest('imdbapi.dev', 'episodes', `${item.imdbId}-s${season}`));
		}
	}

	return [...requests.values()];
}

/**
 * Selects requests that should hit network for current refresh mode.
 * @template {Pick<CacheRequest, 'cachePath'>} TRequest
 * @param {TRequest[]} requests
 * @param {string} cacheRoot
 * @param {CacheSelectionOptions} options
 * @returns {Promise<TRequest[]>}
 */
export async function selectRequestsToFetch(requests, cacheRoot, options) {
	/** @type {TRequest[]} */
	const selected = [];

	for (const request of requests) {
		const cachePath = join(cacheRoot, request.cachePath);

		if (options.mode === 'missing') {
			if (!existsSync(cachePath)) {
				selected.push(request);
			}

			continue;
		}

		if (await isMissingOrStale(cachePath, options.now, options.maxAgeDays)) {
			selected.push(request);
		}
	}

	return selected;
}

/**
 * Reads simple KEY=value env files without exposing values in logs.
 * @param {string} path
 * @returns {Promise<Record<string, string>>}
 */
export async function readEnvFile(path) {
	try {
		const raw = await readFile(path, 'utf-8');

		/** @type {Record<string, string>} */
		const env = {};

		for (const line of raw.split(/\r?\n/)) {
			const entry = parseEnvLine(line);

			if (entry) {
				env[entry[0]] = entry[1];
			}
		}

		return env;
	} catch {
		return {};
	}
}

/**
 * Runs cache retrieval for missing or stale raw provider responses.
 * @param {CacheRefreshOptions} options
 * @returns {Promise<CacheRefreshResults>}
 */
export async function runMediaCacheRefresh({
	mode,
	cacheRoot = DEFAULT_CACHE_ROOT,
	itemsPath = DEFAULT_ITEMS_PATH,
	envPath = DEFAULT_ENV_PATH,
	now = new Date(),
	maxAgeDays = DEFAULT_MAX_AGE_DAYS,
	dryRun = false,
	fetchImpl = fetch
}) {
	const items = parseCatalogItems(await readFile(itemsPath, 'utf-8'));
	const requests = buildCacheRequests(items);
	const selected = await selectRequestsToFetch(requests, cacheRoot, { mode, now, maxAgeDays });
	const env = { ...(await readEnvFile(envPath)), ...process.env };
	/** @type {CacheRefreshResults} */
	const results = { total: requests.length, selected: selected.length, fetched: 0, skipped: 0, failed: 0 };

	for (const request of selected) {
		const url = createRequestUrl(request, env.OMDB_API_KEY);

		if (!url) {
			results.skipped += 1;
			console.log(`skip ${request.cachePath} missing OMDB_API_KEY`);
			continue;
		}

		if (dryRun) {
			console.log(`would fetch ${request.cachePath}`);
			continue;
		}

		const ok = await fetchAndWriteRequest(request, url, cacheRoot, fetchImpl, now);

		if (ok) {
			results.fetched += 1;
		} else {
			results.failed += 1;
		}
	}

	return results;
}

/**
 * Returns true when this module is the direct Node CLI entry.
 * @param {string} moduleUrl
 * @param {string | undefined} scriptPath
 * @returns {boolean}
 */
export function isCliEntry(moduleUrl, scriptPath) {
	if (!scriptPath) {
		return false;
	}

	return moduleUrl === pathToFileURL(scriptPath).href;
}

/**
 * Parses catalog item fields needed for cache inventory.
 * @param {string} raw
 * @returns {CatalogItem[]}
 */
export function parseCatalogItems(raw) {
	const body = raw.slice(raw.indexOf('[') + 1, raw.lastIndexOf(']'));
	const itemBlocks = body.match(/\{[\s\S]*?\}/g) ?? [];

	return itemBlocks.map((block) => ({
		id: readStringProperty(block, 'id'),
		type: readStringProperty(block, 'type'),
		imdbId: readStringProperty(block, 'imdbId')
	}));
}

/**
 * Parses CLI arguments for the cache script.
 * @param {string[]} args
 * @returns {CliOptions}
 */
export function parseArgs(args) {
	const mode = args[0];

	if (mode !== 'missing' && mode !== 'stale') {
		throw new Error('Usage: node scripts/media-cache.mjs missing|stale [--dry-run] [--max-age-days=7]');
	}

	const maxAgeArg = args.find((arg) => arg.startsWith('--max-age-days='));

	return {
		mode,
		dryRun: args.includes('--dry-run'),
		maxAgeDays: maxAgeArg ? Number(maxAgeArg.split('=')[1]) : DEFAULT_MAX_AGE_DAYS
	};
}

/**
 * Fetches one provider request and writes the raw cache entry.
 * @param {CacheRequest} request
 * @param {string} url
 * @param {string} cacheRoot
 * @param {typeof fetch} fetchImpl
 * @param {Date} now
 * @returns {Promise<boolean>}
 */
async function fetchAndWriteRequest(request, url, cacheRoot, fetchImpl, now) {
	try {
		const response = await fetchImpl(url);

		if (!response.ok) {
			console.log(`fail ${request.cachePath} HTTP ${response.status}`);
			return false;
		}

		const body = await response.json();
		const entry = {
			updatedAt: now.toISOString(),
			source: request.source,
			endpoint: request.endpoint,
			key: request.key,
			status: response.status,
			body
		};
		const cachePath = join(cacheRoot, request.cachePath);

		await mkdir(dirname(cachePath), { recursive: true });
		await writeFile(cachePath, JSON.stringify(entry, null, '\t') + '\n', 'utf-8');
		console.log(`fetch ${request.cachePath}`);

		return true;
	} catch (error) {
		console.log(`fail ${request.cachePath} ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
}

/**
 * Returns true when a cache path is absent, invalid, or older than the limit.
 * @param {string} cachePath
 * @param {Date} now
 * @param {number} maxAgeDays
 * @returns {Promise<boolean>}
 */
async function isMissingOrStale(cachePath, now, maxAgeDays) {
	try {
		const raw = await readFile(cachePath, 'utf-8');
		const cacheEntry = JSON.parse(raw);
		const updatedAt = new Date(cacheEntry.updatedAt);

		if (Number.isNaN(updatedAt.getTime())) {
			return true;
		}

		return now.getTime() - updatedAt.getTime() >= maxAgeDays * ONE_DAY_MS;
	} catch {
		return true;
	}
}

/**
 * Adds a request keyed by cache path to dedupe repeated IMDb IDs.
 * @param {Map<string, CacheRequest>} requests
 * @param {CacheRequest} request
 */
function addRequest(requests, request) {
	requests.set(request.cachePath, request);
}

/**
 * Creates a normalized raw cache request descriptor.
 * @param {CacheSource} source
 * @param {CacheEndpoint} endpoint
 * @param {string} key
 * @returns {CacheRequest}
 */
function createRequest(source, endpoint, key) {
	return {
		source,
		endpoint,
		key,
		cachePath: `${source}/${endpoint}/${safeCacheKey(key)}.json`
	};
}

/**
 * Converts a cache request into its upstream URL.
 * @param {CacheRequest} request
 * @param {string | undefined} omdbApiKey
 * @returns {string | null}
 */
function createRequestUrl(request, omdbApiKey) {
	if (request.source === 'omdb') {
		if (!omdbApiKey) {
			return null;
		}

		return `https://www.omdbapi.com/?i=${request.key}&apikey=${omdbApiKey}&plot=full`;
	}

	if (request.endpoint === 'episodes') {
		const { imdbId, season } = parseEpisodeKey(request.key);

		return `https://api.imdbapi.dev/titles/${imdbId}/episodes?season=${season}`;
	}

	return `https://api.imdbapi.dev/titles/${request.key}${request.endpoint === 'videos' ? '/videos' : ''}`;
}

/**
 * Extracts the season suffix from an item id.
 * @param {string} itemId
 * @returns {string}
 */
function getSeasonNumber(itemId) {
	return /-season-(\d+)$/.exec(itemId)?.[1] ?? '1';
}

/**
 * Splits an episode cache key into title id and season.
 * @param {string} key
 * @returns {{ imdbId: string, season: string }}
 */
function parseEpisodeKey(key) {
	const match = /^(tt\d+)-s(\d+)$/.exec(key);

	if (!match) {
		throw new Error(`Invalid episode cache key: ${key}`);
	}

	return { imdbId: match[1], season: match[2] };
}

/**
 * Reads one string property from an item block.
 * @param {string} block
 * @param {string} propertyName
 * @returns {string}
 */
function readStringProperty(block, propertyName) {
	return new RegExp(String.raw`${propertyName}:\s*'([^']*)'`).exec(block)?.[1] ?? '';
}

/**
 * Makes a cache key safe for file names.
 * @param {string} key
 * @returns {string}
 */
function safeCacheKey(key) {
	return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Parses one env file line.
 * @param {string} line
 * @returns {[string, string] | null}
 */
function parseEnvLine(line) {
	const trimmedLine = line.trim();

	if (!trimmedLine || trimmedLine.startsWith('#')) {
		return null;
	}

	const separatorIndex = trimmedLine.indexOf('=');

	if (separatorIndex === -1) {
		return [trimmedLine, ''];
	}

	const key = trimmedLine.slice(0, separatorIndex).trim();
	const value = trimmedLine
		.slice(separatorIndex + 1)
		.trim()
		.replace(/^["']|["']$/g, '');

	return [key, value];
}
