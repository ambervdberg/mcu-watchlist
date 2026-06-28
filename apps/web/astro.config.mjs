import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

// Social-card scrapers (LinkedIn, Facebook, X) do not rasterize SVG og:images, they need a
// real PNG/JPG. The committed card art lives as static/og-image.svg (vector, easy to edit);
// this tiny integration rasterizes it to og-image.png in the build output at build time, so
// the bitmap is always derived from the SVG and never drifts or needs committing by hand.
function ogImageRasterizer() {
	return {
		name: 'og-image-rasterizer',
		hooks: {
			'astro:build:done': async (
				/** @type {{ dir: URL; logger: import('astro').AstroIntegrationLogger }} */
				{ dir, logger }
			) => {
				const { default: sharp } = await import('sharp');

				const svgPath = fileURLToPath(new URL('./static/og-image.svg', import.meta.url));
				const pngPath = fileURLToPath(new URL('og-image.png', dir));

				await sharp(svgPath, { density: 144 }).resize(1200, 630).png().toFile(pngPath);

				logger.info('rasterized og-image.svg -> og-image.png (1200x630)');
			}
		}
	};
}

// $lib was SvelteKit's built-in alias for src/lib (see svelte.config.js); Astro has no
// equivalent built in, so it is reproduced here via Vite's resolve.alias so every existing
// `$lib/...` import across .astro/.svelte files keeps working unchanged.
export default defineConfig({
	output: 'static',
	outDir: 'build',
	publicDir: 'static',
	integrations: [svelte(), ogImageRasterizer()],
	vite: {
		resolve: {
			alias: {
				$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
			}
		}
	},
	// Astro's Svelte islands hydrate via inline <script> tags (the client:load/visible
	// runtime bootstrap), so a `script-src 'self'` CSP with no 'unsafe-inline'/hash/nonce
	// silently blocks every island from ever hydrating -- this is what makes the auto-hash
	// CSP feature below necessary rather than optional once `static/staticwebapp.config.json`
	// sets a strict script-src. Astro computes the exact sha256 hash of every bundled inline
	// script/style at build time and injects it into a per-page <meta> CSP tag, so the hashes
	// never drift out of sync with the actual build output. `frame-ancestors` is intentionally
	// NOT listed here: browsers ignore that directive when delivered via <meta>, so it stays
	// in the HTTP header (static/staticwebapp.config.json) instead.
	security: {
		csp: {
			directives: [
				"default-src 'self'",
				"img-src 'self' https: data:",
				'frame-src https://www.imdb.com',
				"connect-src 'self' https://api.imdbapi.dev",
				"object-src 'none'",
				"base-uri 'self'"
			]
		}
	}
});
