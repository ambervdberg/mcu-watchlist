// Astro Content Layer custom loader for the `episodes` collection (see
// content.config.ts). Iterates apps/web/src/lib/data/items.ts and fetches the per-season
// episode list from TMDB for every series item, via episodeInfoFetch.ts.
//
// Movies/shorts/specials have no episodes and are skipped entirely. Per-item upstream
// failures (missing TMDB_API_KEY, network error, unreleased season with no data yet)
// never fail the build: snapshot.ts's withSnapshotFallback falls back to the
// last-known-good value in the committed episodeInfo.snapshot.json, and a successful
// fetch is merged over that prior value (see episodeInfoFetch.ts's mergeEpisodeInfoWithPrior)
// before being written back -- see titleInfoLoader.ts's file doc for the same mechanism
// applied to title-info.
//
// Keyed by `imdbId-s{season}`, matching apps/api/src/media/episodeInfoStore.ts's
// existing rowKeyFor scheme.
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';
import { items } from '../items';
import { getSeasonNumber } from './itemSeason';
import { mapWithConcurrencyLimit } from './concurrencyLimit';
import { readSnapshot, withSnapshotFallback, writeSnapshot } from './snapshot';
import { fetchEpisodeInfoFromTmdb, mergeEpisodeInfoWithPrior, type EpisodeInfo } from './episodeInfoFetch';

// See concurrencyLimit.ts's file doc for why this is a hand-rolled limiter, and
// titleInfoLoader.ts for why the same cap value is used for both loaders.
const MAX_CONCURRENT_REQUESTS = 5;

const snapshotPath = fileURLToPath(new URL('./episodeInfo.snapshot.json', import.meta.url));

/** The snapshot/collection key for a series item: `imdbId-s{season}`. */
function episodeInfoKeyFor(item: (typeof items)[number]): string {
	return `${item.imdbId}-s${getSeasonNumber(item.id)}`;
}

/** Astro Content Layer loader that bakes per-season episode lists for every series item. */
export function episodeInfoLoader(): Loader {
	return {
		name: 'episode-info-loader',
		load: async ({ store, logger, parseData }) => {
			const snapshot = await readSnapshot<EpisodeInfo>(snapshotPath);
			const seriesItems = items.filter((item) => item.type === 'series');

			store.clear();

			await mapWithConcurrencyLimit(seriesItems, MAX_CONCURRENT_REQUESTS, async (item) => {
				const key = episodeInfoKeyFor(item);
				const season = String(getSeasonNumber(item.id));
				const priorEntry = snapshot[key];

				const live = await withSnapshotFallback(key, snapshot, () => fetchEpisodeInfoFromTmdb(item.imdbId, season));

				if (!live) {
					// Expected for an unreleased season with neither live data nor a prior
					// snapshot entry yet -- not an error, just nothing to bake for this key.
					logger.info(`No episode info available (live or snapshot) for "${key}".`);
					return;
				}

				// Field-level merge so a live episode never regresses data the snapshot already
				// had. withSnapshotFallback stored `live` as snapshot[key]; overwrite it with the
				// merged result so the on-disk snapshot keeps the best-known data.
				const episodeInfo = mergeEpisodeInfoWithPrior(live, priorEntry);
				snapshot[key] = episodeInfo;

				const parsed = await parseData({ id: key, data: episodeInfo });
				store.set({ id: key, data: parsed });
			});

			await writeSnapshot(snapshotPath, snapshot);
		}
	};
}
