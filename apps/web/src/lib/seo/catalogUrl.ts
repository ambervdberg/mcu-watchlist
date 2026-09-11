// Shared catalog URL builder. Used by the sitemap, llms.txt, and JSON-LD builders so every
// page-location string is joined from a base URL the same way in one place.

/** Builds the canonical home page URL for `baseUrl`, always with a trailing slash. */
export function homeUrl(baseUrl: string): string {
	return `${trimTrailingSlash(baseUrl)}/`;
}

/** Builds the canonical `/title/<id>/` URL for a catalog item under `baseUrl`. */
export function titleUrl(baseUrl: string, id: string): string {
	return `${trimTrailingSlash(baseUrl)}/title/${id}/`;
}

/** Removes a trailing slash from a base URL, so joins never double it up. */
function trimTrailingSlash(url: string): string {
	return url.endsWith('/') ? url.slice(0, -1) : url;
}
