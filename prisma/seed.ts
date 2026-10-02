import { PrismaClient, UserRole, LocationType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding StockSense database...");

  // 1. Seed Demo Users
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const manager = await prisma.user.upsert({
    where: { email: "manager@stocksense.io" },
    update: {},
    create: {
      name: "Alex Inventory Manager",
      email: "manager@stocksense.io",
      passwordHash,
      role: UserRole.INVENTORY_MANAGER,
      isActive: true,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@stocksense.io" },
    update: {},
    create: {
      name: "Sam Warehouse Staff",
      email: "staff@stocksense.io",
      passwordHash,
      role: UserRole.WAREHOUSE_STAFF,
      isActive: true,
    },
  });

  const verifiedUser = await prisma.user.upsert({
    where: { email: "hkinvincible021@gmail.com" },
    update: {},
    create: {
      name: "HK Invincible",
      email: "hkinvincible021@gmail.com",
      passwordHash,
      role: UserRole.INVENTORY_MANAGER,
      isActive: true,
    },
  });

  console.log(`✓ Seeded users: ${manager.email}, ${staff.email}, ${verifiedUser.email}`);

  // 2. Seed Default Categories
  const rawMaterials = await prisma.category.upsert({
    where: { name: "Raw Materials" },
    update: {},
    create: {
      name: "Raw Materials",
      description: "Basic metals, plastics, and unprocessed inventory",
      isActive: true,
    },
  });

  const electronics = await prisma.category.upsert({
    where: { name: "Electronics & Components" },
    update: {},
    create: {
      name: "Electronics & Components",
      description: "Semiconductors, PCBs, motors, and wiring",
      isActive: true,
    },
  });

  const finishedGoods = await prisma.category.upsert({
    where: { name: "Finished Goods" },
    update: {},
    create: {
      name: "Finished Goods",
      description: "Assembled and packaged consumer goods",
      isActive: true,
    },
  });

  const packaging = await prisma.category.upsert({
    where: { name: "Packaging Supplies" },
    update: {},
    create: {
      name: "Packaging Supplies",
      description: "Boxes, pallets, bubble wrap, and strapping",
      isActive: true,
    },
  });

  console.log("✓ Seeded categories: Raw Materials, Electronics, Finished Goods, Packaging");

  // 3. Seed Warehouses and Storage Locations
  const mainWarehouse = await prisma.warehouse.upsert({
    where: { code: "WH-MAIN" },
    update: {},
    create: {
      name: "Main Warehouse",
      code: "WH-MAIN",
      address: "100 Industrial Parkway, Zone 4",
      isActive: true,
    },
  });

  const rackA = await prisma.location.upsert({
    where: {
      warehouseId_code: {
        warehouseId: mainWarehouse.id,
        code: "WH-MAIN-RACK-A",
      },
    },
    update: {},
    create: {
      name: "Rack A",
      code: "WH-MAIN-RACK-A",
      warehouseId: mainWarehouse.id,
      type: LocationType.INTERNAL,
      isScrap: false,
      isActive: true,
    },
  });

  const rackB = await prisma.location.upsert({
    where: {
      warehouseId_code: {
        warehouseId: mainWarehouse.id,
        code: "WH-MAIN-RACK-B",
      },
    },
    update: {},
    create: {
      name: "Rack B",
      code: "WH-MAIN-RACK-B",
      warehouseId: mainWarehouse.id,
      type: LocationType.INTERNAL,
      isScrap: false,
      isActive: true,
    },
  });

  console.log("✓ Seeded warehouse & locations: Main Warehouse (Rack A, Rack B)");

  // 4. Seed Initial Products (Demo Catalog)
  const products = [
    {
      name: "Steel Rod",
      sku: "ST-001",
      description: "Industrial grade structural steel rod",
      uom: "KG",
      minimumStock: 50,
      categoryId: rawMaterials.id,
      initialLocationId: rackA.id,
      initialQty: 100,
    },
    {
      name: "Copper Rod 10mm x 2m",
      sku: "RAW-CPR-010",
      description: "Pure electrolytic grade copper conductor rod",
      uom: "M",
      minimumStock: 30,
      categoryId: rawMaterials.id,
      initialLocationId: rackA.id,
      initialQty: 25,
    },
    {
      name: "High Torque Servo Motor 24V",
      sku: "ENG-SRV-024",
      description: "Precision brushless DC servo motor with optical encoder",
      uom: "PCS",
      minimumStock: 50,
      categoryId: electronics.id,
      initialLocationId: rackB.id,
      initialQty: 0,
    },
    {
      name: "Heavy Duty Corrugated Box (L)",
      sku: "PKG-BOX-LRG",
      description: "Double wall cardboard shipping box 60x40x40cm",
      uom: "BOX",
      minimumStock: 100,
      categoryId: packaging.id,
      initialLocationId: rackA.id,
      initialQty: 200,
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { minimumStock: p.minimumStock },
      create: {
        name: p.name,
        sku: p.sku,
        description: p.description,
        uom: p.uom,
        categoryId: p.categoryId,
        minimumStock: p.minimumStock,
        isActive: true,
      },
    });

    if (p.initialLocationId && p.initialQty > 0) {
      await prisma.stock.upsert({
        where: {
          productId_locationId: {
            productId: product.id,
            locationId: p.initialLocationId,
          },
        },
        update: { quantity: p.initialQty },
        create: {
          productId: product.id,
          locationId: p.initialLocationId,
          quantity: p.initialQty,
        },
      });
    }
  }

  console.log("✓ Seeded sample inventory products with minimum stock thresholds");
  console.log("🎉 Seed finished successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
