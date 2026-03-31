import { PrismaClient, ProductType, UnitStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sellers = [
    { fullName: "Juan Perez", documentId: "7845123", phone: "70011223" },
    { fullName: "Maria Rojas", documentId: "6723419", phone: "72133456" },
    { fullName: "Carlos Vaca", documentId: "5984421", phone: "77321987" },
  ];

  for (const seller of sellers) {
    await prisma.seller.upsert({
      where: { documentId: seller.documentId },
      update: {
        fullName: seller.fullName,
        phone: seller.phone,
        isActive: true,
      },
      create: {
        ...seller,
        isActive: true,
      },
    });
  }

  const products = [
    { code: "P001", name: "Pan de hamburguesa", type: ProductType.FOOD, unitMeasure: "unidad" },
    { code: "P002", name: "Carne para hamburguesa", type: ProductType.FOOD, unitMeasure: "kg" },
    { code: "P003", name: "Papas para freir", type: ProductType.FOOD, unitMeasure: "kg" },
    { code: "P004", name: "Gaseosa", type: ProductType.DRINK, unitMeasure: "botella" },
    { code: "P005", name: "Servilletas", type: ProductType.SUPPLY, unitMeasure: "paquete" },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: {
        name: product.name,
        type: product.type,
        unitMeasure: product.unitMeasure,
        isActive: true,
      },
      create: {
        ...product,
        isActive: true,
      },
    });
  }

  const juan = await prisma.seller.findUnique({ where: { documentId: "7845123" } });
  const maria = await prisma.seller.findUnique({ where: { documentId: "6723419" } });

  const mobileUnits = [
    {
      code: "UM-01",
      zone: "Equipetrol",
      latitude: "-17.7833",
      longitude: "-63.1821",
      status: UnitStatus.ACTIVE,
      sellerId: juan?.id ?? null,
    },
    {
      code: "UM-02",
      zone: "Zona Universitaria",
      latitude: "-17.7808",
      longitude: "-63.1706",
      status: UnitStatus.ACTIVE,
      sellerId: maria?.id ?? null,
    },
  ];

  for (const unit of mobileUnits) {
    await prisma.mobileUnit.upsert({
      where: { code: unit.code },
      update: {
        zone: unit.zone,
        latitude: unit.latitude,
        longitude: unit.longitude,
        status: unit.status,
        sellerId: unit.sellerId,
        isActive: true,
      },
      create: {
        code: unit.code,
        zone: unit.zone,
        latitude: unit.latitude,
        longitude: unit.longitude,
        status: unit.status,
        sellerId: unit.sellerId,
        isActive: true,
      },
    });
  }

  console.log("Seed completado: productos, vendedores y unidades moviles.");
}

main()
  .catch((error) => {
    console.error("Error en seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
