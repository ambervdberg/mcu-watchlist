// Static sitemap.xml endpoint. Regenerated from the live catalog at build time (lib/seo/sitemap.ts),
// so it can never drift the way a hand-written static/sitemap.xml would (it used to list only "/").
import type { APIRoute } from 'astro';
import { items } from '../lib/data/items';
import { buildSitemapXml } from '../lib/seo/sitemap';
import { requireSiteUrl } from '../lib/seo/siteUrl';

export const prerender = true;

/** Serves the generated sitemap.xml as application/xml. */
export const GET: APIRoute = ({ site }) => {
	const siteUrl = requireSiteUrl(site);

	return new Response(buildSitemapXml(items, siteUrl.toString()), {
		headers: { 'Content-Type': 'application/xml' }
	});
};
