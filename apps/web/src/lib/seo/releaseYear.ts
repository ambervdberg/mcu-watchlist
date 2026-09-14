// Release year for a title page's <title> tag: the baked titleInfo's real release date when
// there is one, else the catalog's own `timeline` field.

/** OMDb's sentinel for "no value", same convention as titleInfoFields.ts. */
function isMissingText(value: string | undefined): value is undefined {
	return !value || value === 'N/A';
}

/** First AD year in `released` (OMDb date), else in `timeline`. Null when neither has one (BC only). */
export function extractReleaseYear(released: string | undefined, timeline: string): string | null {
	if (!isMissingText(released)) {
		const year = firstAdYear(released);
		if (year) {
			return year;
		}
	}

	return firstAdYear(timeline);
}

/** First 4-digit year in `text` not immediately followed by "BC". */
function firstAdYear(text: string): string | null {
	const match = new RegExp(/\b(\d{4})\b(?!\s*BC)/).exec(text);
	return match ? match[1] : null;
}
