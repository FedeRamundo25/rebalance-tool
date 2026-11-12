# Engineering Rebalance Tool

Herramienta web para revisar asignaciones de ingeniería por hito y simular movimientos entre equipos. Esta versión cubre el tablero interactivo, persistencia local y validación automatizada.

## Ejecutar localmente

Requiere Node.js 20 y npm.

```sh
npm ci
npm run dev
```

Vite sirve la landing en `/` y la aplicación en `/app.html`.

## Pruebas y build

```sh
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run build
```

El build genera `dist/index.html` (landing) y `dist/app.html` (aplicación). Para revisar la salida: `npm run preview`.

## Persistencia y copias

Las asignaciones se guardan en el almacenamiento local del navegador. El estado se valida al cargar; si está corrupto o no cumple el formato esperado, la aplicación inicia con los datos predeterminados. Antes de guardar cambios se conserva la última copia válida. La aplicación permite descargar e importar un archivo JSON y restaurar la copia anterior disponible.

## CI y despliegue

`.github/workflows/ci-cd.yml` instala las versiones del lockfile mediante `npm ci`, ejecuta tests unitarios y E2E, construye y verifica las dos páginas. GitHub Pages se publica únicamente en `push` a `main` cuando todos los pasos de validación terminan correctamente. El repositorio debe tener GitHub Pages configurado para GitHub Actions.

## Licencia

Este repositorio no incluye un archivo de licencia. No se declara una licencia de uso.
