// Astro Content Layer collections for build-time-baked, anonymous-readable media
// metadata (see marvel-h8a). Both collections are populated by custom loaders
// (titleInfoLoader.ts / episodeInfoLoader.ts) that iterate the static catalog in
// lib/data/items.ts and fetch from OMDb/imdbapi.dev, instead of the SvelteKit-era
// pattern of fetching from a hand-rolled Azure Functions cache at runtime.
//
// This file only wires loader -> schema; all fetch/mapping/fallback logic lives
// under lib/data/mediaMetadata/, which is framework-agnostic Astro Content Layer
// is the only thing here that's Astro-specific.
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { titleInfoLoader } from './lib/data/mediaMetadata/titleInfoLoader';
import { episodeInfoLoader } from './lib/data/mediaMetadata/episodeInfoLoader';

/** Mirrors TrailerInfo in lib/data/mediaMetadata/titleInfoFetch.ts. */
const trailerSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	url: z.string(),
	embedUrl: z.string(),
	imageUrl: z.string(),
	runtimeSeconds: z.number().nullable()
});

/**
 * `titleInfo` collection: one entry per catalog item, keyed by `imdbId` (movies,
 * shorts, specials) or `imdbId-s{season}` (series — see titleInfoLoader.ts).
 */
const titleInfo = defineCollection({
	loader: titleInfoLoader(),
	schema: z.object({
		plot: z.string(),
		imdbRating: z.string(),
		poster: z.string(),
		runtimeMinutes: z.number().nullable(),
		released: z.string(),
		trailer: trailerSchema.nullable()
	})
});

/** Mirrors Episode in lib/data/mediaMetadata/episodeInfoFetch.ts. */
const episodeSchema = z.object({
	id: z.string(),
	title: z.string(),
	episodeNumber: z.number(),
	runtimeSeconds: z.number().nullable(),
	plot: z.string(),
	posterUrl: z.string(),
	imdbRating: z.string(),
	released: z.string()
});

/** `episodes` collection: one entry per series season, keyed by `imdbId-s{season}`. */
const episodes = defineCollection({
	loader: episodeInfoLoader(),
	schema: z.object({
		episodes: z.array(episodeSchema),
		totalCount: z.number()
	})
});

export const collections = { titleInfo, episodes };
