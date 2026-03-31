import { AuditAction, PrismaClient, JourneyStatus, MobileUnitStatus, MovementType, ReferenceType, SupplyStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roleAdmin = await prisma.role.upsert({
    where: { name: "ADMINISTRADOR" },
    update: {},
    create: { name: "ADMINISTRADOR", description: "Control total del sistema" },
  });
  const roleWarehouse = await prisma.role.upsert({
    where: { name: "ALMACEN" },
    update: {},
    create: { name: "ALMACEN", description: "Encargado de entregas y devoluciones" },
  });
  await prisma.role.upsert({
    where: { name: "SUPERVISOR" },
    update: {},
    create: { name: "SUPERVISOR", description: "Supervisión operativa" },
  });

  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      roleId: roleAdmin.id,
      username: "admin",
      passwordHash: "mock-hash-admin",
      fullName: "Administrador General",
      email: "admin@fastfood.bo",
    },
  });
  const warehouseUser = await prisma.user.upsert({
    where: { username: "almacen" },
    update: {},
    create: {
      roleId: roleWarehouse.id,
      username: "almacen",
      passwordHash: "mock-hash-almacen",
      fullName: "Responsable de Almacen",
      email: "almacen@fastfood.bo",
    },
  });

  const categoryFood = await prisma.productCategory.upsert({
    where: { name: "Alimentos" },
    update: {},
    create: { name: "Alimentos" },
  });
  const categoryDrink = await prisma.productCategory.upsert({
    where: { name: "Bebidas" },
    update: {},
    create: { name: "Bebidas" },
  });
  const categorySupply = await prisma.productCategory.upsert({
    where: { name: "Insumos" },
    update: {},
    create: { name: "Insumos" },
  });

  const unitPiece = await prisma.measureUnit.upsert({
    where: { code: "UND" },
    update: {},
    create: { code: "UND", name: "Unidad" },
  });
  const unitKg = await prisma.measureUnit.upsert({
    where: { code: "KG" },
    update: {},
    create: { code: "KG", name: "Kilogramo" },
  });

  const sellers = await Promise.all([
    prisma.seller.upsert({
      where: { identityDocument: "7845123" },
      update: { fullName: "Juan Perez", phone: "70011223" },
      create: { identityDocument: "7845123", fullName: "Juan Perez", phone: "70011223" },
    }),
    prisma.seller.upsert({
      where: { identityDocument: "6723419" },
      update: { fullName: "Maria Rojas", phone: "72133456" },
      create: { identityDocument: "6723419", fullName: "Maria Rojas", phone: "72133456" },
    }),
  ]);

  const units = await Promise.all([
    prisma.mobileUnit.upsert({
      where: { code: "UM-01" },
      update: { description: "Zona: Equipetrol", operationalStatus: MobileUnitStatus.ACTIVE },
      create: { code: "UM-01", description: "Zona: Equipetrol", operationalStatus: MobileUnitStatus.ACTIVE },
    }),
    prisma.mobileUnit.upsert({
      where: { code: "UM-02" },
      update: { description: "Zona: Zona Universitaria", operationalStatus: MobileUnitStatus.ACTIVE },
      create: { code: "UM-02", description: "Zona: Zona Universitaria", operationalStatus: MobileUnitStatus.ACTIVE },
    }),
  ]);

  const assignments = [
    { unitId: units[0].id, sellerId: sellers[0].id },
    { unitId: units[1].id, sellerId: sellers[1].id },
  ];
  for (const assignment of assignments) {
    const existing = await prisma.unitSellerAssignment.findFirst({
      where: { unitId: assignment.unitId, sellerId: assignment.sellerId, isCurrent: true },
    });
    if (!existing) {
      await prisma.unitSellerAssignment.create({
        data: {
          unitId: assignment.unitId,
          sellerId: assignment.sellerId,
          startDate: new Date("2026-03-01"),
          isCurrent: true,
        },
      });
    }
  }

  const zone = await prisma.zone.upsert({
    where: { name: "Equipetrol" },
    update: {},
    create: { name: "Equipetrol", description: "Zona de alta demanda nocturna" },
  });

  const products = await Promise.all([
    prisma.product.upsert({
      where: { code: "P001" },
      update: { name: "Pan de hamburguesa", categoryId: categoryFood.id, measureUnitId: unitPiece.id },
      create: { code: "P001", name: "Pan de hamburguesa", categoryId: categoryFood.id, measureUnitId: unitPiece.id },
    }),
    prisma.product.upsert({
      where: { code: "P002" },
      update: { name: "Carne para hamburguesa", categoryId: categoryFood.id, measureUnitId: unitKg.id },
      create: { code: "P002", name: "Carne para hamburguesa", categoryId: categoryFood.id, measureUnitId: unitKg.id },
    }),
    prisma.product.upsert({
      where: { code: "P003" },
      update: { name: "Gaseosa", categoryId: categoryDrink.id, measureUnitId: unitPiece.id },
      create: { code: "P003", name: "Gaseosa", categoryId: categoryDrink.id, measureUnitId: unitPiece.id },
    }),
    prisma.product.upsert({
      where: { code: "P004" },
      update: { name: "Servilletas", categoryId: categorySupply.id, measureUnitId: unitPiece.id },
      create: { code: "P004", name: "Servilletas", categoryId: categorySupply.id, measureUnitId: unitPiece.id },
    }),
  ]);

  const warehouse = await prisma.warehouse.upsert({
    where: { code: "ALM-01" },
    update: {},
    create: { code: "ALM-01", name: "Almacen Central", address: "Av. Central 123" },
  });

  for (const product of products) {
    await prisma.warehouseStock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
      update: { currentQty: 100, minimumQty: 20 },
      create: {
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

  console.log("Seed completado para modelo completo (es).");
}

main()
  .catch((error) => {
    console.error("Error en seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
