import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** @typedef {'omdb' | 'tmdb'} CacheSource */
/** @typedef {'titles' | 'videos' | 'episodes' | 'find' | 'season'} CacheEndpoint */
/** @typedef {'missing' | 'stale'} CacheRefreshMode */
/** @typedef {{ id: string, type: string, imdbId: string }} CatalogItem */
/** @typedef {{ source: CacheSource, endpoint: CacheEndpoint, key: string, cachePath: string }} CacheRequest */
/** @typedef {{ mode: CacheRefreshMode, now: Date, maxAgeDays: number }} CacheSelectionOptions */
/** @typedef {{ total: number, selected: number, fetched: number, skipped: number, failed: number }} CacheRefreshResults */
/** @typedef {{ mode: CacheRefreshMode, cacheRoot?: string, itemsPath?: string, envPath?: string, now?: Date, maxAgeDays?: number, dryRun?: boolean, fetchImpl?: typeof fetch }} CacheRefreshOptions */
/** @typedef {{ mode: CacheRefreshMode, dryRun: boolean, maxAgeDays: number }} CliOptions */
/** @typedef {{ id: number, kind: 'movie' | 'tv' }} ResolvedTmdbId */
/** @typedef {{ omdbApiKey: string | undefined, tmdbApiKey: string | undefined }} ApiKeys */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const WEB_ROOT = join(REPO_ROOT, 'apps', 'web');
const DEFAULT_CACHE_ROOT = join(WEB_ROOT, '.media-cache');
const DEFAULT_ITEMS_PATH = join(WEB_ROOT, 'src', 'lib', 'data', 'items.ts');
const DEFAULT_ENV_PATH = join(WEB_ROOT, '.env');
const DEFAULT_MAX_AGE_DAYS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Builds all raw cache requests expected by the catalog: TMDB's imdb-id lookup ("find"),
 * OMDb's title fields, and TMDB's per-season episode list ("season") and trailer videos
 * ("videos"). A series is keyed by imdb id + season for anything season-specific; a movie
 * has no season, so its videos request is keyed by imdb id alone. TMDB's "season" and
 * "videos" requests use the imdb id here rather than the numeric TMDB id -- resolving that
 * id needs a live "find" call, which this catalog-only builder never makes -- so its output
 * describes the requests this catalog needs, not the exact on-disk cache keys the real
 * build-time loaders use once they know the resolved TMDB id.
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

		addRequest(requests, createRequest('tmdb', 'find', item.imdbId));
		addRequest(requests, createRequest('omdb', 'titles', item.imdbId));

		if (item.type === 'series') {
			const season = getSeasonNumber(item.id);
			const seasonKey = `${item.imdbId}-s${season}`;
			addRequest(requests, createRequest('omdb', 'season', seasonKey));
			addRequest(requests, createRequest('tmdb', 'season', seasonKey));
			addRequest(requests, createRequest('tmdb', 'videos', seasonKey));
		} else {
			addRequest(requests, createRequest('tmdb', 'videos', item.imdbId));
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
	const apiKeys = { omdbApiKey: env.OMDB_API_KEY, tmdbApiKey: env.TMDB_API_KEY };
	const kindByImdbId = buildKindByImdbId(items);
	const resolvedTmdbIds = await loadResolvedTmdbIds(requests, cacheRoot, kindByImdbId);
	/** @type {CacheRefreshResults} */
	const results = { total: requests.length, selected: selected.length, fetched: 0, skipped: 0, failed: 0 };

	for (const request of selected) {
		const url = createRequestUrl(request, apiKeys, resolvedTmdbIds);

		if (!url) {
			results.skipped += 1;
			console.log(`skip ${request.cachePath} ${skipReason(request, apiKeys)}`);
			continue;
		}

		if (dryRun) {
			console.log(`would fetch ${request.cachePath}`);
			continue;
		}

		const outcome = await fetchAndWriteRequest(request, url, cacheRoot, fetchImpl, now);

		if (outcome === 'fetched') {
			results.fetched += 1;
			await rememberResolvedTmdbId(request, cacheRoot, resolvedTmdbIds, kindByImdbId);
		} else if (outcome === 'skipped') {
			results.skipped += 1;
		} else {
			results.failed += 1;
		}
	}

	return results;
}

/**
 * Maps each catalog item's imdb id to the TMDB kind its "find" response should resolve to:
 * 'tv' for a series, 'movie' for anything else (movie or short). A find response can hold
 * both a movie and a tv match for one imdb id, so this is the only way to pick the right one.
 * @param {CatalogItem[]} items
 * @returns {Map<string, 'movie' | 'tv'>}
 */
