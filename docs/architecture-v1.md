# Rebalance v1: propuesta de arquitectura

## Objetivo

Pasar el tablero actual a una aplicación multiusuario con una base compartida, conservando las funciones existentes. La versión publicada actual queda disponible hasta completar y revisar la nueva.

## Tecnología propuesta

- **Frontend:** React + TypeScript + Vite, alojado como sitio estático en Cloudflare Pages.
- **API:** Node.js + TypeScript en Render, con endpoints HTTP para autenticación y operaciones del tablero.
- **Base de datos:** Neon Postgres. El navegador nunca se conecta directamente a Neon ni recibe credenciales de base de datos.
- **Primera política de acceso:** cualquier usuario autenticado puede realizar todas las operaciones. Las cuentas/roles con permisos diferenciados quedan para una etapa posterior.

## Modelo de datos inicial

- `users`: identidad de cada persona que usa la app.
- `people`: personas planificadas, incluyendo rol, seniority, modalidad, manager, equipo inicial, warning y freeze.
- `milestones`: hitos y su orden.
- `teams`: equipos disponibles.
- `assignments`: persona, hito, equipo de destino y tipo de rotación. Conserva las rotaciones indefinidas y acotadas.
- `role_needs`: cantidad requerida por equipo, hito y rol.
- `activity_log`: actor, fecha, acción y resumen legible del cambio.

Las modificaciones se guardan dentro de transacciones. Los registros editables tendrán una versión o `updated_at`; si una persona intenta guardar sobre una edición concurrente, la API devuelve un conflicto claro para refrescar y volver a aplicar el cambio. El historial identificará al usuario autenticado.

## API inicial

- `GET /api/session`, `POST /api/auth/...`, `POST /api/logout`
- `GET /api/board`: obtiene personas, equipos, hitos, necesidades e historial en una respuesta consistente.
- `POST /api/people`, `PATCH /api/people/:id`, `DELETE /api/people/:id`
- `POST /api/assignments` y `DELETE /api/assignments/:id`
- `POST /api/milestones`, `PATCH /api/milestones/:id`, `DELETE /api/milestones/:id`
- `PUT /api/role-needs`
- `GET /api/export` y `POST /api/import`, con validación estricta y operación atómica.

Los filtros, roadmap, drag and drop, freeze, warning, edición de necesidades, timeline, registro y exportaciones se mantienen en la interfaz nueva. El drag and drop persistirá la asignación mediante la API.

## Migración de datos

Hoy los cambios hechos desde el navegador solo viven en su `localStorage`; no hay una única copia compartida en el servidor. La migración deberá elegir una exportación JSON como fuente inicial o partir del conjunto incluido en el HTML. La importación al backend validará todo antes de guardar, y conservará el JSON original como respaldo descargable.

## Despliegue sin interrumpir la app actual

Se construirá en una ruta o preview separada. El CI ejecutará validaciones y build. Render y Neon se configuran con variables secretas fuera del repositorio; Cloudflare Pages publica el frontend. La versión actual se reemplazará solo tras revisar que el tablero nuevo conserva sus funciones y validar la migración.

## Autenticación elegida

Se usará Google OAuth. Solo se solicitarán los datos básicos de identidad (openid, email y perfil). Todas las cuentas autorizadas tendrán los mismos permisos de edición en v1. El alta se restringirá mediante una lista de emails permitidos configurada en el backend, para que el tablero no quede abierto a cualquier cuenta Google.

El frontend y la API se alojarán en dominios diferentes; para evitar depender de cookies de terceros, Cloudflare Pages Functions servirá como proxy same-origin para `/api/*` y el callback OAuth hacia Render. La cookie de sesión será HttpOnly, Secure en producción y SameSite=Lax.

## Límites del plan gratuito

Los planes gratuitos pueden dormir servicios, imponer cuotas o cambiar. En Render Free la API puede quedar inactiva y tener una demora de arranque. Neon Free tiene límites de almacenamiento y cómputo. Se añadirá una exportación de respaldo y documentación de recuperación; el despliegue debe monitorear cuotas para evitar sorpresas.
