# Diagrama de clases de diseño — Backend (Sprint 1)

**Proyecto:** FAST FOOD S.A. — abastecimiento  
**Alcance:** HU1 (Productos), HU2 (Vendedores), HU3 (Unidades móviles), catálogo de unidades de medida, autenticación JWT y salud del servicio, según `PASOS_DESARROLLO.md`.

**Estilo:** Análogo al diagrama de defensa de referencia: **módulos de aplicación arriba**, **cliente de datos central abajo** (`PrismaClientLib`), dependencias **punteadas** etiquetadas `use`.

---

## 1. Capa de aplicación y utilidades → persistencia

```mermaid
classDiagram
  direction TB

  class FastifyApp {
    <<app.ts>>
    +FastifyInstance server
    +bool logger
    +buildApp()
    +registerCors()
    +registerAuthGate()
    +registerHealthRoutes()
    +registerV1Routes()
  }

  class AuthGatePlugin {
    <<preHandler global>>
    +string loginPath
    +string[] rutasPublicas
    +registerAuthGate(app)
    +preHandler(request, reply)
    +esRutaPublica(method, path)
    +verificarJwtBearer()
    +aplicarReglasRol()
  }

  class V1ApiRouter {
    <<v1.routes.ts>>
    +string prefix
    +register(app)
    +montarAuthCatalogos()
  }

  class HealthRoutesModule {
    <<health.routes.ts>>
    +getHealth()
    +getHealthDb()
  }

  class AuthRoutesModule {
    <<auth.routes.ts>>
    +Zod loginBodySchema
    +postLogin()
    +getMe()
    +validarCredenciales()
    +emitirTokenSesion()
  }

  class ProductosRoutesModule {
    <<productos.routes.ts>>
    +Zod crearSchema actualizarSchema
    +getListadoPaginado()
    +postCrear()
    +putActualizar()
    +deleteBajaLogica()
    +aplicarPoliticaActivo()
  }

  class ProductosServiceModule {
    <<productos.service.ts>>
    +asegurarCategoria(tipo)
    +generarCodigoProducto()
    +mapProductoApi(entidad)
    +categoriaATipoProducto()
  }

  class VendedoresRoutesModule {
    <<vendedores.routes.ts>>
    +Zod crearSchema actualizarSchema
    +getListadoPaginado()
    +postCrear()
    +putActualizar()
    +deleteBajaLogica()
    +aplicarPoliticaActivo()
  }

  class UnidadesMovilesRoutesModule {
    <<unidades-moviles.routes.ts>>
    +Zod crearSchema actualizarSchema
    +getListadoPaginado()
    +postCrear()
    +putActualizar()
    +deleteBajaLogica()
    +sincronizarAsignacionVendedor()
  }

  class UnidadesMovilesServiceModule {
    <<unidades-moviles.service.ts>>
    +generarCodigoUnidadMovil()
    +actualizarAsignacionVigente()
    +estadoUnidadAEnum()
    +enumAEstadoUnidad()
    +zonaDesdeDescripcion()
  }

  class UnidadesMedidaRoutesModule {
    <<unidades-medida.routes.ts>>
    +getListadoActivo()
  }

  class JwtLib {
    <<lib/jwt.ts>>
    +Uint8Array jwtSecretKey
    +firmarTokenJwt(payload)
  }

  class HttpUtils {
    <<lib/http.ts>>
    +badRequest(reply, mensaje)
    +mapPrismaError(err, reply)
    +parsearPaginacion(query, reply)
    +parseIdParams(params, reply)
  }

  class CatalogPutPolicy {
    <<lib/catalog-put.ts>>
    +effectiveCatalogoIsActive(rol, bodyActivo, existente)
  }

  class PrismaClientLib {
    <<lib/prisma.ts singleton>>
    +string DATABASE_URL
    +PrismaClient client
    +consultas sobre User Role Product Seller MobileUnit
    +consultas sobre ProductCategory MeasureUnit UnitSellerAssignment
  }

  FastifyApp --> AuthGatePlugin
  FastifyApp --> HealthRoutesModule
  FastifyApp --> V1ApiRouter
  V1ApiRouter --> AuthRoutesModule
  V1ApiRouter --> ProductosRoutesModule
  V1ApiRouter --> VendedoresRoutesModule
  V1ApiRouter --> UnidadesMovilesRoutesModule
  V1ApiRouter --> UnidadesMedidaRoutesModule

  ProductosRoutesModule --> ProductosServiceModule
  UnidadesMovilesRoutesModule --> UnidadesMovilesServiceModule

  AuthGatePlugin ..> JwtLib : use
  AuthRoutesModule ..> JwtLib : use
  AuthRoutesModule ..> PrismaClientLib : use

  HealthRoutesModule ..> PrismaClientLib : use

  ProductosRoutesModule ..> HttpUtils : use
  ProductosRoutesModule ..> CatalogPutPolicy : use
  ProductosRoutesModule ..> PrismaClientLib : use
  ProductosServiceModule ..> PrismaClientLib : use

  VendedoresRoutesModule ..> HttpUtils : use
  VendedoresRoutesModule ..> CatalogPutPolicy : use
  VendedoresRoutesModule ..> PrismaClientLib : use

  UnidadesMovilesRoutesModule ..> HttpUtils : use
  UnidadesMovilesRoutesModule ..> CatalogPutPolicy : use
  UnidadesMovilesRoutesModule ..> PrismaClientLib : use
  UnidadesMovilesServiceModule ..> PrismaClientLib : use

  UnidadesMedidaRoutesModule ..> HttpUtils : use
  UnidadesMedidaRoutesModule ..> PrismaClientLib : use
```

---

## 2. Entidades de persistencia tocadas en Sprint 1

*(Tablas/modelos Prisma que intervienen en las historias del sprint.)*

```mermaid
classDiagram
  direction LR

  class Role {
    +int id
    +string name
    +bool isActive
  }

  class User {
    +uuid id
    +int roleId
    +string username
    +string passwordHash
    +string fullName
    +bool isActive
  }

  class ProductCategory {
    +int id
    +string name
    +bool isActive
  }

  class MeasureUnit {
    +int id
    +string code
    +string name
    +bool isActive
  }

  class Product {
    +uuid id
    +string code
    +string name
    +bool isActive
    +int categoryId
    +int measureUnitId
  }

  class Seller {
    +uuid id
    +string identityDocument
    +string fullName
    +string phone
    +bool isActive
  }

  class MobileUnit {
    +uuid id
    +string code
    +enum operationalStatus
    +bool isActive
    +string description
  }

  class UnitSellerAssignment {
    +uuid id
    +uuid unitId
    +uuid sellerId
    +date startDate
    +date endDate
    +bool isCurrent
  }

  User "n" --> "1" Role
  Product "n" --> "1" ProductCategory
  Product "n" --> "1" MeasureUnit
  UnitSellerAssignment "n" --> "1" MobileUnit
  UnitSellerAssignment "n" --> "1" Seller
```

---

### Leyenda

| Símbolo | Significado |
|--------|-------------|
| `..> ` *use* | Dependencia (import / llamada a utilidad o BD). |
| `-->` | Composición o registro en el arranque (Fastify). |
| Caja `<<*.routes.ts>>` | Plugin de rutas HTTP (controlador delgado). |
| `PrismaClientLib` | Equivalente funcional al **Db-lib.js** del proyecto de referencia: un solo acceso ORM centralizado. |

*Los nombres de archivo entre `<< >>` coinciden con `apps/backend/src/`.*
