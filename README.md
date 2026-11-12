# Rebalance

Tablero de planificación de capacidad y rotaciones de ingeniería. La aplicación conserva la experiencia del HTML original e incluye hitos configurables, filtros, freeze y warning, drag and drop, roadmap, necesidades por rol, historial, e importación y exportación de escenarios.

## Ejecutar localmente

Requiere Node.js 20 y npm.

```sh
npm ci
npm run dev
```

La landing está en `/` y el tablero completo en `/app.html`.

## Funciones

- Gestionar hitos: crear, renombrar y eliminar escenarios.
- Filtrar integrantes por persona, rol, seniority, manager, estado y equipo.
- Marcar warning y congelar integrantes para impedir movimientos.
- Arrastrar personas entre equipos para crear rotaciones indefinidas; editar asignaciones por hito para rotaciones acotadas.
- Revisar la distribución futura en el roadmap y el historial de cambios.
- Configurar necesidades por rol para uno o varios hitos y revisar vacantes pendientes o excesos.
- Exportar e importar configuración, asignaciones e historial en JSON; exportar el historial en CSV.

Los cambios se guardan en `localStorage`. La lectura valida cada estructura, recupera una copia anterior cuando existe y usa los datos iniciales si el navegador bloquea el almacenamiento o el JSON está corrupto. También se puede restaurar la última copia válida desde la interfaz.

## Pruebas y build

```sh
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run build
```

El build genera `dist/index.html` y `dist/app.html`. El workflow de GitHub instala con `npm ci`, ejecuta pruebas unitarias y E2E, valida el build y despliega GitHub Pages solo tras pasar todos los pasos.
