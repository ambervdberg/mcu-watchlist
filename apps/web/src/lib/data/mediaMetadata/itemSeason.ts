// Shared season-number derivation, used by both Content Layer loaders and by
// apps/web/src/pages/title/[id].astro. Kept here (rather than duplicated, or left
// only in the page) since both the build-time loaders and the page need the exact
// same number to agree on cache/snapshot keys and on which trailer/episode list a
// series item's detail page renders.

/** Season number encoded in a series item's id (e.g. "loki-season-2" -> 2), default 1. */
export function getSeasonNumber(itemId: string): number {
	const match = new RegExp(/-season-(\d+)$/).exec(itemId);

	return match ? Number(match[1]) : 1;
}
