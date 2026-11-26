import type { Block } from "../blocks/types";
import { cardState, type CardState } from "./schedule";

export type Flashcard = CardState & { blockId: string; front: string; back: string };

/** Tarjetas de un documento (también las anidadas). Una tarjeta sin pregunta todavía no se repasa. */
export function flashcardsFromBlocks(blocks: Block[]): Flashcard[] {
  return blocks.flatMap((b) => {
    const front = typeof b.props.front === "string" ? b.props.front.trim() : "";
    const own = b.type === "flashcard" && front !== ""
      ? [{ blockId: b.id, front, back: typeof b.props.back === "string" ? b.props.back : "", ...cardState(b.props) }]
      : [];
    return [...own, ...flashcardsFromBlocks(b.children)];
  });
}
