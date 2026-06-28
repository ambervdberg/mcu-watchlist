// Tiny concurrency limiter for build-time upstream fetches (OMDb/imdbapi.dev).
// No external dependency (e.g. p-limit) is pulled in for this: the whole job is
// "never run more than N of these tasks at once", which is a handful of lines.
//
// Used by titleInfoLoader.ts and episodeInfoLoader.ts to cap how many concurrent
// HTTP requests the Content Layer loaders fire during `astro build`/`astro dev`,
// so a catalog of ~90 items doesn't open ~90 simultaneous sockets against OMDb
// and imdbapi.dev (both of which apply their own rate limiting).

/**
 * Runs `task` for every item in `items`, allowing at most `limit` tasks to be
 * in flight at once. Resolves once every task has settled (each task is
 * expected to handle its own errors internally, see {@link withFallback} in
 * snapshot.ts) — a single rejection here would otherwise abort every other
 * in-flight task via `Promise.all`.
 */
export async function mapWithConcurrencyLimit<TItem, TResult>(
	items: readonly TItem[],
	limit: number,
	task: (item: TItem, index: number) => Promise<TResult>
): Promise<TResult[]> {
	const results: TResult[] = new Array(items.length);
	let nextIndex = 0;

	async function runWorker(): Promise<void> {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			results[index] = await task(items[index], index);
		}
	}

	const workerCount = Math.min(limit, items.length);
	await Promise.all(Array.from({ length: workerCount }, runWorker));

	return results;
}
