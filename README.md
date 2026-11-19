# Rebalance

Tablero compartido para planificar capacidad y rotaciones de equipos.

## Estado de la migración

La aplicación anterior sigue disponible en `index.html` y `app.html`. La nueva versión se construye en `Web/` y `api/`; Cloudflare Pages usa `Web/` como directorio raíz.

La nueva arquitectura usa React + TypeScript, una API Node.js en Render, Neon Postgres y Google OAuth. Todas las cuentas autorizadas tienen permisos completos en esta primera versión. El acceso a producción se controla con `ALLOWED_EMAILS` o `ALLOWED_EMAIL_DOMAIN`.

## Desarrollo local

Requiere Node.js 20.19+ y npm.

```sh
npm ci --include=dev --prefix Web
npm ci --include=dev --prefix api
npm run dev --prefix Web
npm run dev --prefix api
```

La API necesita las variables de `api/.env.example` cargadas en el entorno. Para desarrollo local, usar `http://localhost:5173/auth/google/callback` como callback de Google y configurar ese mismo URI en Google Cloud; Vite reenvía el callback a la API local en el puerto `8788`. Crear el esquema de Neon con:

```sh
npm run migrate --prefix api
```

## Reportar un bug

En GitHub, abrí **Issues → Reportar un bug** y completá los pasos para reproducirlo, el resultado esperado y el resultado observado. Incluí la pantalla, navegador y evidencia cuando ayude. No adjuntes credenciales ni información real de personas; usá los nombres ficticios de prueba.

Las verificaciones de CI prueban la lógica, las interacciones en navegador y el build del frontend y la API. Después, una comprobación de producción confirma que Cloudflare sirve el mismo commit probado, conserva la interfaz de Rebalance y puede alcanzar el endpoint de salud de la API.

## Despliegues previstos

- **Cloudflare Pages:** directorio raíz `web`, comando de build `npm ci --include=dev && npm run build`, salida `dist`. Configurar `RENDER_API_ORIGIN` con la URL del servicio `rebalance-api` en Render. La función de Pages reenvía `/api/*` y `/auth/*` para mantener la sesión en el mismo origen del frontend.
- **Render Web Service:** el archivo `render.yaml` define el servicio `rebalance-api`, sus comandos de build e inicio, el chequeo de salud y las variables necesarias. Las dos cadenas de conexión y las credenciales OAuth se cargan como secretos en Render; `SESSION_SECRET` se genera allí.
- **Neon:** usar la cadena del pooler como `DATABASE_URL` para las consultas normales de la API y la cadena directa como `DATABASE_URL_UNPOOLED` para migraciones.
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
