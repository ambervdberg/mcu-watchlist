// Committed fallback snapshots for build-time-fetched title/episode metadata.
//
// Why this exists: titleInfoLoader.ts and episodeInfoLoader.ts fetch OMDb/imdbapi.dev
// data at `astro build`/`astro dev` time. Both upstreams are third-party services that
// can be down, rate-limited, or (for OMDb) simply unconfigured (no OMDB_API_KEY) in a
// given build environment — e.g. a contributor's machine, or CI without secrets. The
// build must never hard-fail just because a trailer lookup timed out, so every loader
// falls back to the last-known-good value from these committed JSON snapshots instead
// of throwing.
//
// The snapshot files are written back to disk after every loader run (see
// writeSnapshot below), so a build that *does* have network + OMDB_API_KEY refreshes
// the committed snapshot as a side effect, ready to be committed by whoever ran that
// build (typically CI or a maintainer with the key configured locally).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Reads a JSON snapshot file, returning `{}` if it doesn't exist yet or fails to parse. */
export async function readSnapshot<TValue>(filePath: string): Promise<Record<string, TValue>> {
	try {
		const raw = await readFile(filePath, 'utf-8');

		return JSON.parse(raw) as Record<string, TValue>;
	} catch {
		return {};
	}
}

/** Writes a JSON snapshot file, creating its parent directory if needed. */
export async function writeSnapshot<TValue>(filePath: string, snapshot: Record<string, TValue>): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });

	// Sorted keys keep the diff of the committed snapshot file minimal across builds
	// (otherwise insertion order would shuffle on every regeneration for no reason).
	const sortedEntries = Object.entries(snapshot).toSorted(([a], [b]) => a.localeCompare(b));

	await writeFile(filePath, JSON.stringify(Object.fromEntries(sortedEntries), null, '\t') + '\n', 'utf-8');
}

/**
 * Runs `fetchLive` for one item; on success returns its value (and records it into
 * `snapshot` under `key` for the eventual {@link writeSnapshot} call). On failure
 * (`fetchLive` throws, or resolves to `null`/`undefined`) falls back to whatever
 * `snapshot` already has for `key`, or `null` if the snapshot has nothing either —
 * e.g. a brand new catalog item on a build with no network/key yet.
 *
 * This is the single chokepoint that guarantees the build never hard-fails on a
 * per-item upstream failure: every call site gets a value back, never a rejection.
 */
export async function withSnapshotFallback<TValue>(
	key: string,
	snapshot: Record<string, TValue>,
	fetchLive: () => Promise<TValue | null>
): Promise<TValue | null> {
	try {
		const live = await fetchLive();

		if (live !== null && live !== undefined) {
			snapshot[key] = live;

			return live;
		}
	} catch {
		// Falls through to the snapshot fallback below; upstream failures are expected
		// (missing key, rate limit, network blip) and must never fail the build.
	}

	return snapshot[key] ?? null;
}
