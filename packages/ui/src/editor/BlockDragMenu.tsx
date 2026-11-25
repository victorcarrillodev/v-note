import { BlockColorsItem, DragHandleMenu, RemoveBlockItem, SideMenu, SideMenuController, TableColumnHeaderItem, TableRowHeaderItem, useBlockNoteEditor, useComponentsContext, useExtensionState } from "@blocknote/react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { useRef, useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { buildBlockTypeItems } from "./blockTypeItems";

/** «Convertir en» del menú del asa: solo en bloques con texto, para no perder contenido. */
function TurnIntoItem() {
  const { t } = useTranslation();
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor<any, any, any>();
  const block = useExtensionState(SideMenuExtension, { selector: (state) => state?.block });
  if (!block || editor.schema.blockSchema[block.type]?.content !== "inline") return null;
  return (
    <Components.Generic.Menu.Root position="right" sub portalElement={null}>
      <Components.Generic.Menu.Trigger sub>
        <Components.Generic.Menu.Item className="bn-menu-item" subTrigger>{t("editor.turnInto")}</Components.Generic.Menu.Item>
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown sub className="bn-menu-dropdown">
        {buildBlockTypeItems(editor, t).map((item) => {
          const ItemIcon = item.icon;
          const checked = block.type === item.type && Object.entries(item.props ?? {}).every(([k, v]) => (block.props as Record<string, unknown>)[k] === v);
          return (
            <Components.Generic.Menu.Item
              key={`${item.type}:${JSON.stringify(item.props ?? {})}`}
              className="bn-menu-item"
              icon={<ItemIcon size={16} />}
              checked={checked}
              onClick={() => editor.updateBlock(block, { type: item.type, props: item.props } as never)}
            >
              {item.name}
            </Components.Generic.Menu.Item>
          );
        })}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}

function BlockMenu() {
  const { t } = useTranslation();
  const editor = useBlockNoteEditor();
  const dict = editor.dictionary.drag_handle;
  // BlockNote cierra los submenús con retardo. Al pasar a otra opción se remontan los demás para que se quiten de inmediato.
  const active = useRef("");
  const [keys, setKeys] = useState({ turn: 0, colors: 0 });
  const enter = (item: "turn" | "colors" | "other") => () => {
    if (active.current === item) return;
    active.current = item;
    setKeys((k) => ({ turn: item === "turn" ? k.turn : k.turn + 1, colors: item === "colors" ? k.colors : k.colors + 1 }));
  };
  return (
    <DragHandleMenu>
      <div onMouseEnter={enter("turn")}><TurnIntoItem key={keys.turn} /></div>
      <div onMouseEnter={enter("colors")}><BlockColorsItem key={keys.colors}>{dict.colors_menuitem}</BlockColorsItem></div>
      <div onMouseEnter={enter("other")}>
        <TableRowHeaderItem>{dict.header_row_menuitem}</TableRowHeaderItem>
        <TableColumnHeaderItem>{dict.header_column_menuitem}</TableColumnHeaderItem>
        <RemoveBlockItem><span className="text-[var(--c-danger)]">{dict.delete_menuitem}</span></RemoveBlockItem>
      </div>
    </DragHandleMenu>
  );
}

// Componente estable (fuera del render): si se creara en cada redibujado, el menú abierto se remontaría y se cerraría solo.
const CustomSideMenu = (props: ComponentProps<typeof SideMenu>) => <SideMenu {...props} dragHandleMenu={BlockMenu} />;

export function BlockSideMenu() {
  return <SideMenuController sideMenu={CustomSideMenu} />;
}