function buildKindByImdbId(items) {
	const kindByImdbId = new Map();

	for (const item of items) {
		if (item.imdbId) {
			kindByImdbId.set(item.imdbId, item.type === 'series' ? 'tv' : 'movie');
		}
	}

	return kindByImdbId;
}

/**
 * Preloads already-cached TMDB id resolutions for every "find" request, so a season/videos
 * request can use one resolved on an earlier run (and so isn't part of this run's selection).
 * @param {CacheRequest[]} requests
 * @param {string} cacheRoot
 * @param {Map<string, 'movie' | 'tv'>} kindByImdbId
 * @returns {Promise<Map<string, ResolvedTmdbId>>}
 */
async function loadResolvedTmdbIds(requests, cacheRoot, kindByImdbId) {
	const findRequests = requests.filter((request) => request.source === 'tmdb' && request.endpoint === 'find');
	const resolvedIds = new Map();

	for (const request of findRequests) {
		const kind = kindByImdbId.get(request.key) ?? 'movie';
		const resolved = await readCachedTmdbId(cacheRoot, request.key, kind);

		if (resolved) {
			resolvedIds.set(request.key, resolved);
		}
	}

	return resolvedIds;
}

/**
 * Records a "find" request's freshly-fetched TMDB id so a season/videos request later in
 * the same run can use it immediately, without waiting for a second run.
 * @param {CacheRequest} request
 * @param {string} cacheRoot
 * @param {Map<string, ResolvedTmdbId>} resolvedTmdbIds
 * @param {Map<string, 'movie' | 'tv'>} kindByImdbId
 * @returns {Promise<void>}
 */
async function rememberResolvedTmdbId(request, cacheRoot, resolvedTmdbIds, kindByImdbId) {
	if (request.source !== 'tmdb' || request.endpoint !== 'find') {
		return;
	}

	const kind = kindByImdbId.get(request.key) ?? 'movie';
	const resolved = await readCachedTmdbId(cacheRoot, request.key, kind);

	if (resolved) {
		resolvedTmdbIds.set(request.key, resolved);
	}
}

/**
 * Reads a cached TMDB "find" response and extracts the id matching the requested kind.
 * A find response can hold both a movie and a tv match for one imdb id, so the caller must
 * say which kind it wants -- there is no correct way to guess from the response alone.
 * @param {string} cacheRoot
 * @param {string} imdbId
 * @param {'movie' | 'tv'} kind
 * @returns {Promise<ResolvedTmdbId | null>}
 */
async function readCachedTmdbId(cacheRoot, imdbId, kind) {
	try {
		const cachePath = join(cacheRoot, 'tmdb', 'find', `${safeCacheKey(imdbId)}.json`);
		const raw = await readFile(cachePath, 'utf-8');
		const entry = JSON.parse(raw);
		const results = kind === 'movie' ? entry.body?.movie_results : entry.body?.tv_results;
		const [match] = results ?? [];

		return match ? { id: match.id, kind } : null;
	} catch {
		return null;
	}
}

/**
 * Explains why a request has no fetchable URL yet: a missing provider key, or (TMDB
 * season/videos only) a "find" lookup that has not resolved a TMDB id yet.
 * @param {CacheRequest} request
 * @param {ApiKeys} apiKeys
 * @returns {string}
 */
