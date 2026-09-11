// Shared precondition for Astro's `site` config value. Plain module, no astro:content or
// Astro runtime imports, so API routes (sitemap.xml.ts, llms.txt.ts) and .astro frontmatter
// (index.astro, title/[id].astro, BaseLayout.astro) all guard the same way with one message.

const MISSING_SITE_MESSAGE = 'astro.config.mjs must set `site` for the site base URL to be known.';

/** Returns `site` as a URL. Throws when astro.config.mjs has no `site` set. */
export function requireSiteUrl(site: URL | undefined): URL {
	if (!site) {
		throw new Error(MISSING_SITE_MESSAGE);
	}

	return site;
}
