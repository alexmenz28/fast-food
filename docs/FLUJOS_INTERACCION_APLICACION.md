# Flujos de interacción de la aplicación web (producto)

Este documento describe, **por sección de la interfaz**, qué archivos intervienen, qué ocurre al usar botones o formularios, las validaciones en el cliente, las llamadas HTTP al API y los puntos correspondientes en el backend. Sirve como mapa operativo del sistema entregado al usuario final.

---

## Convención de rutas de archivos

**Raíz del monorepo (repositorio):**

`c:\Users\alexa\Documentos\UTEPSA\ExamenDeGrado\02-Ingeniería y calidad de software\02-Caso de estudio\fast-food-abastecimiento`

En el texto siguiente, las rutas bajo **Raíz** son relativas a ese directorio (por ejemplo, `apps\web\src\...`).

**API versionada:** el backend expone recursos bajo `/v1/...` (definido en `apps\backend\src\lib\constants.ts`).

**URL base en el frontend:** `apps\web\src\shared\api\config.ts` define `API_V1_URL`:

- En **desarrollo**: el navegador llama a `/api/v1/...`; Vite reenvía a `http://localhost:3000/v1/...` (`apps\web\vite.config.ts`, proxy `/api`).
- En **producción**: se usa `VITE_API_URL` + `/v1` (sin barra final en el origen).

**Autenticación global en el backend:** `apps\backend\src\plugins\auth-gate.js` (hook `preHandler`). Rutas públicas: `GET /health`, `GET /health/db`, `POST /v1/auth/login`. El resto exige cabecera `Authorization: Bearer <JWT>`. Los métodos que no son `GET` con rol `SUPERVISOR` reciben 403. `DELETE` con rol `ALMACEN` recibe 403.

**Registro de rutas API:** `apps\backend\src\app.ts` registra `v1Routes` con prefijo `/v1`. El ensamblado de módulos está en `apps\backend\src\modules\v1\v1.routes.ts`.

---

## 1. Arranque de la aplicación y enrutado

| Elemento | Ruta completa (Windows) |
|----------|-------------------------|
| Punto de entrada React | `...\fast-food-abastecimiento\apps\web\src\main.tsx` |
| Rutas `/login` y `/*` | `...\fast-food-abastecimiento\apps\web\src\App.tsx` |
| Tema (claro/oscuro) | `...\fast-food-abastecimiento\apps\web\src\theme.tsx` |

- `main.tsx` monta `BrowserRouter`, `ThemeProvider` y `App`.
- `App.tsx`: `/login` → `LoginPage`; cualquier otra ruta → `PanelProtegido` (el panel resuelve subrutas internas).

---

## 2. Inicio de sesión

**Archivo principal:** `...\fast-food-abastecimiento\apps\web\src\features\auth\LoginPage.tsx`

**Al cargar la página**

- `useEffect` lee `sessionStorage` con la clave definida en `...\fast-food-abastecimiento\apps\web\src\shared\session.ts` (`SESSION_KEY`). Si ya hay sesión válida parseada, redirige a `/resumen`.

**Botón de tema (flotante)**

- Llama a `toggleTheme` del contexto en `theme.tsx`: actualiza `data-theme` en `<html>` y persiste en `localStorage` (`fastfood_theme`).

**Envío del formulario (`onSubmit` → `iniciarSesion`)**

1. **Validación cliente:** usuario y contraseña no vacíos (trim en usuario). Si faltan: mensaje "Completa usuario y contrasena." y no se envía la petición.
2. **Petición:** `POST` a `${API_V1_URL}/auth/login` con cuerpo JSON `{ usuario, contrasena }`. Sin cabecera Bearer (login público en el gate).
3. **Respuesta esperada:** JSON con `ok: true`, `data.token`, `data.usuario` (nombreUsuario, nombreCompleto, rol).
4. **Validación de rol:** solo se aceptan `ADMINISTRADOR`, `ALMACEN`, `SUPERVISOR`. Otro valor: mensaje "Rol no reconocido.".
5. **Éxito:** guarda en `sessionStorage` el objeto `Sesion` y navega a `/resumen`.
6. **Error de red:** mensaje indicando verificar backend.

**Backend**

