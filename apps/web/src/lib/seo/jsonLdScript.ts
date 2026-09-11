// Escapes JSON-LD text before it goes inside an inline <script> tag. Plot/title text comes
// from OMDb and may contain "</script>" or "<!--", which would break out of the tag.

/** Serializes `value` as JSON-LD safe to inline in a <script> tag: escapes every `<`. */
export function serializeJsonLd(value: unknown): string {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}
