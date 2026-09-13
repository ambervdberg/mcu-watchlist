// Pure llms.txt builder (llmstxt.org format), generated from the static catalog at build time.
// Framework-agnostic: no Astro, DOM, or fetch imports.

import { formatItemType, type Item } from '../domain/item';
import { titleUrl } from './catalogUrl';

const SITE_TITLE = 'MCU Chronological Watchlist';
const SITE_SUMMARY = 'Browse the MCU in chronological order, movies, series, shorts and specials alike.';
const SITE_DESCRIPTION =
	'A public catalog of every Marvel Cinematic Universe title, ordered by in-universe timeline rather ' +
	'than release date. Browsing and search are open to anyone. Creating a free account, email only, no ' +
	'password, lets a visitor track which titles they have watched.';

/** Builds an llms.txt document: title, summary, description, then one section per era. */
export function buildLlmsTxt(items: Item[], baseUrl: string): string {
	const sections = groupByEra(items).map(([era, eraItems]) => buildEraSection(era, eraItems, baseUrl));

	return [`# ${SITE_TITLE}`, '', `> ${SITE_SUMMARY}`, '', SITE_DESCRIPTION, '', sections.join('\n\n')].join('\n');
}

/** Groups items by era, preserving catalog order for both eras and items within an era. */
function groupByEra(items: Item[]): Array<[string, Item[]]> {
	const eras = new Map<string, Item[]>();

	for (const item of items) {
		const eraItems = eras.get(item.era) ?? [];
		eraItems.push(item);
		eras.set(item.era, eraItems);
	}

	return [...eras.entries()];
}

/** Renders one markdown section: an `## <era>` heading followed by a link per item. */
function buildEraSection(era: string, items: Item[], baseUrl: string): string {
	const links = items.map((item) => buildItemLink(item, baseUrl));

	return [`## ${era}`, ...links].join('\n');
}

/** Renders one markdown link line for a catalog item. */
function buildItemLink(item: Item, baseUrl: string): string {
	const url = titleUrl(baseUrl, item.id);
	const linkText = escapeMarkdownLinkText(item.title);

	return `- [${linkText}](${url}): ${formatItemType(item.type)}, timeline ${item.timeline}`;
}

/** Escapes markdown link-text special characters, so a title can never close the link early. */
function escapeMarkdownLinkText(text: string): string {
	return text.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}
