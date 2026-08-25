# Rumba Liguria Events

Web de eventos y fiestas de Rumba Liguria: listado de eventos, reservas con entradas QR, panel de administración, galería y sección de alquileres.

Construida con [Next.js 15](https://nextjs.org) (App Router), [Supabase](https://supabase.com) (base de datos + storage), [Resend](https://resend.com) (emails) y Tailwind CSS.

## Requisitos

- Node.js 20+
- Una cuenta de Supabase (plan gratuito sirve)
- Una cuenta de Resend para los emails de confirmación

## Configuración

### 1. Crear el proyecto de Supabase

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto nuevo.
2. Abre **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Esto crea todas las tablas (`users`, `events`, `reservations`, `admin_settings`, `gallery`, `comments`) y el bucket de storage `flyers`.
3. En **Project Settings → API** copia la URL del proyecto, la `anon key` y la `service_role key`.

> ⚠️ **Importante (plan gratuito):** Supabase pausa los proyectos gratuitos tras ~1 semana sin uso y los **elimina definitivamente** si quedan pausados mucho tiempo. Entra al dashboard de vez en cuando o activa un plan de pago para no perder la base de datos.

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores:

```bash
cp .env.example .env.local
```

### 3. Ejecutar en local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

- Panel de administración: `/admin` (usuario/contraseña de `ADMIN_USERNAME`/`ADMIN_PASSWORD`, o los guardados en la tabla `admin_settings`).
- Verificación de entradas QR: `/verify/[codigo]`.

## Deploy en Vercel

1. Importa este repositorio en [vercel.com/new](https://vercel.com/new).
2. Añade en **Environment Variables** todas las variables de `.env.example`.
3. Deploy. Listo.

## Estructura

```
src/
  app/            Páginas (home, /admin, /verify/[code])
  app/api/        Rutas API (events, reservations, users, auth, gallery, ...)
  components/ui/  Componentes de interfaz (shadcn/ui)
  lib/            Supabase, emails, configuración codificada
supabase/
  schema.sql      Esquema completo de la base de datos
```
