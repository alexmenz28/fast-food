import { AuditAction, PrismaClient, JourneyStatus, MobileUnitStatus, MovementType, ReferenceType, SupplyStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Elimina datos operativos y de catálogo en orden compatible con FKs.
 * Tras esto el seed vuelve a insertar solo los datos de prueba definidos aquí
 * (incluye roles, usuarios, categorías, unidades de medida UND/KG únicamente).
 */
async function limpiarBaseDatos() {
  await prisma.$transaction(async (tx) => {
    await tx.auditEvent.deleteMany();
    await tx.returnDetail.deleteMany();
    await tx.return.deleteMany();
    await tx.supplyDetail.deleteMany();
    await tx.supply.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.warehouseStock.deleteMany();
    await tx.product.deleteMany();
    await tx.journeyLocation.deleteMany();
    await tx.journey.deleteMany();
    await tx.unitSellerAssignment.deleteMany();
    await tx.mobileUnit.deleteMany();
    await tx.seller.deleteMany();
    await tx.warehouse.deleteMany();
    await tx.user.deleteMany();
    await tx.measureUnit.deleteMany();
    await tx.productCategory.deleteMany();
    await tx.zone.deleteMany();
    await tx.role.deleteMany();
  });
}

async function main() {
  console.log("Limpiando base de datos para volver a datos de prueba…");
  await limpiarBaseDatos();

  const roleAdmin = await prisma.role.create({
    data: { name: "ADMINISTRADOR", description: "Control total del sistema" },
  });
  const roleWarehouse = await prisma.role.create({
    data: { name: "ALMACEN", description: "Encargado de entregas y devoluciones" },
  });
  const roleSupervisor = await prisma.role.create({
    data: { name: "SUPERVISOR", description: "Supervisión operativa" },
  });

  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "FastFood2026!";
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  const adminUser = await prisma.user.create({
    data: {
      roleId: roleAdmin.id,
      username: "ADMINISTRADOR",
      passwordHash,
      fullName: "Administrador General",
      email: "admin@fastfood.bo",
    },
  });
  const warehouseUser = await prisma.user.create({
    data: {
      roleId: roleWarehouse.id,
      username: "ALMACEN",
      passwordHash,
      fullName: "Responsable de almacen",
      email: "almacen@fastfood.bo",
    },
  });
  await prisma.user.create({
    data: {
      roleId: roleSupervisor.id,
      username: "SUPERVISOR",
      passwordHash,
      fullName: "Supervisor de operaciones",
      email: "supervisor@fastfood.bo",
    },
  });

  const categoryFood = await prisma.productCategory.create({
    data: { name: "Alimentos" },
  });
  const categoryDrink = await prisma.productCategory.create({
    data: { name: "Bebidas" },
  });
  const categorySupply = await prisma.productCategory.create({
    data: { name: "Insumos" },
  });

  /** Catálogo cerrado: solo Unidad y Kilogramo (códigos UND, KG). */
  const unitPiece = await prisma.measureUnit.create({
    data: { code: "UND", name: "Unidad", isActive: true },
  });
  const unitKg = await prisma.measureUnit.create({
    data: { code: "KG", name: "Kilogramo", isActive: true },
  });

  const sellers = await Promise.all([
    prisma.seller.create({
      data: { identityDocument: "7845123", fullName: "Juan Perez", phone: "70011223" },
    }),
    prisma.seller.create({
      data: { identityDocument: "6723419", fullName: "Maria Rojas", phone: "72133456" },
    }),
  ]);

  const units = await Promise.all([
    prisma.mobileUnit.create({
      data: { code: "UM-01", description: "Zona: Equipetrol", operationalStatus: MobileUnitStatus.ACTIVE },
    }),
    prisma.mobileUnit.create({
      data: { code: "UM-02", description: "Zona: Zona Universitaria", operationalStatus: MobileUnitStatus.ACTIVE },
    }),
  ]);

  await prisma.unitSellerAssignment.createMany({
    data: [
      { unitId: units[0].id, sellerId: sellers[0].id, startDate: new Date("2026-03-01"), isCurrent: true },
      { unitId: units[1].id, sellerId: sellers[1].id, startDate: new Date("2026-03-01"), isCurrent: true },
    ],
  });

  const zone = await prisma.zone.create({
    data: { name: "Equipetrol", description: "Zona de alta demanda nocturna" },
  });

  const products = await Promise.all([
    prisma.product.create({
      data: { code: "P001", name: "Pan de hamburguesa", categoryId: categoryFood.id, measureUnitId: unitPiece.id },
    }),
    prisma.product.create({
      data: { code: "P002", name: "Carne para hamburguesa", categoryId: categoryFood.id, measureUnitId: unitKg.id },
    }),
    prisma.product.create({
      data: { code: "P003", name: "Gaseosa", categoryId: categoryDrink.id, measureUnitId: unitPiece.id },
    }),
    prisma.product.create({
      data: { code: "P004", name: "Servilletas", categoryId: categorySupply.id, measureUnitId: unitPiece.id },
    }),
  ]);

  const warehouse = await prisma.warehouse.create({
    data: { code: "ALM-01", name: "Almacen Central", address: "Av. Central 123" },
  });

  for (const product of products) {
    await prisma.warehouseStock.create({
      data: {
        warehouseId: warehouse.id,
        productId: product.id,
        currentQty: 100,
        minimumQty: 20,
      },
    });
  }

  const journey = await prisma.journey.create({
    data: {
      unitId: units[0].id,
      sellerId: sellers[0].id,
      zoneId: zone.id,
      operationDate: new Date("2026-03-31"),
      startTime: new Date("1970-01-01T18:00:00.000Z"),
      endTime: new Date("1970-01-01T03:00:00.000Z"),
      status: JourneyStatus.CLOSED,
    },
  });

  await prisma.journeyLocation.create({
    data: {
      journeyId: journey.id,
      latitude: "-17.7833000",
      longitude: "-63.1821000",
      pointType: "INICIO",
      timestamp: new Date(),
    },
  });

  const supply = await prisma.supply.create({
    data: {
      journeyId: journey.id,
      warehouseId: warehouse.id,
      deliveredById: warehouseUser.id,
      deliveredAt: new Date(),
      status: SupplyStatus.CLOSED,
      details: {
        create: [
          { productId: products[0].id, qtyGiven: 50 },
          { productId: products[1].id, qtyGiven: 30 },
        ],
      },
    },
  });

  const returned = await prisma.return.create({
    data: {
      supplyId: supply.id,
      receivedById: warehouseUser.id,
      returnedAt: new Date(),
      details: {
        create: [
          { productId: products[0].id, qtyReturned: 8, qtyDamaged: 1 },
          { productId: products[1].id, qtyReturned: 5, qtyDamaged: 0 },
        ],
      },
    },
  });

  await prisma.stockMovement.create({
    data: {
      warehouseId: warehouse.id,
      productId: products[0].id,
      userId: warehouseUser.id,
      movementType: MovementType.OUT,
      quantity: 50,
      referenceType: ReferenceType.SUPPLY,
      referenceId: supply.id,
      note: "Entrega a unidad movil",
    },
  });

  await prisma.auditEvent.create({
    data: {
      userId: adminUser.id,
      entity: "SUPPLY",
      recordId: supply.id,
      action: AuditAction.CREATE,
      afterData: { supplyId: supply.id, returnId: returned.id },
      ip: "127.0.0.1",
    },
  });

  console.log("Seed completado: base limpia, unidades de medida UND (Unidad) y KG (Kilogramo) solamente.");
}

main()
  .catch((error) => {
    console.error("Error en seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
