# FAST FOOD S.A. — Abastecimiento

Monorepo **npm workspaces**: `apps/backend` (Node + Fastify + Prisma) y `apps/web` (Vite + React + TypeScript).

## Requisitos

- **Node.js** 22 o superior  
- **PostgreSQL** (local o contenedor)  
- Copiar `apps/backend/.env.example` → `apps/backend/.env` y ajustar `DATABASE_URL`.

## Instalación

```bash
npm install
```

## Base de datos

```bash
cd apps/backend
npx prisma migrate dev --name init
npm run db:seed
```

(Sin migraciones aún: `npx prisma db push` también aplica el esquema.)

## Desarrollo

Dos terminales:

```bash
npm run dev:backend
```

```bash
npm run dev:web
```

- API: `http://localhost:3000` (`GET /health`, `GET /health/db`)  
- Web: URL que indique Vite (por defecto `http://localhost:5173`).
- En la interfaz: **tema claro/oscuro** (persistente en el navegador) y **sidebar colapsable** con iconos al contraer.

## Sprint 1 API (HU1, HU2, HU3)

- `GET | POST | PUT | DELETE /products`
- `GET | POST | PUT | DELETE /sellers`
- `GET | POST | PUT | DELETE /mobile-units`

Notas:
- `PUT` y `DELETE` usan `/:id` (CUID).
- `mobile-units` permite asignar vendedor con `sellerId`.
- Valores válidos:
  - `type` en productos: `FOOD | DRINK | SUPPLY`
  - `status` en unidades: `ACTIVE | MAINTENANCE | OUT_OF_SERVICE`

Pruebas manuales rápidas:
- Usa `apps/backend/requests.http` (REST Client de VS Code/Cursor) o Postman.

## Estructura

```
apps/backend   → API REST, Prisma, PostgreSQL
apps/web       → Interfaz React
```
