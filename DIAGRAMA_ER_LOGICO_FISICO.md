# Modelo de datos completo (lógico y físico)

Documento de planificación integral para el sistema de abastecimiento de FAST FOOD S.A.  
Incluye diagrama ER en Mermaid, modelo lógico normalizado y propuesta física para PostgreSQL.

---

## 1) Diagrama entidad-relación (Mermaid)

```mermaid
erDiagram
    ROL {
      smallint id_rol PK
      varchar nombre UK
      varchar descripcion
      boolean activo
    }

    USUARIO {
      uuid id_usuario PK
      smallint id_rol FK
      varchar username UK
      varchar password_hash
      varchar nombre_completo
      varchar email UK
      boolean activo
      timestamptz creado_en
      timestamptz actualizado_en
    }

    VENDEDOR {
      uuid id_vendedor PK
      varchar documento_identidad UK
      varchar nombre_completo
      varchar telefono
      boolean activo
      timestamptz creado_en
      timestamptz actualizado_en
    }

    UNIDAD_MOVIL {
      uuid id_unidad PK
      varchar codigo UK
      varchar placa
      varchar descripcion
      varchar estado_operativo
      boolean activo
      timestamptz creado_en
      timestamptz actualizado_en
    }

    ASIGNACION_UNIDAD_VENDEDOR {
      uuid id_asignacion PK
      uuid id_unidad FK
      uuid id_vendedor FK
      date fecha_inicio
      date fecha_fin
      boolean vigente
      timestamptz creado_en
    }

    ZONA {
      uuid id_zona PK
      varchar nombre UK
      varchar descripcion
      boolean activa
    }

    JORNADA {
      uuid id_jornada PK
      uuid id_unidad FK
      uuid id_vendedor FK
      uuid id_zona FK
      date fecha_operacion
      time hora_inicio
      time hora_fin
      varchar estado_jornada
      timestamptz creado_en
    }

    UBICACION_JORNADA {
      uuid id_ubicacion PK
      uuid id_jornada FK
      decimal latitud
      decimal longitud
      timestamptz fecha_hora
      varchar tipo_punto
    }

    CATEGORIA_PRODUCTO {
      smallint id_categoria PK
      varchar nombre UK
      varchar descripcion
      boolean activo
    }

    UNIDAD_MEDIDA {
      smallint id_unidad_medida PK
      varchar codigo UK
      varchar nombre
      boolean activo
    }

    PRODUCTO {
      uuid id_producto PK
      varchar codigo UK
      varchar nombre
      smallint id_categoria FK
      smallint id_unidad_medida FK
      boolean activo
      timestamptz creado_en
      timestamptz actualizado_en
    }

    ALMACEN {
      uuid id_almacen PK
      varchar codigo UK
      varchar nombre
      varchar direccion
      boolean activo
    }

    INVENTARIO_ALMACEN {
      uuid id_inventario PK
      uuid id_almacen FK
      uuid id_producto FK
      numeric stock_actual
      numeric stock_minimo
      timestamptz actualizado_en
    }

    MOVIMIENTO_INVENTARIO {
      uuid id_movimiento PK
      uuid id_almacen FK
      uuid id_producto FK
      uuid id_usuario FK
      varchar tipo_movimiento
      numeric cantidad
      varchar referencia_tipo
      uuid referencia_id
      text observacion
      timestamptz fecha_hora
    }

    ABASTECIMIENTO {
      uuid id_abastecimiento PK
      uuid id_jornada FK
      uuid id_almacen FK
      uuid id_usuario_entrega FK
      timestamptz fecha_hora_entrega
      varchar estado
      text observacion
    }

    ABASTECIMIENTO_DETALLE {
      uuid id_abast_detalle PK
      uuid id_abastecimiento FK
      uuid id_producto FK
      numeric cantidad_entregada
    }

    DEVOLUCION {
      uuid id_devolucion PK
      uuid id_abastecimiento FK
      uuid id_usuario_recepcion FK
      timestamptz fecha_hora_devolucion
      text observacion
    }

    DEVOLUCION_DETALLE {
      uuid id_dev_detalle PK
      uuid id_devolucion FK
      uuid id_producto FK
      numeric cantidad_devuelta
      numeric cantidad_danada
    }

    AUDITORIA_EVENTO {
      uuid id_evento PK
      uuid id_usuario FK
      varchar entidad
      uuid id_registro
      varchar accion
      jsonb datos_antes
      jsonb datos_despues
      timestamptz fecha_hora
      varchar ip
    }

    ROL ||--o{ USUARIO : "define permisos"
    UNIDAD_MOVIL ||--o{ ASIGNACION_UNIDAD_VENDEDOR : "se asigna"
    VENDEDOR ||--o{ ASIGNACION_UNIDAD_VENDEDOR : "asignado"

    UNIDAD_MOVIL ||--o{ JORNADA : "opera en"
    VENDEDOR ||--o{ JORNADA : "atiende"
    ZONA ||--o{ JORNADA : "localiza"
    JORNADA ||--o{ UBICACION_JORNADA : "registra GPS"

    CATEGORIA_PRODUCTO ||--o{ PRODUCTO : "clasifica"
    UNIDAD_MEDIDA ||--o{ PRODUCTO : "mide"

    ALMACEN ||--o{ INVENTARIO_ALMACEN : "contiene stock"
    PRODUCTO ||--o{ INVENTARIO_ALMACEN : "stock de"

    ALMACEN ||--o{ MOVIMIENTO_INVENTARIO : "genera"
    PRODUCTO ||--o{ MOVIMIENTO_INVENTARIO : "movimiento de"
    USUARIO ||--o{ MOVIMIENTO_INVENTARIO : "registra"

    JORNADA ||--o| ABASTECIMIENTO : "tiene entrega"
    ALMACEN ||--o{ ABASTECIMIENTO : "despacha"
    USUARIO ||--o{ ABASTECIMIENTO : "entrega"

    ABASTECIMIENTO ||--|{ ABASTECIMIENTO_DETALLE : "incluye"
    PRODUCTO ||--o{ ABASTECIMIENTO_DETALLE : "entregado"

    ABASTECIMIENTO ||--o| DEVOLUCION : "puede tener"
    USUARIO ||--o{ DEVOLUCION : "recibe"
    DEVOLUCION ||--|{ DEVOLUCION_DETALLE : "incluye"
    PRODUCTO ||--o{ DEVOLUCION_DETALLE : "devuelto"

    USUARIO ||--o{ AUDITORIA_EVENTO : "genera"
```

