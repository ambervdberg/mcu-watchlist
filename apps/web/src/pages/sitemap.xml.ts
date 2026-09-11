// Static sitemap.xml endpoint. Regenerated from the live catalog at build time (lib/seo/sitemap.ts),
// so it can never drift the way a hand-written static/sitemap.xml would (it used to list only "/").
import type { APIRoute } from 'astro';
import { items } from '../lib/data/items';
import { buildSitemapXml } from '../lib/seo/sitemap';

export const prerender = true;

/** Serves the generated sitemap.xml as application/xml. */
export const GET: APIRoute = ({ site }) => {
	if (!site) {
		throw new Error('astro.config.mjs must set `site` for sitemap.xml to know its base URL.');
	}

	return new Response(buildSitemapXml(items, site.toString()), {
		headers: { 'Content-Type': 'application/xml' }
	});
};
