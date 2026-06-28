import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';

// Standalone replacement for the old SvelteKit-flavoured vite.config.ts (bead: Astro
// migration cleanup). Astro reads its own astro.config.mjs for dev/build and never touches
// this file -- this file exists purely so `vitest` has a vite pipeline to compile .svelte
// component test fixtures and resolve the `$lib` alias, now that `sveltekit()` (which used
// to provide both) is gone along with the rest of src/routes/.
//
// $lib mirrors astro.config.mjs's alias so lib code/tests keep using the same import paths
// regardless of which build tool (astro vs vitest) is driving them.
export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			}
		})
	],
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vitest.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vitest.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