- `...\fast-food-abastecimiento\apps\backend\src\modules\auth\auth.routes.ts` → `POST /login` (ruta efectiva `/v1/auth/login`).
- Cuerpo validado con `...\fast-food-abastecimiento\apps\backend\src\modules\auth\auth.schemas.ts` (`loginBodySchema`).
- Usuario en mayúsculas, verificación bcrypt, JWT firmado en `...\fast-food-abastecimiento\apps\backend\src\lib\jwt.js`.

---

## 3. Panel protegido: shell (menú, barra superior, sesión)

**Archivo principal:** `...\fast-food-abastecimiento\apps\web\src\features\panel\PanelProtegido.tsx`

**Si no hay sesión**

- `useEffect` redirige a `/login`. Si `sesion` es null también se renderiza `<Navigate to="/login" />`.

**Contraer / expandir menú lateral**

- Botón sidebar: `alternarMenu` alterna estado y guarda en `localStorage` (`fastfood_sidebar_collapsed` = `"1"` o `"0"`).

**Enlaces del menú (`NavLink`)**

- `/resumen`, `/productos`, `/vendedores`, `/unidades`, `/inventario`: solo cambian la subruta dentro del mismo layout; no disparan por sí solos nuevas peticiones distintas de las que ya defina el efecto de carga (ver abajo).

**Barra superior**

- Muestra nombre completo, usuario, etiqueta de rol (`...\fast-food-abastecimiento\apps\web\src\shared\permissions.ts` → `etiquetaRol`).
- Reloj local actualizado cada segundo (`setInterval`).
- **Tema:** mismo `toggleTheme` que en login.
- **Salir (`cerrarSesion`):** borra `SESSION_KEY`, pone `sesion` en null y navega a `/login` (sin llamar al backend para invalidar token).

**Carga inicial de datos del panel (`cargarDatos`)**

- Se ejecuta cuando existe `sesion` y cuando cambian las páginas de paginación de productos, vendedores o unidades (dependencias del `useEffect`).
- Pone `cargando` en true y lanza **en paralelo** seis `fetch` con `Authorization: Bearer <token>`:

  | Orden | Método y ruta (relativa a `API_V1_URL`) | Uso en UI |
  |-------|----------------------------------------|-----------|
  | 1 | `GET /productos?pagina=&limite=` | Tabla productos, KPI resumen |
  | 2 | `GET /vendedores?pagina=&limite=` | Tabla vendedores, select unidades, KPI |
  | 3 | `GET /unidades-moviles?pagina=&limite=` | Tabla unidades, KPI |
  | 4 | `GET /unidades-medida` | Selects de producto (crear/editar) |
  | 5 | `GET /productos/categorias` | Selects de producto, filtros relacionados |
  | 6 | `GET /unidades-moviles/estados` | Selects de unidad móvil |

  Las **zonas** (`GET /zonas`) solo las carga la pantalla de **Abastecimiento diario** al planificar jornadas; no forman parte del catálogo de unidades móviles en el panel.

- **401 en cualquiera:** limpia sesión y va a `/login`.
- **Error por módulo:** asigna `mensaje` con el texto devuelto por el API o código HTTP.
- **Éxito:** actualiza estados React (`productos`, `vendedores`, `unidades`, catálogos auxiliares, objetos de paginación).
- **Excepción de red:** mensaje genérico de conexión/backend.

**Helper `pedir(path, method, payload?)`**

- Usado para POST/PUT y otras operaciones mutadoras: añade Bearer y `Content-Type: application/json` si hay cuerpo; en 401 limpia sesión y redirige; parsea JSON de respuesta.

**Backend (referencias)**

- Productos: `...\fast-food-abastecimiento\apps\backend\src\modules\catalogos\productos.routes.ts` + núcleo `packages\@fastfood\catalogos-core` y adaptador `...\fast-food-abastecimiento\apps\backend\src\adapters\catalogos\prisma-productos.persistence.ts`.
- Vendedores: `...\fast-food-abastecimiento\apps\backend\src\modules\catalogos\vendedores.routes.ts` + `vendedores.schemas.ts`.
- Unidades móviles: `...\fast-food-abastecimiento\apps\backend\src\modules\catalogos\unidades-moviles.routes.ts` + `unidades-moviles.schemas.ts` + `unidades-moviles.service.ts`.
- Unidades de medida: `...\fast-food-abastecimiento\apps\backend\src\modules\catalogos\unidades-medida.routes.ts`.

