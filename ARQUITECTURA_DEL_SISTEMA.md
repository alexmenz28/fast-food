# Arquitectura del sistema — FAST FOOD S.A.

**Tipo de documento:** descripción del **estado actual** del repositorio y del **mapa de carpetas** para completar el caso de estudio (catálogos ya operativos; demás módulos previstos según ER y `PASOS_DESARROLLO.md`).

**Referencias:** `PASOS_DESARROLLO.md` (sprints y HU), `DIAGRAMA_ER_LOGICO_FISICO.md` (dominio), `README.md` (arranque y API).

---

## 1. Convenciones de nomenclatura y orden (frontend + backend)

Estándar único para el monorepo, alineado con lo que ya usáis en su mayoría.

### 1.1 Idioma

| Ámbito | Convención |
|--------|------------|
| Nombres de **carpetas** y **archivos** de dominio | **Español**, sin tildes en paths (`catalogos`, `productos`, `unidades-moviles`). |
| **Sufijos técnicos** de capa | **Inglés** corto: `.routes`, `.schemas`, `.application`, `.ports`, `.persistence`, `.stub`. |
| **API JSON** y mensajes al cliente | Español (como hoy: `nombre`, `activo`, textos de error). |
| **Código** (funciones, variables, tipos TypeScript) | Español donde ya está establecido (`pedir`, `PanelProtegido`); tipos/DTO pueden seguir el vocabulario del API. |

### 1.2 Backend (`apps/backend/src`) y plugins

- **Archivos:** `kebab-case.ts` (incluye varias palabras unidas por guiones: `unidades-moviles.routes.ts`, `auth-gate.ts`).
- **Un módulo HTTP por contexto:** `<contexto>.routes.ts` + `<contexto>.schemas.ts` cuando haya body/query Zod; + `<contexto>.service.ts` mientras exista lógica Prisma inline (patrón en transición).
- **Adaptadores Prisma:** `prisma-<contexto>.persistence.ts` (implementación) o `prisma-<contexto>.persistence.stub.ts` (vacío).
- **Composition:** `<ámbito>-wiring.ts` (ej. `catalogos-wiring.ts`); stubs: `*-wiring.stub.ts`.
- **Entrada / infra:** `app.ts`, `index.ts`, carpeta `lib/` con nombres cortos en kebab-case (`http.ts`, `jwt.ts`). Excepción histórica aceptada: `catalog-put.ts` (política `activo` en PUT); renombrar a `catalogo-put.ts` solo si se unifica con el resto de nombres en español.

**Orden recomendado dentro de un mismo contexto** (lectura y dependencias):

1. `*.schemas.ts` (contratos de entrada)
2. `*.service.ts` o aplicación inyectada
3. `*.routes.ts` (orquesta validación → caso de uso)

En carpetas **hexagonales** del paquete (ver § 3.1): `domain/` → `ports/` → `application/` (de menos a más dependiente).

### 1.3 Paquetes `@fastfood/*`

- Mismas reglas de **kebab-case** en archivos.
- **Dominio:** un archivo por agregado o error común (`producto.ts`, `errors.ts`); nombre de archivo en singular si agrupa tipos de una entidad principal.
- **Puertos:** `<contexto>.ports.ts` o `<contexto>.ports.stub.ts`.
- **Aplicación:** `<contexto>.application.ts` o `.stub.ts`.

### 1.4 Frontend (`apps/web/src`)

| Tipo | Convención | Ejemplos |
|------|------------|----------|
| Páginas y componentes con JSX principal | **PascalCase.tsx**; el archivo coincide con el export principal | `LoginPage.tsx`, `PanelLayout.tsx`, `ModalProducto.tsx` |
| Hooks | Prefijo **`use`** + **camelCase** (convención React); archivo igual al nombre del hook | `useCatalogosApi.ts` → `useCatalogosApi` |
| Config / utilidades sin JSX | **kebab-case** o nombre corto | `config.ts`, `session.ts` |
| Entrada | Convención habitual Vite/React | `main.tsx`, `App.tsx` |
| Tema e iconos (raíz `src/`) | Aceptable **camelCase** (`theme.tsx`, `icons.tsx`) por costumbre de plantillas; **opcional** alinear a `Theme.tsx` / `Icons.tsx` si se busca 100 % PascalCase en “módulos visuales”. |

**Orden dentro de un feature** (recomendado):

1. `components/` (presentación reutilizable del feature)
2. `hooks/`
3. Páginas `*Page.tsx` en la raíz del feature

**Rutas React:** paths en inglés o español según URL deseada (`/login`, `/productos`); mantener una sola convención en el router cuando consolidéis `App.tsx` y `app/routes.tsx`.

