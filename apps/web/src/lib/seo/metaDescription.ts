// Meta description text for a title page: `lead` (title plus keywords) followed by the baked OMDb
// plot when there is a real one, trimmed to a search-snippet length, else a caller-supplied fallback.

const MAX_LENGTH = 155;

/** `lead` plus a plot snippet, or `fallback` when `plot` is missing/OMDb's 'N/A'. */
export function buildTitleMetaDescription(lead: string, plot: string | undefined, fallback: string): string {
	if (isMissingText(plot)) {
		return fallback;
	}

	const snippetLength = MAX_LENGTH - lead.length - 1;

	return `${lead} ${truncateAtBoundary(plot, snippetLength)}`;
}

/** OMDb's sentinel for "no value", same convention as titleInfoFields.ts. */
function isMissingText(value: string | undefined): value is undefined {
	return !value || value === 'N/A';
}

/** Cuts `text` to at most `maxLength` chars, breaking at a sentence end or a word boundary. */
function truncateAtBoundary(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	const window = text.slice(0, maxLength);
	const sentenceEnd = lastSentenceEnd(window);
	if (sentenceEnd !== -1) {
		return window.slice(0, sentenceEnd + 1);
	}

	const wordBoundary = window.lastIndexOf(' ');
	const wordCut = wordBoundary === -1 ? window : window.slice(0, wordBoundary);

	return `${wordCut.trimEnd()}…`;
}

/** Index of the last '.', '!' or '?' in `text`, or -1 when none. */
function lastSentenceEnd(text: string): number {
	return Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
}
