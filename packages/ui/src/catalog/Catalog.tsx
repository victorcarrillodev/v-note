import { useState, type ReactNode } from "react";
import { colors, typography, spacing, radii, motion, layers, sizes, chips, themes } from "../design/tokens";
import { iconMap, type IconName } from "../design/iconMap";
import { Icon } from "../design/Icon";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { TextField, TextArea, Select } from "../components/fields";
import { Checkbox, Switch, Segmented } from "../components/controls";
import { Chip, ChipList } from "../components/Chip";
import { Tabs } from "../components/Tabs";
import { Card, CountBadge, Progress, ListRow } from "../components/Card";
import { ILLUSTRATIONS, Illustration, type IllustrationName } from "../design/Illustration";
import { Skeleton } from "../components/Skeleton";
import { InlineAlert } from "../components/InlineAlert";
import { Menu } from "../components/Menu";
import { Popover } from "../components/Popover";
import { Dialog } from "../components/Dialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SidePanel } from "../components/SidePanel";
import { createToastStore } from "../feedback/toastStore";
import { ToastViewport } from "../feedback/ToastViewport";

/** Superficie con el tema indicado: muestra el mismo contenido en claro y en oscuro (los selectores de tema también aplican a elementos anidados). */
function Surface({ theme, children }: { theme: (typeof themes)[number]; children: ReactNode }) {
  return <div data-theme={theme} className="rounded-md border border-[var(--c-border)] bg-[var(--c-canvas)] p-4 text-[var(--c-text)]"><p className="mb-2 text-[length:var(--text-label-size)] font-semibold uppercase text-[var(--c-text-muted)]">{theme === "light" ? "Claro" : "Oscuro"}</p>{children}</div>;
}
function Both({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-[length:var(--text-component-size)] font-semibold">{name}</h3>
      <div className="grid gap-4 md:grid-cols-2">{themes.map((t) => <Surface key={t} theme={t}>{children}</Surface>)}</div>
    </div>
  );
}

function ModalDemo() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [panel, setPanel] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setOpen(true)}>Abrir modal</Button>
      <Button variant="danger" onClick={() => setConfirm(true)}>Abrir confirmación</Button>
      <Button onClick={() => setPanel(true)}>Abrir panel</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Crear tarea" footer={<Button variant="primary" onClick={() => setOpen(false)}>Guardar</Button>}>
        <TextField label="Título" value="" onChange={() => {}} />
      </Dialog>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="¿Eliminar definitivamente?" description="No se puede deshacer." confirmLabel="Eliminar" cancelLabel="Cancelar" onConfirm={() => setConfirm(false)} />
      <SidePanel open={panel} onClose={() => setPanel(false)} title="Detalle"><p>Contenido del panel.</p></SidePanel>
    </div>
  );
}

// Demostración de avisos temporales: comprueba que tres avisos conviven apilados sin bloquear los controles de la página (U-133).
function ToastDemo() {
  const [store] = useState(() => createToastStore());
  const [clicks, setClicks] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => {
        store.add({ key: "save", tone: "success", message: "Guardado" });
        store.add({ key: "backup", tone: "info", message: "Respaldo listo" });
        store.add({ key: "reminder", tone: "info", message: "Recordatorio" });
      }}>Mostrar tres avisos</Button>
      <Button onClick={() => setClicks((n) => n + 1)}>Acción de la página</Button>
      <output data-page-action className="text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">Acciones: {clicks}</output>
      <ToastViewport store={store} />
    </div>
  );
}

const sample = (text: string) => <span>{text}</span>;