---

## 2) Modelo lógico (normalizado)

### Entidades maestras
- `ROL(id_rol, nombre, descripcion, activo)`
- `USUARIO(id_usuario, id_rol, username, password_hash, nombre_completo, email, activo, creado_en, actualizado_en)`
- `VENDEDOR(id_vendedor, documento_identidad, nombre_completo, telefono, activo, creado_en, actualizado_en)`
- `UNIDAD_MOVIL(id_unidad, codigo, placa, descripcion, estado_operativo, activo, creado_en, actualizado_en)`
- `ZONA(id_zona, nombre, descripcion, activa)`
- `CATEGORIA_PRODUCTO(id_categoria, nombre, descripcion, activo)`
- `UNIDAD_MEDIDA(id_unidad_medida, codigo, nombre, activo)`
- `PRODUCTO(id_producto, codigo, nombre, id_categoria, id_unidad_medida, activo, creado_en, actualizado_en)`
- `ALMACEN(id_almacen, codigo, nombre, direccion, activo)`

### Entidades transaccionales
- `ASIGNACION_UNIDAD_VENDEDOR(id_asignacion, id_unidad, id_vendedor, fecha_inicio, fecha_fin, vigente, creado_en)`
- `JORNADA(id_jornada, id_unidad, id_vendedor, id_zona, fecha_operacion, hora_inicio, hora_fin, estado_jornada, creado_en)`
- `UBICACION_JORNADA(id_ubicacion, id_jornada, latitud, longitud, fecha_hora, tipo_punto)`
- `INVENTARIO_ALMACEN(id_inventario, id_almacen, id_producto, stock_actual, stock_minimo, actualizado_en)`
- `MOVIMIENTO_INVENTARIO(id_movimiento, id_almacen, id_producto, id_usuario, tipo_movimiento, cantidad, referencia_tipo, referencia_id, observacion, fecha_hora)`
- `ABASTECIMIENTO(id_abastecimiento, id_jornada, id_almacen, id_usuario_entrega, fecha_hora_entrega, estado, observacion)`
- `ABASTECIMIENTO_DETALLE(id_abast_detalle, id_abastecimiento, id_producto, cantidad_entregada)`
- `DEVOLUCION(id_devolucion, id_abastecimiento, id_usuario_recepcion, fecha_hora_devolucion, observacion)`
- `DEVOLUCION_DETALLE(id_dev_detalle, id_devolucion, id_producto, cantidad_devuelta, cantidad_danada)`
- `AUDITORIA_EVENTO(id_evento, id_usuario, entidad, id_registro, accion, datos_antes, datos_despues, fecha_hora, ip)`

