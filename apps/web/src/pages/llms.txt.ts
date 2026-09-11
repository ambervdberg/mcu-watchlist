// Static llms.txt endpoint (llmstxt.org format), regenerated from the live catalog at build
// time (lib/seo/llmsTxt.ts), so an agent can read the whole chronological catalog from one file.
import type { APIRoute } from 'astro';
import { items } from '../lib/data/items';
import { buildLlmsTxt } from '../lib/seo/llmsTxt';
import { requireSiteUrl } from '../lib/seo/siteUrl';

export const prerender = true;

/** Serves the generated llms.txt as text/plain. */
export const GET: APIRoute = ({ site }) => {
	const siteUrl = requireSiteUrl(site);

	return new Response(buildLlmsTxt(items, siteUrl.toString()), {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});
};
