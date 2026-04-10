# FAST FOOD S.A. — Abastecimiento

**Alcance implementado:** Release 1 (**Sprint 1:** HU1–HU3 catálogos; **Sprint 2:** HU4 inventario almacén central + **HU5** abastecimiento diario con jornadas). No hay UI ni API de GPS (HU6), devoluciones ampliadas ni reportes (HU7+).

Monorepo **npm workspaces**: `apps/backend` (Node + Fastify + Prisma), `apps/web` (Vite + React + TypeScript) y paquetes internos en **`packages/@fastfood/*`** (por ahora `@fastfood/catalogos-core`: reglas de negocio y puertos del contexto catálogos, sin acoplar a HTTP ni Prisma). Arquitectura del sistema, **convenciones de nomenclatura** (§ 1) y mapa de carpetas: `ARQUITECTURA_DEL_SISTEMA.md`.

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
npx prisma migrate deploy
npm run db:seed
```

En desarrollo también puedes usar `npx prisma db push` en lugar de `migrate deploy` si no usas historial de migraciones. **Antes del seed**, aplica todas las migraciones pendientes (`migrate deploy` o `db push`) para que el esquema coincida con `schema.prisma`; si el seed falla por columnas o tablas faltantes, sincroniza la BD y vuelve a ejecutarlo.

Desde la **raíz** del monorepo: `npm run db:seed` (equivale al script del workspace `backend`).

Para **vaciar la base, reaplicar todas las migraciones y ejecutar el seed** en un solo paso (útil en desarrollo; **destructivo**):

```bash
npm run db:reset
```

Equivale a `prisma migrate reset --force` en `apps/backend` (el seed está declarado en `package.json` del backend y se lanza al final del reset).

Base actual de modelado completo: `fastfood_abastecimiento_es`.

Notas importantes:
- El esquema físico está definido en español (tablas, columnas y mapeos físicos de enums).
- **`npm run db:seed` borra todos los datos de negocio** (usuarios de prueba incluidos) y vuelve a insertar el escenario **Release 1**: **3 vendedores**, **3 unidades móviles** (cada una con **placa** obligatoria) con asignación vigente, **3 zonas**, almacén central `ALM-01`, stock inicial (un producto demo **bajo mínimo**), **3 jornadas** de ejemplo (2 planificadas sin entrega + 1 ya abastecida con movimientos de salida). Unidades de medida: **UND** y **KG**.
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

Este script **compila** `@fastfood/catalogos-core` y luego levanta **Fastify** y **Vite** en paralelo. Es el comando adecuado para **probar el sistema a mano** (navegador: login, catálogos, inventario, etc.).

### ¿Alcanza con `npm run dev:all` para las pruebas?

| Tipo | ¿Con solo `dev:all`? | Notas |
|------|----------------------|--------|
| **Pruebas manuales** (UI + API vía proxy) | **Sí**, si ya cumples los requisitos de abajo | Abre la URL de Vite (p. ej. `http://localhost:5173`). |
| **Tests automatizados** (unitarios / E2E) | **No** | Hoy el repo no define `npm test`; no se lanzan con `dev:all`. |

**Requisitos además del comando** (una vez por máquina o tras clonar):

1. **PostgreSQL** en ejecución y `apps/backend/.env` con `DATABASE_URL` y `JWT_SECRET`.
2. **Esquema y datos:** desde `apps/backend`, al menos una vez: `npx prisma db push` y `npm run db:seed` (o el flujo con `--force-reset` de la sección Base de datos).

Sin la base de datos lista, el backend fallará al arrancar aunque uses `dev:all`.

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

- **ADMINISTRADOR:** consulta, alta, edición y **desactivación** (baja lógica, `activo: false`) en catálogos; no se borran filas. En **inventario:** registrar ingresos y editar stock mínimo. En **operaciones (HU5):** crear jornadas y registrar abastecimientos.
- **ALMACEN:** consulta, alta y edición de catálogos; **no puede cambiar «activo en catálogo»** (solo el administrador). En **inventario:** igual que administrador. En **operaciones:** igual (jornadas y abastecimientos).
- **SUPERVISOR:** solo **consulta** (GET); formularios y botones de cambio no se muestran; en inventario y abastecimiento solo visualiza listados y detalle.

