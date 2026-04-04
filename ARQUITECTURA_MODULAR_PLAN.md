# Plan de arquitectura modular — FAST FOOD S.A.

**Estado:** implementado en código (backend modular + API `/v1`, frontend con `features/` y `shared/`). Este documento sigue siendo la referencia de convenciones y pasos para futuros módulos (inventario, abastecimiento, etc.).

Documento original de **propuesta y pasos de migración** (aprobado por el equipo).

**Alineación:** `PASOS_DESARROLLO.md` (sprints y HU), `DIAGRAMA_ER_LOGICO_FISICO.md` (dominio y evolución).

---

## 1. Objetivo

Pasar de un **monolito en pocos archivos grandes** (`index.ts`, `App.tsx`) a un **monolito modular**: misma API y misma SPA, código agrupado por **módulos de negocio** para facilitar sprints posteriores (inventario, jornadas/GPS, abastecimiento, devolución, reportes, usuarios, auditoría).

**No** se propone microservicios en esta fase.

---

## 2. Principios

| Principio | Significado práctico |
|-----------|----------------------|
| Módulo = contexto del caso | Carpetas nombradas como en el ER / las HU (catálogos, inventario, operación, etc.). |
| Rutas HTTP estables | Los paths públicos pueden mantenerse; por dentro se registran con `app.register()` por plugin. |
| Dependencias hacia adentro | Los módulos de dominio no importan rutas HTTP; las rutas llaman a servicios/funciones del módulo. |
| Frontend por feature | Pantallas y hooks cerca del flujo (productos, vendedores, …), layout y auth compartidos. |

---

## 3. Backend — estructura de carpetas propuesta

```
apps/backend/src/
├── app.ts                 # Crea Fastify, plugins globales (cors), hook auth, listen
├── lib/
│   ├── prisma.ts          # PrismaClient singleton
│   ├── auth.ts            # JWT, verificación Bearer, tipos FastifyRequest
│   └── errors.ts          # mapPrismaError, badRequest (opcional)
├── modules/
│   ├── health/
│   │   └── health.routes.ts
│   ├── auth/
│   │   ├── auth.schemas.ts    # Zod login, etc.
│   │   └── auth.routes.ts
│   ├── catalogos/           # Sprint 1 + base para todo
│   │   ├── productos.schemas.ts
│   │   ├── productos.service.ts
│   │   ├── productos.routes.ts
│   │   ├── vendedores.schemas.ts
│   │   ├── vendedores.service.ts
│   │   ├── vendedores.routes.ts
│   │   ├── unidades-moviles.schemas.ts
│   │   ├── unidades-moviles.service.ts
│   │   ├── unidades-moviles.routes.ts
│   │   └── unidades-medida.routes.ts
│   ├── inventario/            # Sprint 2 (HU4) — placeholder o vacío al inicio
│   ├── operacion/             # Jornada, zona, GPS (Sprint 3–4)
│   ├── abastecimiento/        # HU5, HU7
│   ├── reportes/              # HU9, HU8
│   └── gobierno/              # HU10 usuarios extendido, HU11 auditoría consulta
└── index.ts                   # Punto de entrada mínimo: import app, registrar módulos, listen
```

**Convención de archivos**

- `*.schemas.ts` — validación Zod (entrada/salida si aplica).
- `*.service.ts` — lógica + Prisma (o llamadas a funciones puras de `*.domain.ts` si crece).
- `*.routes.ts` — `FastifyPluginAsync`: define prefijos y handlers delgados.

---

## 4. Backend — ejemplo de rutas HTTP (sin cambiar contrato público)

Se puede **conservar los mismos paths** que hoy usa la web y `requests.http`, moviendo solo el registro interno.

| Método | Path (implementado) | Módulo | Archivo que lo registra |
|--------|---------------------|--------|-------------------------|
| GET | `/health` | health | `health.routes.ts` |
| GET | `/health/db` | health | `health.routes.ts` |
| POST | `/v1/auth/login` | auth | `auth.routes.ts` |
| GET | `/v1/auth/me` | auth | `auth.routes.ts` |
| GET/POST/PUT/DELETE | `/v1/productos`, `/v1/productos/:id` | catalogos | `productos.routes.ts` |
| GET/POST/PUT/DELETE | `/v1/vendedores`, `/v1/vendedores/:id` | catalogos | `vendedores.routes.ts` |
| GET/POST/PUT/DELETE | `/v1/unidades-moviles`, `.../:id` | catalogos | `unidades-moviles.routes.ts` |
| GET | `/v1/unidades-medida` | catalogos | `unidades-medida.routes.ts` |

**Ejemplo de registro en `app.ts` (ilustrativo):**

```ts
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(productosRoutes, { prefix: "/productos" }); // o prefix vacío si las rutas llevan path completo
```

**Futuro (Sprint 2+), mismo esquema:**

| Path (ejemplo) | Módulo |
|----------------|--------|
| `/inventario/...`, `/almacenes/...` | inventario |
| `/jornadas/...`, `/ubicaciones/...` | operacion |
| `/abastecimientos/...`, `/devoluciones/...` | abastecimiento |
| `/reportes/...` | reportes |

Los paths exactos se definen cuando se implemente cada HU.

---

## 5. Frontend — estructura de carpetas propuesta

