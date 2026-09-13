// Build-time runtime index: total + per-episode minutes for every catalog
// item, derived from the `episodes` and `titleInfo` Content Layer collections. Astro
// Content Layer is only readable from .astro frontmatter, so index.astro reads both
// collections and passes their data in here as plain maps.

import type { Item } from '../domain/item';
import type { ItemRuntime, RuntimeIndex } from '../domain/runtime';
import { getSeasonNumber } from './mediaMetadata/itemSeason';

/** Episode entry shape this module reads from the `episodes` collection (episodeInfoFetch.ts's Episode). */
interface EpisodeRuntimeSource {
	id: string;
	runtimeSeconds: number | null;
}

/** Season data shape this module reads from the `episodes` collection. */
interface SeasonRuntimeSource {
	episodes: readonly EpisodeRuntimeSource[];
}

/** Entry shape this module reads from the `titleInfo` collection. */
interface TitleInfoRuntimeSource {
	runtimeMinutes: number | null;
}

/**
 * Builds a RuntimeIndex for every catalog item, keyed by catalog item id.
 *
 * `episodesByKey`/`titleInfoByKey` are the `episodes`/`titleInfo` Content Layer
 * collections, keyed the same way their loaders key them (`imdbId-s{season}` for a
 * series season, `imdbId` for a movie/short/special's titleInfo entry, per
 * titleInfoLoader.ts). A missing entry, or one holding a null runtime, leaves that
 * item's totalMinutes at 0 rather than throwing.
 */
export function buildRuntimeIndex(
	items: readonly Item[],
	episodesByKey: ReadonlyMap<string, SeasonRuntimeSource>,
	titleInfoByKey: ReadonlyMap<string, TitleInfoRuntimeSource>
): RuntimeIndex {
	const runtimeIndex: RuntimeIndex = {};

	for (const item of items) {
		runtimeIndex[item.id] =
			item.type === 'series' ? seriesRuntimeFor(item, episodesByKey) : singleRuntimeFor(item, titleInfoByKey);
	}

	return runtimeIndex;
}

/**
 * Series runtime: total minutes is the season's summed runtimeSeconds converted to
 * minutes, episodeMinutes holds each episode's own minutes independently rounded.
 * A missing season entry yields a zeroed ItemRuntime.
 */
function seriesRuntimeFor(item: Item, episodesByKey: ReadonlyMap<string, SeasonRuntimeSource>): ItemRuntime {
	const seasonKey = `${item.imdbId}-s${getSeasonNumber(item.id)}`;
	const season = episodesByKey.get(seasonKey);

	if (!season) {
		return { totalMinutes: 0, episodeMinutes: {} };
	}

	const episodeMinutes: Record<string, number> = {};
	let totalSeconds = 0;

	for (const episode of season.episodes) {
		episodeMinutes[episode.id] = episode.runtimeSeconds === null ? 0 : Math.round(episode.runtimeSeconds / 60);
		totalSeconds += episode.runtimeSeconds ?? 0;
	}

	return { totalMinutes: Math.round(totalSeconds / 60), episodeMinutes };
}

/**
 * Non-series runtime: the catalog item's own runtimeMinutes when set, otherwise the
 * `titleInfo` collection's runtimeMinutes. Non-series items have no episodes.
 */
function singleRuntimeFor(item: Item, titleInfoByKey: ReadonlyMap<string, TitleInfoRuntimeSource>): ItemRuntime {
	if (item.runtimeMinutes !== undefined) {
		return { totalMinutes: item.runtimeMinutes, episodeMinutes: {} };
	}

	const totalMinutes = titleInfoByKey.get(item.imdbId)?.runtimeMinutes ?? 0;

	return { totalMinutes, episodeMinutes: {} };
}