Endpoints públicos: `GET /health`, `GET /health/db`, `POST /v1/auth/login`. Con token: `GET /v1/auth/me` y el resto de rutas bajo `/v1/...`.

## API de catálogos base (prefijo `/v1`)

Todas las rutas de esta sección (excepto health) viven bajo **`/v1`** y requieren cabecera `Authorization: Bearer <jwt>` salvo el login.

- `POST /v1/auth/login` — cuerpo JSON `{ "usuario": "ADMINISTRADOR", "contrasena": "…" }` (el usuario se compara en mayúsculas)
- `GET /v1/auth/me` — perfil del token actual
- `GET /v1/unidades-medida` — catálogo de unidades de medida (`id`, `codigo`, `nombre`) para formularios
- `GET /v1/productos/categorias` — categorías de producto activas (`id`, `nombre`) para formularios; nuevas categorías solo en BD
- `GET | POST | PUT | DELETE /v1/productos` — `DELETE` = baja lógica (inactivo).
- `GET | POST | PUT | DELETE /v1/vendedores` — igual.
- `GET | POST | PUT | DELETE /v1/unidades-moviles` — igual; además cierra la asignación vigente vendedor–unidad.
- `GET /v1/unidades-moviles/estados` — estados operativos activos (`id`, `codigo`, `nombre`) para formularios; nuevas filas solo en BD (`catalogo_estado_unidad_movil`).

### Inventario almacén central (HU4)

- `GET /v1/inventario/almacen` — almacén central por defecto (`ALM-01` en seed).
- `GET /v1/inventario/stock?pagina=&limite=&idCategoria=` — stock por producto activo; cada ítem incluye `bajoMinimo` cuando la cantidad actual es menor que el mínimo configurado.
- `POST /v1/inventario/ingresos` — cuerpo `{ "idProducto", "cantidad", "fechaHora?" (opcional), "nota?" }`; crea movimiento `ENTRADA` y actualiza `cantidad_actual` (usuario del token = responsable).
- `PATCH /v1/inventario/stock/:idProducto/minimo` — cuerpo `{ "cantidadMinima" }` para umbrales de alerta.

Al crear un **producto nuevo** (`POST /v1/productos`), el backend crea la fila de stock en almacén central con cantidades **0** para poder registrar el primer ingreso.

### Jornadas y abastecimiento diario (HU5)

- `GET /v1/zonas` — zonas de operación activas (`id`, `nombre`) para planificar jornadas.
- `GET /v1/jornadas?pagina=&limite=&pendienteAbastecimiento=` — listado paginado; `pendienteAbastecimiento=true` filtra jornadas **planificadas** aún sin abastecimiento registrado.
- `GET /v1/jornadas/:id` — detalle de jornada (unidad, vendedor, zona, fechas, estado, si ya tiene abastecimiento).
- `POST /v1/jornadas` — cuerpo `{ idUnidad, idVendedor, idZona, fechaOperacion (YYYY-MM-DD), horaInicio, horaFin }` (HH:mm o HH:mm:ss). **horaFin es obligatoria.** Ambas horas deben caer en el **horario nocturno de operación 18:00–03:00** (puede cruzar medianoche; p. ej. inicio 20:00 y fin 03:00) y cumplir orden coherente (inicio por la tarde y fin en madrugada, o ambas por la tarde con fin posterior al inicio, o ambas en madrugada con fin no anterior al inicio). Exige **asignación vigente** vendedor–unidad. Estado inicial: planificada.
- `GET /v1/abastecimientos?pagina=&limite=` — historial de entregas desde almacén central.
- `GET /v1/abastecimientos/:id` — cabecera, jornada asociada y líneas (producto, cantidad entregada).
- `POST /v1/abastecimientos` — cuerpo `{ idJornada, lineas: [{ idProducto, cantidad }], nota?, entregadoEn? }`. Solo si la jornada está **planificada** y **sin** abastecimiento previo. En una **transacción**: valida stock en almacén central, crea cabecera/detalle, descuenta `inventario_almacen`, registra movimientos `SALIDA` con referencia `ABASTECIMIENTO`, y pasa la jornada a **en curso**. El usuario del token es quien figura como responsable de la entrega.

