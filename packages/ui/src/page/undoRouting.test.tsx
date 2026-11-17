// E-128 (RF-4.6, DP-8): Ctrl+Z va al historial del contenido si el foco está en él, y al de las propiedades en cualquier otro lugar.
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "./PageHeader";

async function setup() {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  await controller.setPageProps(r.value.id, { style: { accent: "blue" } });
  await controller.setPageProps(r.value.id, { style: { accent: "red" } });
  let editorUndos = 0;
  await renderWithI18n(
    <>
      <PageHeader controller={controller} pageId={r.value.id} />
      <div className="bn-editor" contentEditable suppressContentEditableWarning data-testid="content" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "z") editorUndos++; }}>texto</div>
      <button type="button">otro lugar</button>
    </>,
  );
  const accent = () => { const f = (ns: ReturnType<typeof controller.getSnapshot>["tree"]): any => ns.flatMap((n) => (n.page.id === r.value.id ? [n.page] : f(n.children)))[0]; return f(controller.getSnapshot().tree).style.accent; };
  return { user: userEvent.setup(), accent, editorUndos: () => editorUndos };
}

describe("Ctrl+Z (E-128)", () => {
  it("con el foco en el contenido, lo atiende el editor y las propiedades no se tocan", async () => {
    const { user, accent, editorUndos } = await setup();
    screen.getByTestId("content").focus();
    await user.keyboard("{Control>}z{/Control}");
    expect(editorUndos()).toBe(1); // llegó al editor (el historial de Yjs)
    expect(accent()).toBe("red"); // el de las propiedades no cambió
  });
  it("con el foco en cualquier otro lugar, deshace la última propiedad y Ctrl+Mayús+Z la rehace", async () => {
    const { user, accent } = await setup();
    screen.getByRole("button", { name: "otro lugar" }).focus();
    await user.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(accent()).toBe("blue"));
    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    await waitFor(() => expect(accent()).toBe("red"));
  });
  it("con el foco en un campo de texto, vale el deshacer del propio campo", async () => {
    const { user, accent } = await setup();
    await user.click(screen.getByRole("textbox", { name: "Título de la página" }));
    await user.keyboard("{Control>}z{/Control}");
    expect(accent()).toBe("red");
  });
});
