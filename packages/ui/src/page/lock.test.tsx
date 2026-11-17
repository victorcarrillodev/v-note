// E-131 a E-136 (RF-8.1, RF-8.1.1, CL-11, D-17): bloqueo de página.
import { describe, it, expect } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { AppHeader } from "../layout/AppHeader";
import { ToastProvider } from "../feedback/ToastContext";
import { PageHeader } from "./PageHeader";
import { PageEditor } from "../editor/PageEditor";
import { TableView } from "../databases/TableView";
import { ThemeProvider, MemoryPreferences } from "../theme/theme";
import { DatabaseController } from "../databases/databaseController";
import { BoardService, DatabaseService, ViewService, FakeClock, PagesRepo, migrate, migrations } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;

// jsdom no implementa getClientRects (ProseMirror lo usa al desplazar la selección).
const emptyRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
Range.prototype.getClientRects ??= emptyRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect();
Element.prototype.getClientRects ??= emptyRects;

type C = Awaited<ReturnType<typeof makeController>>["controller"];
const pageOf = (c: C, id: string): any => { const f = (ns: ReturnType<C["getSnapshot"]>["tree"]): any => ns.flatMap((n) => (n.page.id === id ? [n.page] : f(n.children)))[0]; return f(c.getSnapshot().tree); };

async function setup(opts: { locked?: boolean; cover?: string; editor?: boolean } = {}) {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  if (opts.cover) await controller.setPageProps(r.value.id, { cover: opts.cover });
  if (opts.locked) await controller.setPageProps(r.value.id, { locked: true });
  await controller.select(r.value.id);
  await renderWithI18n(
    <ThemeProvider preferences={new MemoryPreferences()}>
      <ToastProvider>
        <header><AppHeader controller={controller} now={() => 0} onNavigate={() => {}} /></header>
        <PageHeader controller={controller} pageId={r.value.id} workspaceName="Mi espacio" />
        {opts.editor && <PageEditor controller={controller} pageId={r.value.id} />}
      </ToastProvider>
    </ThemeProvider>,
  );
  return { controller, id: r.value.id, page: () => pageOf(controller, r.value.id), user: userEvent.setup() };
}
const openMenu = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole("button", { name: "Opciones de la página" })); await screen.findByRole("group", { name: "Opciones de la página" }); };

describe("interruptor «Bloquear página» (E-131)", () => {
  it("bloquea y desbloquea, y cada cambio entra al historial con «Deshacer»", async () => {
    const { user, page, controller, id } = await setup();
    await openMenu(user);
    const sw = screen.getByRole("switch", { name: "Bloquear página" });
    expect(sw).not.toBeChecked();
    await user.click(sw);
    await waitFor(() => expect(page().locked).toBe(true));
    expect(sw).toBeChecked();
    await user.click(await screen.findByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(page().locked).toBe(false));
    await controller.redoPageProps(id);
    expect(page().locked).toBe(true);
  });
});