---

## 4. Sección Resumen (`/resumen`)

**Archivo:** mismo `PanelProtegido.tsx`, ruta interna `<Route path="/resumen" ...>`.

**Contenido**

- Texto descriptivo y tres KPIs con los **conteos de la página actual** de cada listado (`productos.length`, `vendedores.length`, `unidades.length`), no el total global del sistema.

**Acciones**

- No hay botones propios; los datos dependen de `cargarDatos` descrito arriba.

---

## 5. Sección Productos (`/productos`)

**Archivo:** `PanelProtegido.tsx` (formulario, tabla, paginación, modal de edición).

**Permisos UI:** `puedeCrearEditar` y `puedeCambiarActivoCatalogo` desde `...\fast-food-abastecimiento\apps\web\src\shared\permissions.ts` (alineado con reglas del `auth-gate` y cuerpo de rutas).

**Crear producto (`crearProducto`, submit del formulario)**

1. **Validación:** `idUnidadMedida` e `idCategoria` numéricos ≥ 1; nombre tomado del formulario (trim).
2. **Petición:** `POST /productos` con `{ nombre, idCategoria, idUnidadMedida, activo: true }`.
3. **Éxito:** mensaje con código generado; reset visual del form (`formKeyProducto`); `cargarDatos({ productosPagina: 1 })`.
4. Botón deshabilitado si aún no hay unidades de medida o categorías cargadas.

**Paginación**

- Botones Anterior/Siguiente → `cambiarPagina("productos", ...)` actualiza estado `paginacionProductos.pagina`, lo que dispara de nuevo `cargarDatos` vía `useEffect`.

**Editar (abre modal)**

- Clic en "Editar" → `setModalEdicion({ kind: "producto", item: p })`.

**Guardar edición (modal, `guardarEdicion`)**

1. Valida selects de categoría y unidad de medida (igual que en alta).
2. **Activo en catálogo:** si el usuario es administrador, lee checkbox `activo`; si no, mantiene el valor anterior (`CampoActivoCatalogo` en `...\fast-food-abastecimiento\apps\web\src\features\panel\CampoActivoCatalogo.tsx`).
3. **Petición:** `PUT /productos/:id` con nombre, ids y `activo`.

**Backend**

- `productos.routes.ts`: GET lista paginada, GET `/categorias`, POST `/`, PUT `/:id`. Tras crear producto se llama `asegurarFilaStockProducto` en `...\fast-food-abastecimiento\apps\backend\src\modules\inventario\inventario.service.ts` para alinear inventario.

---

## 6. Sección Vendedores (`/vendedores`)

**Archivo:** `PanelProtegido.tsx`.

**Crear vendedor (`crearVendedor`)**

1. **Formulario:** HTML5 `required` en nombre, documento, teléfono; teléfono con `pattern`, `minLength` 7, `maxLength` 15; `onInput` ejecuta `telefonoSoloDigitos` (solo dígitos en el campo).
2. **Payload:** nombreCompleto, documento, teléfono sin no-dígitos, `activo: true`.
3. **Petición:** `POST /vendedores`.
4. **Éxito:** mensaje, reset formulario, `cargarDatos({ vendedoresPagina: 1 })`.

**Paginación y edición:** análogo a productos; `PUT /vendedores/:id` con mismas reglas de teléfono en el modal.

**Backend:** `vendedores.routes.ts` + `vendedores.schemas.ts`; `effectiveCatalogoIsActive` en `...\fast-food-abastecimiento\apps\backend\src\lib\catalog-put.js` para el flag activo según rol.

---

## 7. Sección Unidades móviles (`/unidades`)

**Archivo:** `PanelProtegido.tsx`.

**Crear unidad (`crearUnidad`)**

1. **Validación:** `placa` obligatoria (trim, máx. 20); `idEstadoOperativo` ≥ 1; `descripcion` opcional; `idVendedor` opcional. Si hay vendedor: `fechaInicioAsignacion` obligatoria (`YYYY-MM-DD`), `fechaFinAsignacion` opcional pero, si se indica, no puede ser anterior al inicio; si solo hay fin sin inicio, aviso. La **zona operativa** no se captura aquí: va en cada **jornada** (`POST /jornadas` con `idZona`).
2. **Petición:** `POST /unidades-moviles`.
3. **Éxito:** mensaje con código asignado por servidor; recarga con `cargarDatos({ unidadesPagina: 1 })`.

