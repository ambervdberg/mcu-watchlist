// Astro Content Layer custom loader for the `titleInfo` collection (see
// content.config.ts). Iterates apps/web/src/lib/data/items.ts and fetches
// OMDb/imdbapi.dev metadata (plot, rating, poster, runtime, trailer) for every
// catalog item at build time, via titleInfoFetch.ts (a straight port of
// apps/api/src/media/titleInfoFetcher.ts — see that file's doc for why).
//
// Per-item upstream failures (missing OMDB_API_KEY, network error, rate limit) never
// fail the build: snapshot.ts's withSnapshotFallback falls back to the last-known-good
// value in the committed titleInfo.snapshot.json, and a successful fetch updates that
// snapshot in memory so it can be written back to disk (see writeSnapshot below) for
// whoever next commits a build that had real network + a key.
//
// Series share one imdbId across every season, but their trailer pick is
// season-dependent (see titleInfoFetch.ts's scoreSeasonMatch), so series items are
// keyed by `imdbId-s{season}` while movies/shorts/specials are keyed by `imdbId`
// alone — matching apps/api/src/media/titleInfoStore.ts's existing rowKeyFor scheme.
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';
import { items } from '../items';
import { getSeasonNumber } from './itemSeason';
import { mapWithConcurrencyLimit } from './concurrencyLimit';
import { readSnapshot, withSnapshotFallback, writeSnapshot } from './snapshot';
import { fetchTitleInfo, mergeTitleInfoWithPrior, type TitleInfo } from './titleInfoFetch';

// Caps how many simultaneous OMDb/imdbapi.dev requests the loader fires; see
// concurrencyLimit.ts's file doc for why no external dependency is used for this.
// Set to 1 to respect imdbapi.dev's aggressive rate limiting (~30-50 req/hour).
const MAX_CONCURRENT_REQUESTS = 1;

const snapshotPath = fileURLToPath(new URL('./titleInfo.snapshot.json', import.meta.url));

/** The snapshot/collection key for a catalog item: `imdbId`, or `imdbId-s{season}` for series. */
function titleInfoKeyFor(item: (typeof items)[number]): string {
	return item.type === 'series' ? `${item.imdbId}-s${getSeasonNumber(item.id)}` : item.imdbId;
}

/** Astro Content Layer loader that bakes title-info metadata for every catalog item. */
export function titleInfoLoader(): Loader {
	return {
		name: 'title-info-loader',
		load: async ({ store, logger, parseData }) => {
			const snapshot = await readSnapshot<TitleInfo>(snapshotPath);

			// Cleared up front (like Astro's own file()/glob() loaders do): a catalog item
			// removed from items.ts since the last run must not leave a stale entry behind.
			store.clear();

			await mapWithConcurrencyLimit(items, MAX_CONCURRENT_REQUESTS, async (item) => {
				const key = titleInfoKeyFor(item);
				const season = item.type === 'series' ? String(getSeasonNumber(item.id)) : undefined;

				// Captured before withSnapshotFallback overwrites snapshot[key], so the merge below
				// can fall back to the last-known-good values.
				const priorEntry = snapshot[key];

				// Skip the (rate-limit-prone) imdbapi.dev videos call ONLY when we already have an
				// actual trailer for this title -- trailers are immutable once published. If none is
				// cached yet (never looked up, genuinely none last time, or a prior failure), look
				// again this build. Net: an item with a trailer never re-fetches; one without keeps
				// trying until it finds one.
				const cachedTrailer = priorEntry?.trailer ? { trailer: priorEntry.trailer } : undefined;

				const live = await withSnapshotFallback(key, snapshot, async () => {
					try {
						return await fetchTitleInfo(item.imdbId, season, cachedTrailer, priorEntry);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						logger.warn(`Failed to fetch "${key}": ${message}`);
						return undefined;
					}
				});

				if (!live) {
					// No live data and no prior snapshot entry (e.g. a brand new catalog item
					// on a build with no network/key yet) -- skip rather than store a bogus entry.
					logger.warn(`No title info available (live or snapshot) for "${key}".`);
					return;
				}

				// Field-level merge so a transient OMDb sentinel (or a failed trailer lookup) never
				// regresses a previously-good value. withSnapshotFallback stored `live` as
				// snapshot[key]; overwrite it with the merged result so the on-disk snapshot keeps
				// the best-known data.
				const titleInfo = mergeTitleInfoWithPrior(live, priorEntry);
				snapshot[key] = titleInfo;

				const parsed = await parseData({ id: key, data: titleInfo });
				store.set({ id: key, data: parsed });
			});

			await writeSnapshot(snapshotPath, snapshot);
		}
	};
}