Notas:
- `PUT` y `DELETE` usan `/:id` (UUID). En la web, **desactivar/reactivar** es con **Editar** y el checkbox «Activo en catálogo» (solo administrador). `DELETE` sigue disponible para integraciones: baja lógica (`activo: false`), sin borrar filas.
- **Productos:** `POST` recibe `nombre`, `idCategoria`, `idUnidadMedida` (enteros; la categoría debe existir y estar activa); el **código** (`P001`, …) lo genera el servidor. `PUT` no cambia el código.
- **Unidades móviles:** `POST`/`PUT` reciben **`placa` obligatoria** (1–20 caracteres), `descripcion` opcional, `idEstadoOperativo` (entero; fila activa del catálogo), `idVendedor` opcional; el **código** (`UM-01`, …) lo genera el servidor. `PUT` no cambia el código. Si se envía `fechaFinAsignacion`, debe existir `fechaInicioAsignacion` y la fin no puede ser anterior a la inicio. La **zona** de cada salida no está en la unidad: se envía en **`POST /jornadas`** como `idZona`.
- `unidades-moviles` permite asignar vendedor con `idVendedor`.
- **Vendedores:** `telefono` se normaliza a solo dígitos (7–15).

### Catálogos en base de datos (escalables sin tocar enums en código)

| Concepto | Origen | Endpoint listado |
|----------|--------|-------------------|
| Categoría de producto | `categoria_producto` | `GET /v1/productos/categorias` |
| Unidad de medida | `unidad_medida` | `GET /v1/unidades-medida` |
| Estado operativo unidad móvil | `catalogo_estado_unidad_movil` | `GET /v1/unidades-moviles/estados` |

**Unidad de medida** ya era 100 % datos: el seed solo inserta UND/KG como política de negocio; nuevas filas activas en BD aparecen en el panel sin cambiar TypeScript.

**Roles de usuario** (`ADMINISTRADOR`, `ALMACEN`, `SUPERVISOR`) siguen siendo filas en `rol` pero la **autorización** (quién puede borrar, quién ignora `activo` en PUT, etc.) está en código (`auth-gate`, `permissions`, JWT). Añadir un rol nuevo implica BD + ajustar reglas en código: es el patrón habitual (RBAC explícito).

Otros enums de Prisma (`estado_jornada`, `estado_abastecimiento`, tipos de movimiento, etc.) modelan **máquinas de estado** del dominio operativo; extenderlos implica migración SQL y revisar reglas de negocio, no solo “un catálogo más”.

### Paginación

Los endpoints `GET` de listados (tres catálogos, **inventario/stock**, **jornadas** y **abastecimientos**) aceptan:
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
packages/@fastfood/catalogos-core
  src/application, domain, ports  → productos (hexagonal)
apps/backend/src
  app.ts, index.ts
  composition/catalogos-wiring.ts
  adapters/catalogos/prisma-productos.persistence.ts
  modules/catalogos/     → productos, vendedores, unidades (HTTP + service/schemas)
  modules/inventario/    → HU4 (schemas, service, routes)
  modules/operaciones/   → HU5 (schemas, service, routes: zonas, jornadas, abastecimientos)
  modules/v1/v1.routes.ts
apps/web/src
  App.tsx, features/auth, features/panel, features/inventario, features/operaciones/AbastecimientoDiarioPage
  shared/api, session, permissions, types (catalogos + inventario)
```

## Documentación de datos

- Modelo completo (ER + lógico + físico): `DIAGRAMA_ER_LOGICO_FISICO.md`
