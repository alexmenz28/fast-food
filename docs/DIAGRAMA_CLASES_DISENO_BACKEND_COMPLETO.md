# Diagrama de clases de diseño — Backend (alcance completo del repositorio)

**Proyecto:** FAST FOOD S.A. — abastecimiento  

Este documento une **(A)** la capa de aplicación **tal como está implementada hoy** en código y **(B)** el **modelo de datos completo** definido en Prisma (`schema.prisma`), aunque varias entidades aún no tengan módulos REST (inventario, jornadas, abastecimiento, devoluciones, auditoría, etc.).

**Estilo:** Misma convención que el diagrama de defensa de referencia: módulos arriba, **PrismaClientLib** como núcleo de acceso a datos, dependencias `use` punteadas.

---

## A. Capa de aplicación (implementación actual)

*Igual que Sprint 1 en rutas y libs: no hay aún `inventario.routes.ts`, `abastecimiento.routes.ts`, etc.*

```mermaid
classDiagram
  direction TB

  class FastifyApp {
    <<app.ts>>
    +FastifyInstance server
    +buildApp()
    +registerCors()
    +registerAuthGate()
    +registerHealthRoutes()
    +registerV1Routes()
  }

  class AuthGatePlugin {
    <<plugins/auth-gate.ts>>
    +preHandler(request, reply)
    +esRutaPublica()
    +verificarJwtBearer()
    +reglasSupervisorSoloLectura()
    +reglaDeleteAlmacen()
  }

  class V1ApiRouter {
    <<v1.routes.ts>>
    +register subplugins bajo /v1
  }

  class HealthRoutesModule {
    <<health.routes.ts>>
    +GET /health
    +GET /health/db
  }

  class AuthRoutesModule {
    <<auth.routes.ts>>
    +POST /auth/login
    +GET /auth/me
  }

  class ProductosRoutesModule {
    <<productos.routes.ts>>
    +CRUD /productos + paginacion
  }

  class ProductosServiceModule {
    <<productos.service.ts>>
    +codigos y mapeo API
  }

  class VendedoresRoutesModule {
    <<vendedores.routes.ts>>
    +CRUD /vendedores + paginacion
  }

  class UnidadesMovilesRoutesModule {
    <<unidades-moviles.routes.ts>>
    +CRUD /unidades-moviles + paginacion
  }

  class UnidadesMovilesServiceModule {
    <<unidades-moviles.service.ts>>
    +codigos asignacion vendedor
  }

  class UnidadesMedidaRoutesModule {
    <<unidades-medida.routes.ts>>
    +GET /unidades-medida
  }

  class JwtLib {
    <<lib/jwt.ts>>
    +firmarTokenJwt()
  }

  class HttpUtils {
    <<lib/http.ts>>
    +badRequest mapPrismaError paginacion idParams
  }

  class CatalogPutPolicy {
    <<lib/catalog-put.ts>>
    +effectiveCatalogoIsActive()
  }

  class PrismaClientLib {
    <<lib/prisma.ts>>
    +PrismaClient instancia unica
    +acceso a todos los modelos del esquema
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

## B. Modelo de persistencia completo (Prisma)

*Refleja `apps/backend/prisma/schema.prisma`. Las futuras historias (inventario, abastecimiento, GPS, devolución, reportes, auditoría) consumirán estas entidades vía `PrismaClientLib`.*

```mermaid
classDiagram
  direction TB

  class Role {
    +int id
    +string name
  }

  class User {
    +uuid id
    +int roleId
    +string username
    +string passwordHash
  }

  class Seller {
    +uuid id
    +string identityDocument
    +string fullName
  }

  class MobileUnit {
    +uuid id
    +string code
    +enum operationalStatus
  }

  class UnitSellerAssignment {
    +uuid id
    +uuid unitId
    +uuid sellerId
    +bool isCurrent
  }

  class Zone {
    +uuid id
    +string name
  }

  class Journey {
    +uuid id
    +uuid unitId
    +uuid sellerId
    +uuid zoneId
    +enum status
  }

  class JourneyLocation {
    +uuid id
    +uuid journeyId
    +decimal lat lon
  }

  class ProductCategory {
    +int id
    +string name
  }

  class MeasureUnit {
    +int id
    +string code
  }

  class Product {
    +uuid id
    +string code
    +int categoryId
    +int measureUnitId
  }

  class Warehouse {
    +uuid id
    +string code
  }

  class WarehouseStock {
    +uuid id
    +uuid warehouseId
    +uuid productId
    +decimal currentQty
  }

  class StockMovement {
    +uuid id
    +uuid warehouseId
    +uuid productId
    +uuid userId
    +enum movementType
  }

  class Supply {
    +uuid id
    +uuid journeyId
    +uuid warehouseId
    +uuid deliveredById
    +enum status
  }

  class SupplyDetail {
    +uuid id
    +uuid supplyId
    +uuid productId
  }

  class Return {
    +uuid id
    +uuid supplyId
    +uuid receivedById
  }

  class ReturnDetail {
    +uuid id
    +uuid returnId
    +uuid productId
  }

  class AuditEvent {
    +uuid id
    +uuid userId
    +enum action
    +json beforeData afterData
  }

  User "n" --> "1" Role
  User "1" --> "*" StockMovement
  User "1" --> "*" Supply : deliveredBy
  User "1" --> "*" Return : receivedBy
  User "1" --> "*" AuditEvent

  Seller "1" --> "*" UnitSellerAssignment
  Seller "1" --> "*" Journey
  MobileUnit "1" --> "*" UnitSellerAssignment
  MobileUnit "1" --> "*" Journey

  Zone "1" --> "*" Journey
  Journey "1" --> "*" JourneyLocation
  Journey "1" --> "*" Supply

  ProductCategory "1" --> "*" Product
  MeasureUnit "1" --> "*" Product
  Product "1" --> "*" WarehouseStock
  Product "1" --> "*" StockMovement
  Product "1" --> "*" SupplyDetail
  Product "1" --> "*" ReturnDetail

  Warehouse "1" --> "*" WarehouseStock
  Warehouse "1" --> "*" StockMovement
  Warehouse "1" --> "*" Supply

  Supply "1" --> "*" SupplyDetail
  Supply "1" --> "0..1" Return
  Return "1" --> "*" ReturnDetail
```

---

## Relación entre vistas A y B

- Hoy, **solo** las entidades ligadas a **User, Role, Product, ProductCategory, MeasureUnit, Seller, MobileUnit, UnitSellerAssignment** reciben tráfico desde los módulos de rutas.
- **PrismaClientLib** es el único punto de acceso ORM; cuando se agreguen módulos REST de inventario u operación, aparecerán nuevas cajas tipo `InventarioRoutesModule` con `..> PrismaClientLib : use` y uso de **Warehouse**, **WarehouseStock**, **Journey**, etc.

---

### Leyenda

| Elemento | Significado |
|----------|-------------|
| Diagrama **A** | Código TypeScript actual (`apps/backend/src`). |
| Diagrama **B** | Contrato de datos completo en PostgreSQL vía Prisma. |
| `..> use` | Dependencia hacia utilidades o hacia el cliente ORM. |
