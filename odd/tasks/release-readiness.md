---
feature: release-readiness
status: active
created: 2026-11-25
updated: 2026-11-25
test-runner: bun run typecheck && bun run test
---
## Specs
- S1: "empieza por el punto 1 entonces" (actualizaciones, firma, CSP, README/LICENSE/CHANGELOG)
- S2: "voy a hacer el repo publico [...] que sea libre pero que si quieren pueden donarme. [...] no voy a comprar nada de momento para la firma"
- S3: "presionando control + scroll pueda hacer zoom a la pagina [...] indicador del zoom, con controles [...] mas o menos zoom y resetear"
- S4: "este resaltado azul del contenedor de los componentes no quiero que esté"
- S5: "cambiala al MIT la licencia, haz que no aparezcan los correos, ninguno, y de momento no publicaremos ningun onstalador y sobre las donaciones aun no lo veremos"
- S6: zoom "Solo el contenido" (respuesta a la pregunta sobre componentes)
- S7: "quiero que hagas menos altos las tres opciones del alto de portada de las paginas"

## Tareas
- [ ] T-1 (S1) CSP estricta en la app de escritorio, con prueba de hosts permitidos
- [x] T-2 (S1) README y CHANGELOG
- [x] T-3 (S5) LICENSE MIT
- [ ] T-4 (S5) Aviso de versión e instaladores: pospuesto
- [x] T-5 (S2) Sin firma de Windows por decisión del usuario
- [x] T-6 (S3) Zoom de página con Ctrl + rueda e indicador
- [x] T-7 (S4) Quitar el marco azul del editor
- [ ] T-8 (S5) Donaciones: pospuesto
- [ ] T-9 (S5) Quitar los correos antes de publicar el repositorio
- [x] T-10 (S7) Portadas más bajas (180/260/340 px)

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | `bun run typecheck && bun run test`; `bun run tauri build --no-bundle` | 3589 pruebas pasan y compila; falta verificar a mano la app con la CSP | 2026-11-25 |
| T-2 | `bun run test` | Pasa (incluye brand-hardcode) | 2026-11-25 |
| T-6, T-7 | `bun run typecheck && bun run test`; `bun run test:e2e pageZoomWeb` (Chrome) y capturas al 150 % | Pasan; falta ver en WebKitGTK (escritorio) | 2026-11-25 |