**Edición (modal)**

- `PUT /unidades-moviles/:id` con `placa`, `descripcion`, estado, vendedor opcional, fechas de asignación si hay vendedor, y `activo` según permisos (checkbox solo administrador).

**Paginación:** `cambiarPagina("unidades", ...)`.

**Backend:** `unidades-moviles.routes.ts` (generación de código, asignación vigente en `unidades-moviles.service.ts`).

---

## 8. Modal de edición (overlay)

**Archivo:** `PanelProtegido.tsx` (final del componente).

**Cerrar**

- Clic en overlay → `setModalEdicion(null)`.
- Botón Cancelar → igual.

**Submit**

- Un solo handler `guardarEdicion` ramifica según `modalEdicion.kind` (`producto` | `vendedor` | `unidad`) como se describió en las secciones 5–7.

---

## 9. Sección Inventario (`/inventario`)

**Archivo:** `...\fast-food-abastecimiento\apps\web\src\features\inventario\InventarioPage.tsx`

**Montaje y recarga (`cargar`)**

- Depende de `paginacion.pagina`, `paginacion.limite`, `filtroCategoria` y `puedeEditar` (derivado de `puedeCrearEditar(sesion.rol)`).

**Peticiones en paralelo (función local `pedir`, misma semántica que en el panel):**

| Petición | Rol / notas |
|----------|-------------|
| `GET /inventario/almacen` | Todos los autenticados |
| `GET /inventario/stock?pagina=&limite=&idCategoria=` opcional | Lista stock paginado |
| `GET /productos/categorias` | Opciones del filtro |
| `GET /productos?pagina=1&limite=50` | Solo si `puedeEditar` (select de ingreso; tope del API) |

- Actualiza `almacen`, `filas`, `paginacion`, `categorias`, `productosSelect`.

**Filtro por categoría (`select` onChange)**

- Actualiza `filtroCategoria` y resetea `pagina` a 1 → nuevo `cargar`.

**Registrar ingreso (`registrarIngreso`)** — solo si `puedeEditar`

1. **Validación:** `idProducto` obligatorio; `cantidad` finita y > 0; `fechaHora` opcional: si viene, se convierte a ISO si la fecha es válida.
2. **Petición:** `POST /inventario/ingresos` con `{ idProducto, cantidad, fechaHora? }`.
3. **Éxito:** mensaje, incrementa `formIngresoKey` para limpiar el formulario, vuelve a `cargar`.

**Stock mínimo por fila (`guardarMinimo`)** — solo si `puedeEditar`

- Formulario inline por producto: al enviar, valida que `min` sea número finito ≥ 0.
- **Petición:** `PATCH /inventario/stock/:idProducto/minimo` con `{ cantidadMinima }`.

**Paginación**

- Botones Anterior/Siguiente → `cambiarPagina` ajusta solo el estado local de `paginacion`; el `useEffect` que depende de `cargar` vuelve a pedir stock.

**Indicadores**

- Cuenta `bajos` = filas con `bajoMinimo` en la página actual para el badge de alerta.

**Backend**

- `...\fast-food-abastecimiento\apps\backend\src\modules\inventario\inventario.routes.ts`
- Esquemas: `...\fast-food-abastecimiento\apps\backend\src\modules\inventario\inventario.schemas.ts`
- Lógica: `...\fast-food-abastecimiento\apps\backend\src\modules\inventario\inventario.service.ts`
- Escritura (POST ingresos, PATCH mínimo): roles `ADMINISTRADOR` o `ALMACEN`; `SUPERVISOR` solo lectura en esos endpoints.

---

## 10. Sección Abastecimiento diario (`/abastecimiento`)

**Archivo:** `...\fast-food-abastecimiento\apps\web\src\features\operaciones\AbastecimientoDiarioPage.tsx`

**Etiquetas de estado:** `...\fast-food-abastecimiento\apps\web\src\shared\labels\operaciones.ts`

**Montaje**