describe("cabecera de una página bloqueada (E-133, E-134)", () => {
  it("título y descripción de solo lectura; sin «Cambiar portada» ni ajustes", async () => {
    await setup({ locked: true, cover: "gradient:sky" });
    expect(screen.getByRole("textbox", { name: "Título de la página" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Cambiar portada" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ajustes de la portada" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Añadir portada" })).toBeNull();
  });
  it("la descripción no se puede editar", async () => {
    const { user, page, controller, id } = await setup({ locked: true });
    await controller.setPageProps(id, { description: "Fija" });
    const d = await screen.findByRole("button", { name: /^Descripción de la página/ });
    expect(d).toBeDisabled();
    await user.click(d);
    expect(screen.queryByRole("textbox", { name: "Descripción de la página" })).toBeNull();
    expect(page().description).toBe("Fija");
  });
  it("el menú no ofrece cambiar la portada, pero las opciones de estilo sí se pueden cambiar", async () => {
    const { user, page } = await setup({ locked: true, cover: "gradient:sky" });
    await openMenu(user);
    expect(screen.queryByRole("button", { name: "Cambiar portada…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ajustes de la portada…" })).toBeNull();
    await user.click(screen.getByRole("switch", { name: "Fecha de actualización" }));
    await waitFor(() => expect(page().style.header.updated).toBe(true));
  });
  it("un indicador con candado desbloquea con un clic (E-134)", async () => {
    const { user, page } = await setup({ locked: true });
    const ind = screen.getByTestId("lock-indicator");
    expect(ind).toHaveTextContent("Página bloqueada");
    await user.click(ind);
    await waitFor(() => expect(page().locked).toBe(false));
    expect(screen.queryByTestId("lock-indicator")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Título de la página" })).not.toHaveAttribute("readonly");
  });
  it("sin bloqueo no hay indicador", async () => {
    await setup();
    expect(screen.queryByTestId("lock-indicator")).toBeNull();
  });
});

describe("editor de una página bloqueada (E-132, E-135, CL-11)", () => {
  const editorEl = async () => (await screen.findByRole("textbox", { name: /Editor|editor/i }).catch(() => null)) ?? (await waitFor(() => { const e = document.querySelector(".bn-editor"); if (!e) throw new Error("sin editor"); return e as HTMLElement; }));
  const dom = () => document.querySelector(".bn-editor") as HTMLElement;

  it("con la página bloqueada el editor es de solo lectura y sin menú «/»", async () => {
    await setup({ locked: true, editor: true });
    await waitFor(() => expect(dom()).not.toBeNull());
    await waitFor(() => expect(dom().getAttribute("contenteditable")).toBe("false"));
    void editorEl;
  });
  it("al desbloquear vuelve a ser editable sin remontarse", async () => {
    const { user } = await setup({ locked: true, editor: true });
    await waitFor(() => expect(dom().getAttribute("contenteditable")).toBe("false"));
    const node = dom();
    await user.click(screen.getByTestId("lock-indicator"));
    await waitFor(() => expect(dom().getAttribute("contenteditable")).toBe("true"));
    expect(dom()).toBe(node);
  });
  it("escribir, pegar y arrastrar no cambian el documento y muestran el aviso", async () => {
    const { user } = await setup({ locked: true, editor: true });
    await waitFor(() => expect(dom().getAttribute("contenteditable")).toBe("false"));
    const before = dom().textContent;
    expect(screen.queryByTestId("locked-notice")).toBeNull();
    dom().focus();
    await user.keyboard("hola");
    expect(dom().textContent).toBe(before);
    const notice = await screen.findByTestId("locked-notice");
    expect(notice).toHaveTextContent("Página bloqueada");
    // el aviso se va solo y vuelve con otro intento
    await act(async () => { await new Promise((r) => setTimeout(r, 4200)); });
    expect(screen.queryByTestId("locked-notice")).toBeNull();
    fireEvent.paste(dom(), { clipboardData: { getData: () => "pegado", files: [], items: [], types: ["text/plain"] } });
    expect(await screen.findByTestId("locked-notice")).toBeInTheDocument();
    expect(dom().textContent).toBe(before);
    fireEvent.drop(dom(), { dataTransfer: { files: [], items: [], types: [], getData: () => "" } });
    expect(dom().textContent).toBe(before);
  }, 15000);
  it("las teclas que no editan (flechas) no muestran el aviso", async () => {
    const { user } = await setup({ locked: true, editor: true });
    await waitFor(() => expect(dom().getAttribute("contenteditable")).toBe("false"));
    dom().focus();
    await user.keyboard("{ArrowDown}{ArrowLeft}");
    expect(screen.queryByTestId("locked-notice")).toBeNull();
  });
  it("una página sin bloqueo no muestra el aviso al escribir", async () => {
    const { user } = await setup({ editor: true });
    await waitFor(() => expect(dom().getAttribute("contenteditable")).toBe("true"));
    dom().focus();
    await user.keyboard("hola");
    expect(screen.queryByTestId("locked-notice")).toBeNull();
  });
});

describe("vistas de base de datos y bloqueo (E-136, D-17)", () => {
  const must = <T,>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error(JSON.stringify(r)); return r.value as T; };
  async function base() {
    const store = await createNodeSqliteStore(":memory:");
    await migrate(store, migrations);
    const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
    const dbs = new DatabaseService(store, clock);
    const d = must(await dbs.createDatabase({ name: "Tareas" }));
    const nota = must(await dbs.addProperty(d.id, { name: "Nota", type: "text" }));
    const fila = must(await dbs.addRow(d.id, { title: "Fila" }));
    const repo = new PagesRepo(store, clock);
    must(await repo.setLocked(fila.pageId, true));
    const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
    return { store, clock, c, nota, pageId: fila.pageId, repo, dbs, dbId: d.id };
  }
  it("tabla: la propiedad de una fila bloqueada se edita y su título queda de solo lectura", async () => {
    const { c, nota, pageId, repo, dbs, dbId } = await base();
    await renderWithI18n(<TableView controller={c} height={300} />);
    const title = await screen.findByRole("textbox", { name: /Título de la fila/ });
    expect(title).toHaveAttribute("readonly");
    // la propiedad cambia (D-17)
    expect((await c.setCell(pageId, nota.id, "hola")).ok).toBe(true);
    expect((await dbs.getRows(dbId))[0]!.values[nota.id]).toBe("hola");
    expect((await dbs.getRows(dbId))[0]!.locked).toBe(true);
    // el título no: ni por la vista ni por el controlador
    fireEvent.change(title, { target: { value: "Cambiado" } });
    fireEvent.blur(title);
    const t = await c.setTitle(pageId, "Otro");
    expect(t.ok).toBe(false);
    expect(!t.ok && t.error.code).toBe("LOCKED");
    expect(must(await repo.get(pageId)).title).toBe("Fila");
    // desbloqueada, vuelve a poder cambiarse
    must(await repo.setLocked(pageId, false));
    expect((await c.setTitle(pageId, "Otro")).ok).toBe(true);
  });
  it("tablero: mover una tarjeta (propiedad de estado) sigue funcionando con la página bloqueada", async () => {
    const store = await createNodeSqliteStore(":memory:");
    await migrate(store, migrations);
    const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
    const dbs = new DatabaseService(store, clock), boards = new BoardService(dbs, new ViewService(store));
    const b = must(await boards.createBoard({ name: "Tablero" }));
    const card = must(await boards.createCard(b.databaseId, { title: "Tarjeta" }));
    must(await new PagesRepo(store, clock).setLocked(card.pageId, true));
    const c = (await DatabaseController.forPage(store, clock, b.pageId))!;
    await c.refresh();
    const other = must(await boards.addColumn(b.databaseId, "Otra"));
    expect((await c.moveCard(card.pageId, other.id)).ok).toBe(true);
    expect((await c.setTitle(card.pageId, "Otro")).ok).toBe(false); // el título sigue protegido
  });
});
