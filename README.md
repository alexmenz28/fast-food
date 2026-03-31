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
npx prisma db push
npm run db:seed
```

Base actual de modelado completo: `fastfood_abastecimiento_es`.

Notas importantes:
- El esquema físico está definido en español (tablas, columnas y mapeos físicos de enums).
- Si necesitas reconstruir todo desde cero en desarrollo:

```bash
npx prisma db push --force-reset
npm run db:generate
npm run db:seed
```

## Desarrollo

**Backend y frontend a la vez** (recomendado):

```bash
npm run dev:all
```

O en dos terminales por separado:

```bash
npm run dev:backend
```

```bash
npm run dev:web
```

- API: `http://localhost:3000` (`GET /health`, `GET /health/db`)  
- Web: URL que indique Vite (por defecto `http://localhost:5173`).
- En la interfaz: **tema claro/oscuro** (persistente en el navegador) y **sidebar colapsable** con iconos al contraer.

## API de catálogos base

- `GET | POST | PUT | DELETE /productos`
- `GET | POST | PUT | DELETE /vendedores`
- `GET | POST | PUT | DELETE /unidades-moviles`

Notas:
- `PUT` y `DELETE` usan `/:id` (UUID).
- `unidades-moviles` permite asignar vendedor con `idVendedor`.
- Valores válidos:
  - `tipo` en productos: `ALIMENTO | BEBIDA | INSUMO`
  - `estado` en unidades: `ACTIVA | MANTENIMIENTO | FUERA_DE_SERVICIO`

### Paginación

Los endpoints `GET` de los tres catálogos aceptan:
- `pagina` (entero >= 1)
- `limite` (entero entre 1 y 50)

Ejemplo:

```http
GET /productos?pagina=1&limite=8
```

Respuesta:
- `data`: registros de la página solicitada
- `paginacion`: `{ pagina, limite, total, totalPaginas }`

Pruebas manuales rápidas:
- Usa `apps/backend/requests.http` (REST Client de VS Code/Cursor) o Postman.

## Estructura

```
apps/backend   → API REST, Prisma, PostgreSQL
apps/web       → Interfaz React
```

## Documentación de datos

- Modelo completo (ER + lógico + físico): `DIAGRAMA_ER_LOGICO_FISICO.md`