```
apps/web/src/
├── main.tsx
├── App.tsx                    # Solo Router + providers; sin 1000 líneas de pantalla
├── app/
│   ├── routes.tsx             # Definición de <Routes> importando páginas
│   └── layout/
│       ├── PanelLayout.tsx    # Sidebar, topbar, outlet
│       └── AuthLayout.tsx     # Login
├── features/
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── catalogos/
│   │   ├── ProductosPage.tsx
│   │   ├── VendedoresPage.tsx
│   │   ├── UnidadesPage.tsx
│   │   ├── hooks/
│   │   │   └── useCatalogosApi.ts   # pedir, cargar listas, paginación compartida si aplica
│   │   └── components/
│   │       └── ModalProducto.tsx    # cuando se extraiga del monolito
│   ├── resumen/
│   │   └── ResumenPage.tsx
│   ├── inventario/            # placeholder Sprint 2
│   └── ...
├── shared/
│   ├── api/
│   │   ├── client.ts          # API_BASE, fetch con token, manejo 401
│   │   └── types.ts           # tipos DTO compartidos (opcional)
│   ├── hooks/
│   │   └── useSession.ts
│   └── permissions.ts         # puedeCrearEditar, puedeEliminarCatalogo, etiquetaRol
├── theme.tsx
├── icons.tsx
└── App.css / index.css
```

**Rutas React (ejemplo, equivalentes a las actuales):**

| Ruta | Componente |
|------|------------|
| `/login` | `features/auth/LoginPage.tsx` |
| `/*` (panel) | `PanelLayout` + hijos |
| `/resumen` | `ResumenPage` |
| `/productos` | `ProductosPage` |
| `/vendedores` | `VendedoresPage` |
| `/unidades` | `UnidadesPage` |

---

## 6. Pasos de migración (orden recomendado)

Ejecutar **en PRs pequeños**; tras cada paso, `npm run build` en backend y web, y prueba manual de login + catálogos.

### Fase A — Backend sin romper la API

1. Crear `src/lib/prisma.ts` y mover `PrismaClient` allí; `index.ts` importa desde `lib`.
2. Crear `src/lib/auth.ts` con secreto JWT, `preHandler` o función `attachAuth`, y tipos `FastifyRequest`.
3. Extraer **`health`** a `modules/health/health.routes.ts` y registrar desde `app.ts`.
4. Extraer **`auth`** (`/auth/login`, `/auth/me`) a `modules/auth/`.
5. Extraer **productos** (schemas + handlers + funciones auxiliares solo de producto) a `modules/catalogos/productos.*`.
6. Repetir para **vendedores**, **unidades móviles**, **unidades medida**.
7. Dejar `index.ts` o `app.ts` como **orquestador** (~50–100 líneas): `Fastify()`, `register(cors)`, `register(authHook)`, `register` de cada módulo, `listen`.
8. Actualizar `requests.http` solo si cambia el host/puerto (no debería).

### Fase B — Frontend sin cambiar UX

1. Crear `shared/api/client.ts` con `API_BASE`, `parseSesion`, `pedir`, headers Bearer, redirección 401.
2. Crear `shared/permissions.ts` con funciones de rol ya usadas en `App.tsx`.
3. Extraer **`LoginPage`** a `features/auth/LoginPage.tsx`.
4. Extraer **`PanelLayout`** (sidebar + topbar + `Outlet`) a `app/layout/PanelLayout.tsx`.
5. Extraer una pantalla a la vez: **Resumen**, **Productos**, **Vendedores**, **Unidades** → `features/catalogos/*` o `features/resumen/*`.
6. Reducir `App.tsx` a `<Routes>` que deleguen en layout y páginas.
7. (Opcional) Extraer modales/tablas a `components` dentro de cada feature.

### Fase C — Sprints siguientes

1. Al iniciar **Sprint 2 (inventario)**, crear `modules/inventario/` y `features/inventario/` siguiendo el mismo patrón.
2. Repetir para **operacion**, **abastecimiento**, **reportes**, **gobierno**.

---

## 7. Criterios de “hecho” para esta refactorización

- [ ] Misma funcionalidad observable (login, CRUD catálogos, permisos por rol).
- [ ] Mismos paths REST que antes (salvo lista explícita de cambios acordada).
- [ ] Build backend y frontend sin errores.
- [ ] README actualizado con la nueva estructura de carpetas (una sección breve).

---

## 8. Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| Conflictos de git en `App.tsx` / `index.ts` | Migrar por módulos; quien tenga rama activa coordina el orden de merge. |
| Regresiones en auth | Probar `POST /auth/login`, `GET /auth/me`, 401 sin token, 403 supervisor. |
| Imports circulares | Servicios no importan `routes`; solo `routes` → `service` → `prisma`. |

---

## 9. Aprobación (histórico)

- [x] API REST versionada bajo **`/v1`**; **`/health`** y **`/health/db`** permanecen sin versión.
- [x] Fase A (backend) y Fase B esencial (frontend: `shared/`, `features/auth`, `features/panel`) aplicadas.
- [ ] Fase B opcional: partir `PanelProtegido` en páginas por archivo (`ProductosPage`, …) y hooks dedicados.

---

*Documento generado como plan de trabajo; los fragmentos de código son ilustrativos.*
