// CLI entry point for media cache refresh.
// Fetches OMDb + imdbapi.dev metadata for catalog titles, updates titleInfo.snapshot.json.
// Usage: node scripts/media-cache.mjs [--title <id>] [--skip-fetch]
import { isCliEntry, parseArgs, runMediaCacheRefresh } from './media-cache-core.mjs';

export * from './media-cache-core.mjs';

if (isCliEntry(import.meta.url, process.argv[1])) {
	const options = parseArgs(process.argv.slice(2));
	const results = await runMediaCacheRefresh(options);

	console.log(
		`done total=${results.total} selected=${results.selected} fetched=${results.fetched} skipped=${results.skipped} failed=${results.failed}`
	);

	if (results.failed > 0) {
		process.exitCode = 1;
	}
}
