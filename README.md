# Rebalance

Tablero compartido para planificar capacidad y rotaciones de equipos.

## Estado de la migración

La aplicación anterior sigue disponible en `index.html` y `app.html`. La nueva versión se construye en `web/` y `api/` sin reemplazar esos archivos: se puede revisar en un despliegue separado antes de cambiar el sitio público.

La nueva arquitectura usa React + TypeScript, una API Node.js en Render, Neon Postgres y Google OAuth. Todas las cuentas autorizadas tienen permisos completos en esta primera versión. El acceso a producción se controla con `ALLOWED_EMAILS` o `ALLOWED_EMAIL_DOMAIN`.

## Desarrollo local

Requiere Node.js 20.19+ y npm.

```sh
npm ci --include=dev --prefix web
npm ci --include=dev --prefix api
npm run dev --prefix web
npm run dev --prefix api
```

La API necesita las variables de `api/.env.example` cargadas en el entorno. Para desarrollo local, usar `http://localhost:5173/auth/google/callback` como callback de Google y configurar ese mismo URI en Google Cloud; Vite reenvía el callback a la API local en el puerto `8788`. Crear el esquema de Neon con:

```sh
npm run migrate --prefix api
```

## Despliegues previstos

- **Cloudflare Pages:** directorio raíz `web`, comando de build `npm ci --include=dev && npm run build`, salida `dist`. Configurar `RENDER_API_ORIGIN` con la URL del servicio `rebalance-api` en Render. La función de Pages reenvía `/api/*` y `/auth/*` para mantener la sesión en el mismo origen del frontend.
- **Render Web Service:** el archivo `render.yaml` define el servicio `rebalance-api`, sus comandos de build e inicio, el chequeo de salud y las variables necesarias. `DATABASE_URL`, las credenciales OAuth y los emails permitidos se cargan como secretos en Render; `SESSION_SECRET` se genera allí.
- **Neon:** usar la cadena Postgres del pooler y guardarla como `DATABASE_URL` en Render.
- **Google OAuth:** registrar como URI de callback la URL del frontend más `/auth/google/callback`. Guardar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SESSION_SECRET` y la lista de acceso en Render.

El plan gratuito de Render puede dormir la API cuando queda inactiva; Neon también aplica límites de cómputo y almacenamiento. El JSON se puede exportar para respaldar los datos.

## Migrar el estado anterior

Desde la versión actual, exportar un JSON desde el navegador que tenga la copia que se quiera conservar. En la nueva app, iniciar sesión y usar **Importar JSON**. La API valida el archivo y reemplaza el estado de manera transaccional; si los datos no pasan la validación, se rechaza la importación completa.

## Validaciones

```sh
npm test
npm test --prefix api
npm run build
npm run build:new
```

GitHub Actions sigue desplegando la versión anterior en GitHub Pages. El nuevo frontend y la API se compilan en CI, pero no se publican automáticamente todavía.