function skipReason(request, apiKeys) {
	if (request.source === 'omdb') {
		return 'missing OMDB_API_KEY';
	}

	return apiKeys.tmdbApiKey ? 'TMDB id not resolved yet' : 'missing TMDB_API_KEY';
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
 * @returns {Promise<'fetched' | 'skipped' | 'failed'>}
 */
async function fetchAndWriteRequest(request, url, cacheRoot, fetchImpl, now) {
	try {
		const response = await fetchImpl(url);

		if (!response.ok) {
			if (isUnairedSeasonNotFound(request, response)) {
				console.log(`skip ${request.cachePath} season not on TMDB yet`);
				return 'skipped';
			}

			console.log(`fail ${request.cachePath} HTTP ${response.status}`);
			return 'failed';
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

		return 'fetched';
	} catch (error) {
		console.log(`fail ${request.cachePath} ${describeFetchError(error)}`);
		return 'failed';
	}
}

/**
 * True for a 404 on a season-specific TMDB "season" or "videos" request. TMDB correctly
 * 404s both endpoints for a season that has not aired yet, so that is an expected gap, not
 * a failure worth surfacing alongside real errors.
 * @param {CacheRequest} request
 * @param {Response} response
 * @returns {boolean}
 */
function isUnairedSeasonNotFound(request, response) {
	const isSeasonRequest = request.source === 'tmdb' && (request.endpoint === 'season' || request.endpoint === 'videos');

	return response.status === 404 && isSeasonRequest && /-s\d+$/.test(request.key);
}

/**
 * Describes a fetch failure with its underlying error code (e.g. ENOTFOUND) when Node's
 * fetch attaches one via `error.cause`, so a dead host reads clearly instead of a bare
 * "fetch failed".
 * @param {unknown} error
 * @returns {string}
 */
function describeFetchError(error) {
	const message = error instanceof Error ? error.message : String(error);
	const cause = error instanceof Error ? error.cause : undefined;
	const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;

	return code ? `${message} (${code})` : message;
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
 * Converts a cache request into its upstream URL. TMDB's "season" and "videos" requests
 * need the resolved numeric TMDB id, looked up from `resolvedTmdbIds` -- null when a
 * provider key is missing, or that id has not been resolved by a "find" request yet.
 * @param {CacheRequest} request
 * @param {ApiKeys} apiKeys
 * @param {Map<string, ResolvedTmdbId>} resolvedTmdbIds
 * @returns {string | null}
 */
function createRequestUrl(request, apiKeys, resolvedTmdbIds) {
	if (request.source === 'omdb') {
		return apiKeys.omdbApiKey ? createOmdbUrl(request, apiKeys.omdbApiKey) : null;
	}

	return apiKeys.tmdbApiKey ? createTmdbUrl(request, apiKeys.tmdbApiKey, resolvedTmdbIds) : null;
}

/**
 * Builds an OMDb URL: the title-level lookup, or the by-season episode list.
 * @param {CacheRequest} request
 * @param {string} omdbApiKey
 * @returns {string}
 */
function createOmdbUrl(request, omdbApiKey) {
	if (request.endpoint === 'season') {
		const { imdbId, season } = parseSeasonKey(request.key);

		return `https://www.omdbapi.com/?i=${imdbId}&Season=${season}&apikey=${omdbApiKey}`;
	}

	return `https://www.omdbapi.com/?i=${request.key}&apikey=${omdbApiKey}&plot=full`;
}

/**
 * Builds a TMDB URL: the imdb-id lookup, or (once resolved) the season episode list / videos.
 * Null when the request's TMDB id has not been resolved by a "find" request yet.
 * @param {CacheRequest} request
 * @param {string} tmdbApiKey
 * @param {Map<string, ResolvedTmdbId>} resolvedTmdbIds
 * @returns {string | null}
 */
function createTmdbUrl(request, tmdbApiKey, resolvedTmdbIds) {
	if (request.endpoint === 'find') {
		return `https://api.themoviedb.org/3/find/${request.key}?external_source=imdb_id&api_key=${tmdbApiKey}`;
	}

	const { imdbId, season } = parseSeasonKey(request.key, { seasonOptional: true });
	const resolved = resolvedTmdbIds.get(imdbId);

	if (!resolved) {
		return null;
	}

	if (request.endpoint === 'season') {
		return `https://api.themoviedb.org/3/tv/${resolved.id}/season/${season}?api_key=${tmdbApiKey}`;
	}

	const path = resolved.kind === 'movie' ? `movie/${resolved.id}` : `tv/${resolved.id}/season/${season ?? '1'}`;

	return `https://api.themoviedb.org/3/${path}/videos?api_key=${tmdbApiKey}`;
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
 * Splits a "imdbId-sSeason" cache key into its parts. A movie's TMDB videos key has no
 * season suffix (just "imdbId"); pass `seasonOptional` to accept that shape too.
 * @param {string} key
 * @param {{ seasonOptional?: boolean }} [options]
 * @returns {{ imdbId: string, season: string | undefined }}
 */
function parseSeasonKey(key, options = {}) {
	const seasonMatch = /^(tt\d+)-s(\d+)$/.exec(key);

	if (seasonMatch) {
		return { imdbId: seasonMatch[1], season: seasonMatch[2] };
	}

	if (options.seasonOptional && /^tt\d+$/.test(key)) {
		return { imdbId: key, season: undefined };
	}

	throw new Error(`Invalid season cache key: ${key}`);
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
