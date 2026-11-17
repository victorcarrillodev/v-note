import { create } from "zustand";

/**
 * Pedidos de la interfaz entre el menú de opciones (en la barra superior) y la cabecera de la página (spec 005, RF-4.2):
 * el menú pide abrir el selector o los ajustes de la portada y la cabecera, que es quien los dibuja, los abre.
 * Cada pedido es un contador: así dos pedidos seguidos del mismo tipo se notan.
 */
export const usePageUiStore = create<{
  pickerRequest: number; adjustRequest: number;
  openPicker: () => void; openAdjust: () => void;
}>((set) => ({
  pickerRequest: 0, adjustRequest: 0,
  openPicker: () => set((s) => ({ pickerRequest: s.pickerRequest + 1 })),
  openAdjust: () => set((s) => ({ adjustRequest: s.adjustRequest + 1 })),
}));
