// Static llms.txt endpoint (llmstxt.org format), regenerated from the live catalog at build
// time (lib/seo/llmsTxt.ts), so an agent can read the whole chronological catalog from one file.
import type { APIRoute } from 'astro';
import { items } from '../lib/data/items';
import { buildLlmsTxt } from '../lib/seo/llmsTxt';

export const prerender = true;

/** Serves the generated llms.txt as text/plain. */
export const GET: APIRoute = ({ site }) => {
	if (!site) {
		throw new Error('astro.config.mjs must set `site` for llms.txt to know its base URL.');
	}

	return new Response(buildLlmsTxt(items, site.toString()), {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});
};