### 1.5 Qué habría que tocar si aplicáis el estándar “estricto”

| Acción | Obligatororio | Notas |
|--------|---------------|--------|
| Seguir esta sección en **código nuevo** | Sí (acuerdo de equipo) | No exige renombrar lo viejo de golpe. |
| Actualizar **diagramas / docs** que citen rutas (`UML_*.drawio`, `DIAGRAMA_*.md`) | Solo si renombráis archivos | Hoy citan `catalog-put.ts`, etc. |
| Renombrar `theme.tsx` / `icons.tsx` → `Theme.tsx` / `Icons.tsx` | No | Tres imports en `main`, `LoginPage`, `PanelProtegido`. |
| Renombrar `catalog-put.ts` | No | Tres imports en rutas + comentarios en schemas + docs + drawio. |
| Añadir regla **ESLint** `unicorn/filename-case` o similar | Opcional | Refuerzo automático; configurar por carpeta (PascalCase solo bajo `features/**`). |

**Resumen:** el repo ya cumple casi todo (kebab-case backend, PascalCase en páginas React, sufijos de capa en inglés). Lo pendiente es **documentar** (esta sección) y, si queréis uniformidad total, **renombrados opcionales** de `catalog-put`, `theme` e `icons`.

---

## 2. Visión general

- **Monorepo** npm workspaces: `apps/backend`, `apps/web`, `packages/@fastfood/*`.
- **Despliegue:** monolito modular — **un proceso** de API, **una base PostgreSQL**, SPA en Vite/React. Los **microservicios** no forman parte del alcance actual; la separación por puertos/paquetes deja abierta una evolución futura si el negocio lo requiere.
- **Backend:** Fastify 5, Prisma, JWT; API versionada bajo **`/v1`**. Autenticación y autorización por rol en `plugins/auth-gate.ts` y reglas alineadas con `shared/permissions.ts` en la web.
- **Frontend:** React Router; la experiencia de Sprint 1 está concentrada en `features/panel/PanelProtegido.tsx` y `features/auth/LoginPage.tsx`. Existen **placeholders** (sin UI de negocio) para partir pantallas y hooks cuando se avance.

---

## 3. Principios de organización

| Principio | Significado en este repo |
|-----------|---------------------------|
| Módulo = contexto | Carpetas `modules/<contexto>` en el backend y `features/<contexto>` en la web, alineadas al ER y a las HU. |
| Rutas HTTP estables | Los contratos públicos bajo `/v1/...` se documentan en `README.md` y `requests.http`. |
| Dependencias hacia adentro | Reglas de negocio en paquetes (`@fastfood/catalogos-core`) vía **puertos**; el backend aporta **adaptadores** (Prisma) y **entrada HTTP** (Fastify). |
| Placeholders | Archivos `*.stub.ts` / páginas que devuelven `null` marcan el sitio del código futuro **sin** registrar aún rutas nuevas ni cambiar el comportamiento actual. |

---

## 3.1 Hexagonal en catálogos (productos)

- **Núcleo:** `packages/@fastfood/catalogos-core` — `domain/`, `ports/productos.ports.ts`, `application/productos.application.ts`.
- **Adaptador:** `apps/backend/src/adapters/catalogos/prisma-productos.persistence.ts`.
- **Cableado:** `apps/backend/src/composition/catalogos-wiring.ts`.
- **HTTP:** `apps/backend/src/modules/catalogos/productos.routes.ts` + `productos.schemas.ts`.

**Vendedores** y **unidades móviles** siguen con `*.service.ts` + Prisma en el backend. Los stubs en `catalogos-core` y en `adapters/catalogos/*.stub.ts` indican dónde migrar cuando se replique el patrón de productos.

---

## 3.2 Paquetes `@fastfood/*` en el monorepo

Los paquetes bajo `packages/@fastfood/` concentran **aplicación y dominio sin Fastify ni Prisma**, lo que:

1. Fija una frontera clara entre reglas de negocio e infraestructura.
2. Facilita pruebas con implementaciones en memoria de los puertos.
3. Reduce el coste de extraer un servicio independiente más adelante (opcional).
4. Obliga a un orden de build: el `package.json` raíz compila `@fastfood/catalogos-core` antes que `backend`.

**Paquetes npm futuros (opcional):** si el módulo inventario u operaciones crece, se puede extraer `@fastfood/inventario-core` / `@fastfood/operaciones-core` con el mismo patrón que `catalogos-core`. Hoy la lógica HU5 vive en `modules/operaciones/operaciones.service.ts` junto a las rutas.

---

## 4. Alcance funcional (Release 1 — Sprint 1 y 2)

