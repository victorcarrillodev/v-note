import type { BlockNoteEditor } from "@blocknote/core";
import { blockTypeSelectItems, type BlockTypeSelectItem } from "@blocknote/react";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";

/** Opciones de «Convertir en»: las de BlockNote más los bloques propios que conservan el texto. */
export function buildBlockTypeItems(editor: BlockNoteEditor<any, any, any>, t: (key: string) => string): BlockTypeSelectItem[] {
  const own = (type: string, label: string, icon: IconName): BlockTypeSelectItem => ({ type, name: t(label), icon: () => <Icon name={icon} size={16} /> });
  const defaults = blockTypeSelectItems(editor);
  const extra = [own("codeBlock", "editor.codeBlockType", "code"), own("callout", "editor.callout", "tip"), own("task", "task.slash", "task")];
  return [...defaults, ...extra.filter((e) => !defaults.some((d) => d.type === e.type))];
}