### Reglas de integridad clave
- `UNIQUE` en catálogos de negocio (`codigo`, `documento_identidad`, `username`, `email`).
- `UNIQUE(id_almacen, id_producto)` en `INVENTARIO_ALMACEN` para evitar duplicados.
- `UNIQUE(id_abastecimiento, id_producto)` y `UNIQUE(id_devolucion, id_producto)` en detalles.
- `CHECK` de cantidades `>= 0` en inventario, entrega y devolución.
- `CHECK` de coordenadas (`latitud` entre -90 y 90, `longitud` entre -180 y 180).

---

## 3) Normalización aplicada

### Primera forma normal (1FN)
- Todos los atributos son atómicos.
- No existen listas o grupos repetitivos en una sola columna.
- Los detalles de abastecimiento/devolución se separan en tablas hijas.

### Segunda forma normal (2FN)
- No hay dependencias parciales respecto a claves compuestas.
- En detalles se usa PK surrogate (`id_*_detalle`) y unicidad compuesta para la regla de negocio.

### Tercera forma normal (3FN)
- Se eliminan dependencias transitivas:
  - `PRODUCTO` referencia `CATEGORIA_PRODUCTO` y `UNIDAD_MEDIDA` en lugar de repetir textos.
  - `USUARIO` referencia `ROL`.
  - `JORNADA` referencia `UNIDAD_MOVIL`, `VENDEDOR`, `ZONA`.
- Las propiedades derivables (por ejemplo consumo) se obtienen por consulta y no se almacenan duplicadas.

### BCNF (aplicable en tablas críticas)
- Catálogos con claves candidatas (`codigo`, `username`, `email`, `documento_identidad`) cumplen BCNF.
- Tablas puente/control (`INVENTARIO_ALMACEN`, detalles) mantienen determinantes como claves.

---

## 4) Modelo físico (PostgreSQL, propuesta)

### Convenciones
- Esquema `public`.
- PK: `uuid` con `gen_random_uuid()` (o `uuid_generate_v4()`).
- Fechas en `timestamptz`.
- Cantidades en `numeric(12,2)`.
- Coordenadas en `numeric(10,7)`.
- Índices en FKs y columnas de búsqueda frecuente.

### Índices sugeridos
- `idx_jornada_fecha` en `JORNADA(fecha_operacion)`
- `idx_abastecimiento_fecha` en `ABASTECIMIENTO(fecha_hora_entrega)`
- `idx_movimiento_fecha` en `MOVIMIENTO_INVENTARIO(fecha_hora)`
- `idx_auditoria_fecha` en `AUDITORIA_EVENTO(fecha_hora)`
- `idx_ubicacion_jornada_fecha` en `UBICACION_JORNADA(id_jornada, fecha_hora)`

### Vistas de apoyo (reportes)
- `vw_consumo_por_jornada`: entregado - devuelto - dañado por producto/jornada.
- `vw_consumo_por_unidad`: agregación por unidad móvil y período.
- `vw_stock_actual`: stock por almacén y producto.

---

## 5) Evolución respecto al sprint actual

El sprint implementado hoy cubre parcialmente:
- `PRODUCTO`
- `VENDEDOR`
- `UNIDAD_MOVIL`

Para completar el modelo del caso, el siguiente paso técnico es implementar:
1. `JORNADA`, `ABASTECIMIENTO`, `ABASTECIMIENTO_DETALLE`
2. `DEVOLUCION`, `DEVOLUCION_DETALLE`
3. `INVENTARIO_ALMACEN`, `MOVIMIENTO_INVENTARIO`, `AUDITORIA_EVENTO`

