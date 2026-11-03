import type { Tag } from "@vnote/core";

/** Chips visibles antes de resumir el resto como «+N» (CL-9). */
export const MAX_VISIBLE_TAGS = 4;
export function splitTags(tags: readonly Tag[]): { shown: Tag[]; more: number } {
  return { shown: tags.slice(0, MAX_VISIBLE_TAGS), more: Math.max(0, tags.length - MAX_VISIBLE_TAGS) };
}