export function Catalog() {
  const [seg, setSeg] = useState("a");
  const [on, setOn] = useState(true);
  const [tab, setTab] = useState("table");
  const [text, setText] = useState("");
  return (
    <main className="mx-auto max-w-6xl p-8 text-[var(--c-text)]">
      <h1 className="mb-6 text-[length:var(--text-page-title-size)] font-bold">Catálogo de componentes</h1>

      <section aria-label="Colores" className="mb-10">
        <h2 className="mb-3 text-[length:var(--text-h2-size)] font-semibold">Colores</h2>
        <ul className="grid gap-2 md:grid-cols-2">
          {Object.entries(colors).map(([name, v]) => (
            <li key={name} className="flex items-center gap-3 text-[length:var(--text-ui-small-size)]">
              <span className="flex w-52 shrink-0 gap-1">
                <span aria-hidden="true" style={{ background: v.light }} className="h-6 w-6 rounded border border-[var(--c-border)]" />
                <span aria-hidden="true" style={{ background: v.dark }} className="h-6 w-6 rounded border border-[var(--c-border)]" />
              </span>
              <span className="font-medium">{name}</span>
              <code className="text-[var(--c-text-muted)]">{v.light}</code>
              <code className="text-[var(--c-text-muted)]">{v.dark}</code>
            </li>
          ))}
        </ul>
        <h3 className="mb-1 mt-4 font-semibold">Chips semánticos</h3>
        <div className="flex flex-wrap gap-2">{(Object.keys(chips) as (keyof typeof chips)[]).map((k) => <Chip key={k} tone={k}>{k}</Chip>)}</div>
      </section>

      <section aria-label="Tipografía" className="mb-10">
        <h2 className="mb-3 text-[length:var(--text-h2-size)] font-semibold">Tipografía</h2>
        {Object.entries(typography).map(([n, l]) => (
          <p key={n} className="mb-1 flex items-baseline gap-3">
            <code className="w-28 shrink-0 text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{n}</code>
            <span style={{ fontSize: l.size, lineHeight: `${l.line}px`, fontWeight: l.weight }}>{`${n} ${l.size}/${l.line}`}</span>
          </p>
        ))}
      </section>

      <section aria-label="Espaciado, radios y capas" className="mb-10">
        <h2 className="mb-3 text-[length:var(--text-h2-size)] font-semibold">Espaciado, radios y capas</h2>
        <p>Espaciado: {spacing.join(" · ")} px</p>
        <ul className="my-2 flex flex-wrap gap-3">{Object.entries(radii).map(([n, r]) => <li key={n} className="flex items-center gap-1"><span aria-hidden="true" style={{ borderRadius: Math.min(r, 20) }} className="inline-block h-6 w-6 border border-[var(--c-border-control)]" /><code>{n}</code> {r}px</li>)}</ul>
        <ul className="my-2 flex flex-wrap gap-3">{Object.entries(motion).map(([n, ms]) => <li key={n}><code>{n}</code> {ms} ms</li>)}</ul>
        <ul className="my-2 flex flex-wrap gap-3">{Object.entries(layers).map(([n, z]) => <li key={n}><code>{n}</code> {z}</li>)}</ul>
        <ul className="my-2 flex flex-wrap gap-3">{Object.entries(sizes).map(([n, v]) => <li key={n}><code>{n}</code> {v}px</li>)}</ul>
      </section>

      <section aria-label="Íconos" className="mb-10">
        <h2 className="mb-3 text-[length:var(--text-h2-size)] font-semibold">Íconos</h2>
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(Object.keys(iconMap) as IconName[]).map((n) => <li key={n} className="flex items-center gap-2"><Icon name={n} size={20} /><code>{n}</code></li>)}
        </ul>
      </section>

      <section aria-label="Avisos temporales" className="mb-10">
        <h2 className="mb-3 text-[length:var(--text-h2-size)] font-semibold">Avisos temporales</h2>
        <ToastDemo />
      </section>

      <section aria-label="Componentes" className="mb-10">
        <h2 className="mb-3 text-[length:var(--text-h2-size)] font-semibold">Componentes</h2>
        <Both name="Botón">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Principal</Button><Button>Secundario</Button><Button variant="ghost">Fantasma</Button><Button variant="danger">Peligro</Button>
            <Button disabled>Deshabilitado</Button><Button variant="primary" loading>Guardando</Button><Button size="sm">Pequeño</Button>
          </div>
          <p className="mt-1 text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">estado: carga</p>
        </Both>
        <Both name="Botón de ícono"><div className="flex gap-2"><IconButton icon="settings" label="Ajustes" /><IconButton icon="delete" label="Eliminar" disabled /></div></Both>
        <Both name="Campo de texto"><div className="flex flex-col gap-2"><TextField label="Nombre" value={text} onChange={setText} /><TextField label="Con error" value="x" onChange={() => {}} error="Este campo no es válido" /></div></Both>
        <Both name="Área de texto"><TextArea label="Notas" value="" onChange={() => {}} /></Both>
        <Both name="Selector"><Select label="Tipo" value="a" onChange={() => {}} options={[{ value: "a", label: "Uno" }, { value: "b", label: "Dos" }]} /></Both>
        <Both name="Casilla"><div className="flex flex-col gap-1"><Checkbox label="Marcada" checked onChange={() => {}} /><Checkbox label="Sin marcar" checked={false} onChange={() => {}} /></div></Both>
        <Both name="Interruptor"><Switch label="Ancho completo" checked={on} onChange={setOn} /></Both>
        <Both name="Control segmentado"><Segmented label="Densidad" value={seg} onChange={setSeg} options={[{ value: "a", label: "Cómoda" }, { value: "b", label: "Compacta" }]} /></Both>
        <Both name="Etiqueta"><div className="flex flex-wrap gap-2"><Chip>Neutra</Chip><Chip tone="info">Info</Chip><Chip tone="success" onRemove={() => {}} removeLabel="Quitar éxito">Éxito</Chip><ChipList chips={[{ id: "1", label: "Uno" }, { id: "2", label: "Dos" }, { id: "3", label: "Tres" }]} max={1} moreLabel={(n) => `+${n}`} /></div></Both>
        <Both name="Pestañas"><Tabs label="Vistas" value={tab} onChange={setTab} tabs={[{ value: "table", label: "Tabla" }, { value: "board", label: "Tablero" }]} /></Both>
        <Both name="Tarjeta"><Card>{sample("Contenido de tarjeta")}<span className="ml-2"><CountBadge value={120} /></span></Card></Both>
        <Both name="Progreso"><div className="flex flex-col gap-2"><Progress label="Progreso conocido" value={40} /><Progress label="Progreso sin valor" /></div></Both>
        <Both name="Fila de lista"><div><ListRow>Normal</ListRow><ListRow selected>Seleccionada</ListRow></div></Both>
        <Both name="Ilustraciones"><div className="flex gap-4 text-[var(--c-text-muted)]">{(Object.keys(ILLUSTRATIONS) as IllustrationName[]).map((n) => <Illustration key={n} name={n} size={64} />)}</div></Both>
        <Both name="Esqueleto"><Skeleton height={20} width={160} /></Both>
        <Both name="Aviso en línea"><div className="flex flex-col gap-2"><InlineAlert tone="info">Solo lectura</InlineAlert><InlineAlert tone="error" title="No se pudo respaldar" action={{ label: "Reintentar", onClick: () => {} }}>El token no es válido.</InlineAlert></div></Both>
        <Both name="Menú"><Menu label="Más acciones" items={[{ label: "Renombrar", icon: "edit", onSelect: () => {} }, { label: "Eliminar", icon: "delete", onSelect: () => {}, danger: true }]} /></Both>
        <Both name="Popover"><Popover trigger={<Button>Abrir popover</Button>}><p>Contenido del popover</p></Popover></Both>
        <Both name="Modal"><ModalDemo /></Both>
        <Both name="Confirmación destructiva"><p className="text-[length:var(--text-ui-size)]">Se abre desde «Abrir confirmación» del modal.</p></Both>
        <Both name="Panel lateral"><p className="text-[length:var(--text-ui-size)]">Se abre desde «Abrir panel» del modal.</p></Both>
      </section>
    </main>
  );
}
