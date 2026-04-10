import { JourneyStatus, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { registrarAbastecimiento } from "../src/modules/operaciones/operaciones.service.js";

const prisma = new PrismaClient();

/** Hora @db.Time como Date UTC (solo HH:mm). */
function hora(h: number, m: number): Date {
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
}

/** Fecha operación (solo día). */
function fechaOp(y: number, mo: number, d: number): Date {
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
}

/**
 * Borra **todos** los datos de negocio en orden seguro (FKs), dejando la BD vacía de filas de aplicación.
 * Después `main()` vuelve a crear roles, usuarios demo, catálogos, unidades con placa, jornadas de ejemplo, etc.
 */
async function limpiarBaseDatos() {
  await prisma.$transaction(async (tx) => {
    await tx.eventoAuditoria.deleteMany();
    await tx.detalleDevolucion.deleteMany();
    await tx.devolucion.deleteMany();
    await tx.detalleAbastecimiento.deleteMany();
    await tx.abastecimiento.deleteMany();
    await tx.movimientoInventario.deleteMany();
    await tx.inventarioAlmacen.deleteMany();
    await tx.producto.deleteMany();
    await tx.ubicacionJornada.deleteMany();
    await tx.jornada.deleteMany();
    await tx.asignacionUnidadVendedor.deleteMany();
    await tx.unidadMovil.deleteMany();
    await tx.catalogoEstadoUnidadMovil.deleteMany();
    await tx.vendedor.deleteMany();
    await tx.almacen.deleteMany();
    await tx.usuario.deleteMany();
    await tx.unidadMedida.deleteMany();
    await tx.categoriaProducto.deleteMany();
    await tx.zona.deleteMany();
    await tx.rol.deleteMany();
  });
}

async function main() {
  console.log("Borrando datos existentes y recargando escenario de prueba (Release 1)…");
  await limpiarBaseDatos();

  const roleAdmin = await prisma.rol.create({
    data: { name: "ADMINISTRADOR", description: "Control total del sistema" },
  });
  const roleWarehouse = await prisma.rol.create({
    data: { name: "ALMACEN", description: "Encargado de entregas y devoluciones" },
  });
  const roleSupervisor = await prisma.rol.create({
    data: { name: "SUPERVISOR", description: "Supervisión operativa" },
  });

  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "FastFood2026!";
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  await prisma.usuario.create({
    data: {
      roleId: roleAdmin.id,
      username: "ADMINISTRADOR",
      passwordHash,
      fullName: "Administrador General",
      email: "admin@fastfood.bo",
    },
  });
  await prisma.usuario.create({
    data: {
      roleId: roleWarehouse.id,
      username: "ALMACEN",
      passwordHash,
      fullName: "Responsable de almacen",
      email: "almacen@fastfood.bo",
    },
  });
  await prisma.usuario.create({
    data: {
      roleId: roleSupervisor.id,
      username: "SUPERVISOR",
      passwordHash,
      fullName: "Supervisor de operaciones",
      email: "supervisor@fastfood.bo",
    },
  });

  const categoryFood = await prisma.categoriaProducto.create({
    data: { name: "Alimentos" },
  });
  const categoryDrink = await prisma.categoriaProducto.create({
    data: { name: "Bebidas" },
  });
  const categorySupply = await prisma.categoriaProducto.create({
    data: { name: "Insumos" },
  });

  const unitPiece = await prisma.unidadMedida.create({
    data: { code: "UND", name: "Unidad", isActive: true },
  });
  const unitKg = await prisma.unidadMedida.create({
    data: { code: "KG", name: "Kilogramo", isActive: true },
  });

  const sellers = await Promise.all([
    prisma.vendedor.create({
      data: { identityDocument: "7845123", fullName: "Juan Perez", phone: "70011223" },
    }),
    prisma.vendedor.create({
      data: { identityDocument: "6723419", fullName: "Maria Rojas", phone: "72133456" },
    }),
    prisma.vendedor.create({
      data: { identityDocument: "5918234", fullName: "Carlos Vega", phone: "73445566" },
    }),
  ]);

  await prisma.zona.createMany({
    data: [
      { name: "Equipetrol", description: "Zona norte", isActive: true },
      { name: "Zona Universitaria", description: "Zona sur", isActive: true },
      { name: "Centro", description: "Centro urbano", isActive: true },
    ],
  });

  await prisma.catalogoEstadoUnidadMovil.createMany({
    data: [
      { code: "ACTIVA", name: "Activa", sortOrder: 1, isActive: true },
      { code: "MANTENIMIENTO", name: "Mantenimiento", sortOrder: 2, isActive: true },
      { code: "FUERA_DE_SERVICIO", name: "Fuera de servicio", sortOrder: 3, isActive: true },
    ],
  });
  const estadoActiva = await prisma.catalogoEstadoUnidadMovil.findUniqueOrThrow({
    where: { code: "ACTIVA" },
  });

  const zonaEquipetrol = await prisma.zona.findFirstOrThrow({ where: { name: "Equipetrol" } });
  const zonaUni = await prisma.zona.findFirstOrThrow({ where: { name: "Zona Universitaria" } });
  const zonaCentro = await prisma.zona.findFirstOrThrow({ where: { name: "Centro" } });

  const units = await Promise.all([
    prisma.unidadMovil.create({
      data: {
        code: "UM-01",
        plate: "3892-ABC",
        description: "Food truck demo — cobertura norte (la zona por salida se elige al planificar la jornada)",
        operationalStatusId: estadoActiva.id,
      },
    }),
    prisma.unidadMovil.create({
      data: {
        code: "UM-02",
        plate: "2104-XYZ",
        description: null,
        operationalStatusId: estadoActiva.id,
      },
    }),
    prisma.unidadMovil.create({
      data: {
        code: "UM-03",
        plate: "5520-CNT",
        description: "Unidad centro",
        operationalStatusId: estadoActiva.id,
      },
    }),
  ]);

  await prisma.asignacionUnidadVendedor.createMany({
    data: [
      { unitId: units[0].id, sellerId: sellers[0].id, startDate: new Date("2026-03-01"), isCurrent: true },
      { unitId: units[1].id, sellerId: sellers[1].id, startDate: new Date("2026-03-01"), isCurrent: true },
      { unitId: units[2].id, sellerId: sellers[2].id, startDate: new Date("2026-03-01"), isCurrent: true },
    ],
  });

  const products = await Promise.all([
    prisma.producto.create({
      data: { code: "P001", name: "Pan de hamburguesa", categoryId: categoryFood.id, measureUnitId: unitPiece.id },
    }),
    prisma.producto.create({
      data: { code: "P002", name: "Carne para hamburguesa", categoryId: categoryFood.id, measureUnitId: unitKg.id },
    }),
    prisma.producto.create({
      data: { code: "P003", name: "Gaseosa", categoryId: categoryDrink.id, measureUnitId: unitPiece.id },
    }),
    prisma.producto.create({
      data: { code: "P004", name: "Servilletas", categoryId: categorySupply.id, measureUnitId: unitPiece.id },
    }),
  ]);

  const warehouse = await prisma.almacen.create({
    data: { code: "ALM-01", name: "Almacen Central", address: "Av. Central 123" },
  });

  /** Stock inicial demo: P004 bajo mínimo para probar alertas (HU4). */
  const stocks: { productId: string; currentQty: number; minimumQty: number }[] = [
    { productId: products[0].id, currentQty: 100, minimumQty: 20 },
    { productId: products[1].id, currentQty: 100, minimumQty: 20 },
    { productId: products[2].id, currentQty: 100, minimumQty: 20 },
    { productId: products[3].id, currentQty: 8, minimumQty: 25 },
  ];

  for (const s of stocks) {
    await prisma.inventarioAlmacen.create({
      data: {
        warehouseId: warehouse.id,
        productId: s.productId,
        currentQty: s.currentQty,
        minimumQty: s.minimumQty,
      },
    });
  }

  const userAlmacen = await prisma.usuario.findFirstOrThrow({ where: { username: "ALMACEN" } });

  await prisma.jornada.create({
    data: {
      unitId: units[0].id,
      sellerId: sellers[0].id,
      zoneId: zonaEquipetrol.id,
      operationDate: fechaOp(2026, 3, 28),
      startTime: hora(20, 0),
      endTime: hora(3, 0),
      status: JourneyStatus.PLANNED,
    },
  });

  await prisma.jornada.create({
    data: {
      unitId: units[1].id,
      sellerId: sellers[1].id,
      zoneId: zonaUni.id,
      operationDate: fechaOp(2026, 3, 29),
      startTime: hora(21, 30),
      endTime: hora(3, 0),
      status: JourneyStatus.PLANNED,
    },
  });

  const jornadaConEntregaDemo = await prisma.jornada.create({
    data: {
      unitId: units[2].id,
      sellerId: sellers[2].id,
      zoneId: zonaCentro.id,
      operationDate: fechaOp(2026, 3, 25),
      startTime: hora(19, 0),
      endTime: hora(2, 30),
      status: JourneyStatus.PLANNED,
    },
  });

  await registrarAbastecimiento(
    prisma,
    {
      idJornada: jornadaConEntregaDemo.id,
      lineas: [
        { idProducto: products[0].id, cantidad: 12 },
        { idProducto: products[2].id, cantidad: 8 },
      ],
      nota: "Demostración seed: entrega registrada automáticamente",
    },
    userAlmacen.id,
  );

  console.log(
    "Seed completado: 3 vendedores, 3 unidades móviles, 3 zonas, 3 jornadas (2 planificadas + 1 con abastecimiento demo), inventario actualizado.",
  );
}

main()
  .catch((error) => {
    console.error("Error en seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