| HU | Descripción | Estado en código |
|----|-------------|------------------|
| HU1 | Productos / insumos catálogo | Implementado |
| HU2 | Vendedores | Implementado |
| HU3 | Unidades móviles | Implementado |
| HU4 | Inventario almacén central (ingresos, stock, mínimo, alertas, filtro por categoría) | Implementado |
| HU5 | Jornadas y abastecimiento diario (validación de stock, transacción, movimientos SALIDA) | Implementado |

Historias **HU6** (GPS), **HU7** (devoluciones en UI) y **HU8** (reportes), entre otras, **no** están en la interfaz actual; el modelo Prisma conserva tablas (`ubicacion_jornada`, `devolucion`, …) para evolución futura.

---

## 5. Backend — árbol actual

```
apps/backend/src/
├── app.ts, index.ts
├── types/fastify.d.ts
├── lib/          # prisma, jwt, http, catalog-put, constants
├── plugins/auth-gate.ts
├── composition/catalogos-wiring.ts
├── adapters/catalogos/prisma-productos.persistence.ts
├── modules/
│   ├── health/, auth/
│   ├── v1/v1.routes.ts
│   ├── catalogos/   # productos, vendedores, unidades-moviles, unidades-medida
│   ├── inventario/  # inventario.schemas.ts, inventario.service.ts, inventario.routes.ts
│   └── operaciones/ # HU5: operaciones.schemas.ts, operaciones.service.ts, operaciones.routes.ts
```

**Registro en `v1.routes.ts`:** `auth`, `productos`, `vendedores`, `unidades-moviles`, `unidades-medida`, **`inventario`**, **`operaciones`** (rutas planas `/zonas`, `/jornadas`, `/abastecimientos`).

**Convenciones de nombre:** § 1.

---

## 6. API HTTP — estado

| Área | Paths principales |
|------|-------------------|
| Inventario (HU4) | `GET /v1/inventario/almacen`, `GET /v1/inventario/stock`, `POST /v1/inventario/ingresos`, `PATCH /v1/inventario/stock/:idProducto/minimo` |
| Operaciones (HU5) | `GET /v1/zonas`, `GET|POST /v1/jornadas`, `GET /v1/jornadas/:id`, `GET|POST /v1/abastecimientos`, `GET /v1/abastecimientos/:id` |
| Catálogos (HU1–HU3) | Sin cambios respecto a la documentación en `README.md` |

La función `obtenerCantidadDisponible` en `inventario.service.ts` puede reutilizarse en otros flujos de salida; HU5 valida stock dentro de `operaciones.service.ts` en la misma transacción que descuenta.

---

## 7. Paquete `catalogos-core`

```
packages/@fastfood/catalogos-core/src/
├── index.ts
├── domain/errors.ts, domain/producto.ts
├── ports/productos.ports.ts
└── application/productos.application.ts
```

---

## 8. Frontend — árbol actual

```
apps/web/src/
├── main.tsx, App.tsx
├── features/auth/LoginPage.tsx
├── features/panel/PanelProtegido.tsx, CampoActivoCatalogo.tsx
├── features/inventario/InventarioPage.tsx
├── features/operaciones/AbastecimientoDiarioPage.tsx
├── shared/api/config.ts, session.ts, permissions.ts
├── shared/types/catalogos.ts, types/inventario.ts, types/operaciones.ts
├── shared/labels/operaciones.ts
├── theme.tsx, icons.tsx, App.css, index.css, assets/
```

**Rutas bajo el panel:** `/resumen`, `/productos`, `/vendedores`, `/unidades`, `/inventario`, **`/abastecimiento`**.

---

## 9. Próximos pasos (fuera de este alcance)

1. HU6: registro GPS (`ubicacion_jornada`). HU7–HU8: devoluciones en flujo UI y reportes.
2. Hexagonal: migrar vendedores / unidades móviles a `@fastfood/catalogos-core` si se desea la misma simetría que productos.
3. Partir `PanelProtegido` en páginas por archivo solo de catálogos (refactor opcional).

---

## 10. Riesgos y buenas prácticas

| Tema | Recomendación |
|------|----------------|
| Seed | Tras `npm run db:seed`, hay vendedores, unidades, zonas, **jornadas de demo** y un **abastecimiento** de ejemplo (descuenta stock). |
| Stock y nuevos productos | Tras `POST /productos`, se crea fila en `inventario_almacen` con cantidades 0 (HU4). |
| Duplicar tipos | `shared/types/inventario.ts` alineado con la respuesta JSON del API. |
| Imports en core | Sin Fastify/Prisma dentro de `packages/@fastfood/*`. |

---

*Última revisión: Release 1 (Sprint 1 + 2) según `CalidadInforme_caso2` / plan de releases.*
