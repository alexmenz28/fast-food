# FAST FOOD S.A. — Abastecimiento

Monorepo **npm workspaces**: `apps/backend` (Node + Fastify + Prisma) y `apps/web` (Vite + React + TypeScript).

## Requisitos

- **Node.js** 22 o superior  
- **PostgreSQL** (local o contenedor)  
- Copiar `apps/backend/.env.example` → `apps/backend/.env` y ajustar `DATABASE_URL` y `JWT_SECRET`.
- Para **build de producción** de la web, opcional: `apps/web/.env.example` → `.env` con `VITE_API_URL` (origen del API sin `/v1`).

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
- **`npm run db:seed` borra todos los datos de negocio** (usuarios de prueba incluidos) y vuelve a insertar solo el escenario demo. Útil cuando acumulaste datos de prueba y quieres un estado conocido. El catálogo de **unidades de medida** queda únicamente con **UND (Unidad)** y **KG (Kilogramo)**.
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

- API: `http://localhost:3000` — **salud** sin versión: `GET /health`, `GET /health/db`. **Recursos REST** bajo **`/v1`** (p. ej. `POST /v1/auth/login`, `GET /v1/productos`).
- Web: URL que indique Vite (por defecto `http://localhost:5173`). Las peticiones versionadas van a **`/api/v1/...`**; el proxy de Vite reescribe `/api` → origen del backend (`/api/v1/productos` → `http://localhost:3000/v1/productos`).
- **Producción (build de la web):** define `VITE_API_URL` con el origen del API **sin** path de versión (p. ej. `https://api.tudominio.com`); la app concatenará `/v1` sola.
- En la interfaz: **tema claro/oscuro** (persistente en el navegador) y **sidebar colapsable** con iconos al contraer.

## Autenticación y roles

Tras `npm run db:seed` existen tres usuarios cuyo **nombre de usuario coincide con el rol** (mayúsculas):

| Usuario (`nombre_usuario`) | Rol           | Contraseña por defecto                          |
|----------------------------|---------------|-------------------------------------------------|
| `ADMINISTRADOR`            | Administrador | `FastFood2026!` (o la de `SEED_DEMO_PASSWORD`)  |
| `ALMACEN`                  | Almacén       | Igual                                           |
| `SUPERVISOR`               | Supervisor    | Igual                                           |

La contraseña se guarda solo como **hash bcrypt** en base de datos. El login devuelve un **JWT** (8 h); la web lo envía en `Authorization: Bearer …` en cada petición al API.

**Permisos (API y pantalla):**

- **ADMINISTRADOR:** consulta, alta, edición y **desactivación** (baja lógica, `activo: false`) en catálogos; no se borran filas.
- **ALMACEN:** consulta, alta y edición de datos; **no puede cambiar «activo en catálogo»** (solo el administrador, desde Editar y el checkbox del modal).
- **SUPERVISOR:** solo **consulta** (GET); formularios y botones de cambio no se muestran.

Endpoints públicos: `GET /health`, `GET /health/db`, `POST /v1/auth/login`. Con token: `GET /v1/auth/me` y el resto de rutas bajo `/v1/...`.

## API de catálogos base (prefijo `/v1`)

Todas las rutas de esta sección (excepto health) viven bajo **`/v1`** y requieren cabecera `Authorization: Bearer <jwt>` salvo el login.

- `POST /v1/auth/login` — cuerpo JSON `{ "usuario": "ADMINISTRADOR", "contrasena": "…" }` (el usuario se compara en mayúsculas)
- `GET /v1/auth/me` — perfil del token actual
- `GET /v1/unidades-medida` — catálogo de unidades de medida (`id`, `codigo`, `nombre`) para formularios
- `GET | POST | PUT | DELETE /v1/productos` — `DELETE` = baja lógica (inactivo).
- `GET | POST | PUT | DELETE /v1/vendedores` — igual.
- `GET | POST | PUT | DELETE /v1/unidades-moviles` — igual; además cierra la asignación vigente vendedor–unidad.

Notas:
- `PUT` y `DELETE` usan `/:id` (UUID). En la web, **desactivar/reactivar** es con **Editar** y el checkbox «Activo en catálogo» (solo administrador). `DELETE` sigue disponible para integraciones: baja lógica (`activo: false`), sin borrar filas.
- **Productos:** `POST` recibe `nombre`, `tipo`, `idUnidadMedida` (entero); el **código** (`P001`, …) lo genera el servidor. `PUT` no cambia el código.
- **Unidades móviles:** `POST` recibe `zona`, `estado`, `idVendedor` opcional; el **código** (`UM-01`, …) lo genera el servidor. `PUT` no cambia el código.
- `unidades-moviles` permite asignar vendedor con `idVendedor`.
- **Vendedores:** `telefono` se normaliza a solo dígitos (7–15).
- Valores válidos:
  - `tipo` en productos: `ALIMENTO | BEBIDA | INSUMO`
  - `estado` en unidades: `ACTIVA | MANTENIMIENTO | FUERA_DE_SERVICIO`

### Paginación

Los endpoints `GET` de los tres catálogos aceptan:
- `pagina` (entero >= 1)
- `limite` (entero entre 1 y 50)

Ejemplo:

```http
GET /v1/productos?pagina=1&limite=8
```

Respuesta:
- `data`: registros de la página solicitada
- `paginacion`: `{ pagina, limite, total, totalPaginas }`

Pruebas manuales rápidas:
- Usa `apps/backend/requests.http` (REST Client de VS Code/Cursor) o Postman.

## Estructura del código

```
apps/backend/src
  app.ts                 → ensambla Fastify (CORS, auth, rutas)
  index.ts               → arranque
  lib/                   → prisma, http helpers, JWT, constantes (`API_VERSION`)
  plugins/auth-gate.ts   → JWT y permisos por rol
  modules/health/        → GET /health, /health/db
  modules/auth/          → /v1/auth/*
  modules/catalogos/     → productos, vendedores, unidades móviles, unidades medida
  modules/v1/v1.routes.ts → registro de la API versionada
apps/web/src
  App.tsx                → rutas React
  features/auth/         → login
  features/panel/      → panel y catálogos (Sprint 1)
  shared/api/config.ts   → `API_V1_URL` (/api/v1 en dev)
  shared/session.ts, shared/permissions.ts, shared/types/
```

## Documentación de datos

- Modelo completo (ER + lógico + físico): `DIAGRAMA_ER_LOGICO_FISICO.md`
