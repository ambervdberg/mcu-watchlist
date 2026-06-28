/**
 * Shared test utilities for temp-directory lifecycle management.
 *
 * Each test file that needs isolated on-disk cache state should:
 *   1. Call createCacheRoot(prefix?) inside the test (or in beforeEach) to get a fresh dir.
 *   2. Call cleanupCacheRoots() inside its own afterEach alongside any per-file vi calls
 *      (vi.restoreAllMocks, vi.unstubAllEnvs, etc.) which must stay local to each file.
 *
 * Only the temp-directory creation and cleanup are shared here. No vi utilities.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Registry of all temp dirs created in the current test run; drained by cleanupCacheRoots(). */
const cacheRoots: string[] = [];

/**
 * Creates a new unique temp directory under os.tmpdir() with the given mkdtemp prefix,
 * registers it for automatic removal, and returns the absolute path.
 *
 * @param prefix - mkdtemp prefix string (default: 'media-cache-').
 *   Pass the original per-file prefix to preserve naming intent across files, e.g.
 *   'episode-info-cache-' or 'title-info-cache-'.
 */
export async function createCacheRoot(prefix = 'media-cache-'): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), prefix));

	cacheRoots.push(root);

	return root;
}

/**
 * Removes all registered temp directories in parallel and resets the registry.
 * Call this inside each test file's afterEach, alongside any per-file vi cleanup.
 */
export async function cleanupCacheRoots(): Promise<void> {
	await Promise.all(cacheRoots.map((root) => rm(root, { recursive: true, force: true })));

	cacheRoots.length = 0;
}
