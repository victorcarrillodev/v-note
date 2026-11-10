# Verificaciones manuales de la spec 004 (R-188, R-189, R-190)

Marca cada casilla con la fecha y tu nombre cuando la compruebes. Las pruebas automáticas ya cubren la lógica; esto es lo que solo se ve con un dispositivo real o un lector de pantalla.

## R-188 — Táctil en dispositivo real (RF-17, RF-13)
Dispositivo: ________  Navegador: ________  Fecha: ________
- [ ] El menú de un globo, una forma y un punto no queda bajo el dedo.
- [ ] Los botones del menú, las asas y los puntos se pulsan sin error (≥ 44 px).
- [ ] Pellizco: hace zoom en el mapa y en el diagrama.
- [ ] Arrastrar el fondo con un dedo desplaza la vista; arrastrar un globo lo mueve con su rama.
- [ ] Un toque en un globo lo selecciona, abre el menú y permite escribir.

## R-189 — Teclado y lector de pantalla (RF-2, RF-17, RNF-3)
Lector: ________  Fecha: ________
- [ ] Tab recorre globos/formas, Enter abre menú y edición, Esc cierra por capas.
- [ ] Flechas mueven una celda (Mayús = 5); Supr elimina; Ctrl+C/V copian ramas; + − 0 F hacen zoom y ajuste; Ctrl+Mayús+F amplía.
- [ ] Los menús se anuncian con nombre, rol y estado; el cambio de selección y el aviso de eliminación se leen.
- [ ] En la vista ampliada el foco queda dentro y al salir vuelve a donde estaba; Tab sale del bloque fuera de ella.

## R-190 — Criterios de finalización 1 a 13 de la spec (evidencia)
Fecha: ________
- [ ] 1 Sin franja inferior; opciones en menús junto al elemento.
- [ ] 2 Ampliar y volver sin perder nada (diagrama y mapa).
- [ ] 3 Cursor de mano en lo clicable y de no permitido en lo deshabilitado.
- [ ] 4 Sin contorno azul con ratón o dedo; foco de teclado visible.
- [ ] 5 Agregar y quitar puntos de quiebre.
- [ ] 6 Conector curvo continuo, también al exportar.
- [ ] 7 Colores de globo y de rama.
- [ ] 8 Mover con su rama y reordenar automáticamente.
- [ ] 9 Ancho de la columna, alto ajustable y controles de vista del mapa.
- [ ] 10 Un clic abre el menú y permite escribir.
- [ ] 11 Acomodo a la cuadrícula (con Alt, libre; y se puede apagar).
- [ ] 12 Deshacer/rehacer, teclado, táctil y datos anteriores intactos.
- [ ] 13 Presupuestos y casos límite: ver `docs/acceptance-pulido.md`; `bun run typecheck` y `bun run test` pasan (10 de noviembre de 2026: 2877 pruebas).
