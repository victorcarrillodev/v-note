import { expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";

/** Lo mínimo de `userEvent` que usa el ayudante (sirve la instancia de `setup()` y el objeto global). */
interface Clicker { click(el: Element): Promise<void> }

/** Elige una opción de un `Dropdown`/`ChoiceMenu` (equivale a `user.selectOptions` del `<select>` nativo): abre el menú y pulsa la opción por su valor o su texto. */
export async function choose(user: Clicker, trigger: HTMLElement, option: string): Promise<void> {
  await user.click(trigger);
  const items = await screen.findAllByRole("menuitemradio");
  const hit = items.find((i) => i.getAttribute("data-value") === option) ?? items.find((i) => i.textContent?.trim() === option);
  if (!hit) throw new Error(`No hay una opción «${option}» (hay: ${items.map((i) => i.getAttribute("data-value")).join(", ")})`);
  await user.click(hit);
  await waitFor(() => expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0));
}

/** Valor elegido en un `Dropdown` (equivale a `select.value`). */
export const dropdownValue = (el: HTMLElement): string | null => el.getAttribute("data-value");

/** Opciones de un `Dropdown` (equivale a `[...select.options]`): abre el menú, las lee y lo cierra. */
export async function dropdownOptions(trigger: HTMLElement): Promise<{ value: string; label: string }[]> {
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  await user.click(trigger);
  const items = await screen.findAllByRole("menuitemradio");
  const list = items.map((i) => ({ value: i.getAttribute("data-value") ?? "", label: i.textContent?.trim() ?? "" }));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0));
  return list;
}