- Carga en paralelo catálogos auxiliares: `GET /zonas`, `GET /unidades-moviles?pagina=1&limite=50`, `GET /vendedores?...`, `GET /productos?...` (misma paginación; el API exige `limite` ≤ 50) mediante la función local `pedir` (Bearer, manejo 401).
- Luego `GET /jornadas` y `GET /abastecimientos` con paginación local (`LIMITE = 8`). Cualquier fallo de listado principal deja mensaje en pantalla.

**Nueva jornada** — solo si `puedeCrearEditar`

- **Validación cliente:** selects de unidad, vendedor y zona obligatorios; fecha obligatoria; **hora de inicio y hora de fin obligatorias**; ambas deben estar en la ventana **18:00–03:00** (turno nocturno del caso de estudio) y con orden coherente (`shared/validation/jornadaHorario.ts`).
- **Petición:** `POST /jornadas` con `{ idUnidad, idVendedor, idZona, fechaOperacion, horaInicio, horaFin }`.
- **Backend:** `jornada-horario.ts` + `superRefine` en `operaciones.schemas.ts`; misma regla en `crearJornada` del servicio.
- **Éxito:** mensaje, reset del formulario (`formJornadaKey`), recarga jornadas forzando página 1 (`cargarJornadas(1)`) y recarga abastecimientos.

**Filtro “Solo pendientes de abastecimiento”**

- Añade `pendienteAbastecimiento=true` al query de jornadas y resetea la página a 1.

**Registrar entrega (modal)**

- Visible solo en filas con estado planificada y sin abastecimiento (`estado === "PLANNED"` y `!tieneAbastecimiento`).
- Abre modal con una fila por producto del catálogo cargado; cantidades en estado local `cantidadesEntrega`.
- **Validación:** al menos una línea con número finito > 0.
- **Petición:** `POST /abastecimientos` con `{ idJornada, lineas: [{ idProducto, cantidad }] }`.
- **Éxito:** cierra modal, recarga jornadas y abastecimientos.

**Ver líneas**

- `GET /abastecimientos/:id` → modal de detalle con productos y cantidades entregadas.

**Paginación**

- Tablas jornadas y abastecimientos independientes; botones ajustan `pagJornadas.pagina` o `pagAbs.pagina` y el `useEffect` vuelve a pedir datos.

**Backend**

- Rutas: `...\fast-food-abastecimiento\apps\backend\src\modules\operaciones\operaciones.routes.ts`
- Esquemas Zod: `operaciones.schemas.ts`
- Reglas de negocio y transacción Prisma: `operaciones.service.ts` (clase de error `OperacionNegocioError` → 400 con mensaje).
- Registro en `v1.routes.ts` del plugin `operacionesRoutes` (sin subprefijo adicional: rutas `/v1/zonas`, `/v1/jornadas`, `/v1/abastecimientos`).
- Reutiliza `obtenerAlmacenCentralId` desde `inventario.service.ts` dentro de la transacción de registro de abastecimiento.

---

## 11. Tipos compartidos en el frontend

- Catálogos: `...\fast-food-abastecimiento\apps\web\src\shared\types\catalogos.ts`
- Inventario: `...\fast-food-abastecimiento\apps\web\src\shared\types\inventario.ts`
- Operaciones (HU5): `...\fast-food-abastecimiento\apps\web\src\shared\types\operaciones.ts`

---

## Resumen de permisos (cliente y servidor)

| Rol | Catálogos (UI) | Inventario (UI) | Abastecimiento (UI) | Métodos HTTP no GET |
|-----|----------------|-----------------|---------------------|---------------------|
| ADMINISTRADOR | Alta, edición, cambiar activo | Ingresos, mínimos | Jornadas y entregas | Permitidos (incl. DELETE catálogo vía API si existiera en UI) |
| ALMACEN | Alta, edición; activo solo lectura en modal | Ingresos, mínimos | Jornadas y entregas | Permitidos; DELETE bloqueado en gate |
| SUPERVISOR | Solo consulta | Solo consulta | Solo listados y detalle | Bloqueados en gate (403) |

La UI oculta formularios de alta/edición cuando `puedeCrearEditar` es false; el servidor debe seguir siendo la fuente de verdad (`auth-gate` + rutas de inventario y operaciones).
