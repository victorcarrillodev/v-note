# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]
### Agregado
- Bloques de estudio: ecuaciones (KaTeX), diagramas por texto (Mermaid) y tarjetas con repaso espaciado (vista «Repaso»).
- Plantillas desde «/»: apuntes de clase, algoritmo y comparativa de estructuras.
- Zoom de la página con Ctrl + rueda, con indicador y controles.
- Licencia MIT.
- Bloques de código ejecutables (JavaScript y Python) en un entorno aislado: sin red ni acceso a la aplicación, con límite de tiempo, memoria y salida. Python y JavaScript se empaquetan con la app (unos 14 MB, solo se cargan al ejecutar).
- Ecuaciones en línea (`$…$`); importar Markdown con `$$` y ```` ```mermaid ````; los diagramas Mermaid se exportan dibujados.
- Generar tarjetas de repaso desde las notas (Ctrl+Alt+G o «/») y estadísticas en la vista Repaso.
- Plantillas de diagrama de flujo, entidad-relación y UML, y enlazar una forma del lienzo con una página.
- Respaldo unificado: todos los espacios en un solo destino (carpeta local, Google Drive, Dropbox o GitHub) que se actualiza en el lugar, sin copias repetidas; respaldo continuo al dejar de escribir y «Restaurar todo».

### Cambiado
- Portadas más bajas: 180, 260 y 340 px.
- Con el título sobre la portada, las opciones baja, media y alta vuelven a distinguirse.
- Conversión de bloques, cabecera con portada e índice en los márgenes.

### Corregido
- La portada acompaña sin retraso a la barra lateral al abrirla o cerrarla.
- El editor ya no muestra un marco azul alrededor del contenido.

### Seguridad
- La política de seguridad permite WebAssembly (`wasm-unsafe-eval`) para ejecutar código en un Worker; `eval` sigue prohibido.
- Política de seguridad de contenido (CSP) en la app de escritorio.
- Conexión con Google Drive y Dropbox por OAuth con PKCE (sin secreto de cliente); los tokens van solo al llavero del sistema.

## [0.0.2]
### Corregido
- Compilación en Windows y macOS.
