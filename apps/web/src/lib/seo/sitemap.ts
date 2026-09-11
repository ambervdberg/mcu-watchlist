// Pure sitemap.xml builder, generated from the static catalog at build time.
// Framework-agnostic: no Astro, DOM, or fetch imports.

import type { Item } from '../domain/item';
import { homeUrl, titleUrl } from './catalogUrl';

/** Builds a sitemap.xml document: the home page plus one `<url>` per catalog item. */
export function buildSitemapXml(items: Item[], baseUrl: string): string {
	const locations = [homeUrl(baseUrl), ...items.map((item) => titleUrl(baseUrl, item.id))];
	const urlEntries = locations.map(buildUrlEntry);

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urlEntries,
		'</urlset>'
	].join('\n');
}

/** Renders one `<url>` entry for a single page location. */
function buildUrlEntry(loc: string): string {
	return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`;
}

/** Escapes XML special characters in text content. */
function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
