import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding RAGEN RESORT POS database...");

  // Remove legacy @reganresort.com accounts after rebrand
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@reganresort.com" } },
  });

  await prisma.settings.upsert({
    where: { id: "default" },
    update: {
      businessName: "RAGEN RESORT",
      email: "info@ragenresort.com",
      receiptFooter: "Thank you for choosing RAGEN RESORT! Karibu tena.",
    },
    create: {
      id: "default",
      businessName: "RAGEN RESORT",
      businessAddress: "Malindi Road, Watamu, Kenya",
      phone: "+254 700 000 000",
      email: "info@ragenresort.com",
      receiptFooter: "Thank you for choosing RAGEN RESORT! Karibu tena.",
      taxRate: 16,
      currency: "KES",
    },
  });

  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@ragenresort.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@ragenresort.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  const cashierPassword = await bcrypt.hash("cashier123", 12);
  await prisma.user.upsert({
    where: { email: "cashier@ragenresort.com" },
    update: {},
    create: {
      name: "Main Cashier",
      email: "cashier@ragenresort.com",
      password: cashierPassword,
      role: "CASHIER",
    },
  });

  const roleUsers = [
    { name: "Restaurant Staff", email: "restaurant@ragenresort.com", password: "restaurant123", role: "RESTAURANT" as const },
    { name: "Bar Staff", email: "bar@ragenresort.com", password: "bar123", role: "BAR" as const },
    { name: "Room Manager", email: "rooms@ragenresort.com", password: "rooms123", role: "ROOM_MANAGER" as const },
  ];

  for (const u of roleUsers) {
    const hashed = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, password: hashed, role: u.role },
    });
  }

  const categories = [
    { name: "Beer", type: "ALCOHOL", description: "Local and imported beers" },
    { name: "Wine", type: "ALCOHOL", description: "Red and white wines" },
    { name: "Whisky", type: "ALCOHOL", description: "Premium spirits" },
    { name: "Soft Drinks", type: "BAR", description: "Sodas and juices" },
    { name: "Water", type: "BAR", description: "Bottled water" },
    { name: "Food", type: "FOOD", description: "Main dishes" },
    { name: "Snacks", type: "FOOD", description: "Light bites" },
    { name: "Room Service", type: "ROOM_SERVICE", description: "In-room dining" },
  ];

  const categoryMap: Record<string, string> = {};
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categoryMap[cat.name] = created.id;
  }

  const products = [
    { name: "Tusker", sku: "BEER-001", category: "Beer", sellingPrice: 250, costPrice: 150, stock: 100 },
    { name: "White Cap", sku: "BEER-002", category: "Beer", sellingPrice: 250, costPrice: 150, stock: 80 },
    { name: "Guinness", sku: "BEER-003", category: "Beer", sellingPrice: 300, costPrice: 180, stock: 60 },
    { name: "Smirnoff", sku: "WHS-001", category: "Whisky", sellingPrice: 350, costPrice: 200, stock: 40 },
    { name: "Johnnie Walker", sku: "WHS-002", category: "Whisky", sellingPrice: 500, costPrice: 350, stock: 30 },
    { name: "Coca-Cola", sku: "SD-001", category: "Soft Drinks", sellingPrice: 100, costPrice: 50, stock: 200 },
    { name: "Fanta", sku: "SD-002", category: "Soft Drinks", sellingPrice: 100, costPrice: 50, stock: 200 },
    { name: "Sprite", sku: "SD-003", category: "Soft Drinks", sellingPrice: 100, costPrice: 50, stock: 150 },
    { name: "Water", sku: "WTR-001", category: "Water", sellingPrice: 80, costPrice: 30, stock: 300 },
    { name: "Pilau", sku: "FOOD-001", category: "Food", sellingPrice: 450, costPrice: 200, stock: 50 },
    { name: "Chicken", sku: "FOOD-002", category: "Food", sellingPrice: 600, costPrice: 300, stock: 40 },
    { name: "Beef Stew", sku: "FOOD-003", category: "Food", sellingPrice: 550, costPrice: 280, stock: 35 },
    { name: "Chips", sku: "FOOD-004", category: "Snacks", sellingPrice: 200, costPrice: 80, stock: 60 },
    { name: "Ugali", sku: "FOOD-005", category: "Food", sellingPrice: 100, costPrice: 40, stock: 50 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: {
        name: product.name,
        sku: product.sku,
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice,
        stock: product.stock,
        lowStockAlert: 10,
        categoryId: categoryMap[product.category],
      },
    });
  }

  const roomNumbers = ["101", "102", "103", "104", "105", "106", "107", "108", "109", "110"];
  const roomTypes = ["Standard", "Deluxe", "Suite"];
  for (let i = 0; i < roomNumbers.length; i++) {
    const type = roomTypes[i % roomTypes.length];
    const price = type === "Standard" ? 3500 : type === "Deluxe" ? 5500 : 8500;
    await prisma.room.upsert({
      where: { number: roomNumbers[i] },
      update: {},
      create: {
        number: roomNumbers[i],
        type,
        pricePerNight: price,
        capacity: type === "Suite" ? 4 : 2,
        description: `${type} room with ocean view`,
        floor: Math.ceil(parseInt(roomNumbers[i]) / 100),
        status: "AVAILABLE",
      },
    });
  }

  const supplier = await prisma.supplier.upsert({
    where: { id: "default-supplier" },
    update: {},
    create: {
      id: "default-supplier",
      name: "Coast Supplies Ltd",
      phone: "+254 722 000 000",
      email: "orders@coastsupplies.co.ke",
      address: "Mombasa, Kenya",
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: admin.id,
      action: "SEED",
      entity: "Database",
      details: "Initial seed data loaded",
    },
  });

  console.log("IMPORTANT: Change the admin password after production deployment!");
  console.log("Admin:     admin@ragenresort.com / admin123");
  console.log("Cashier:   cashier@ragenresort.com / cashier123");
  console.log("Restaurant: restaurant@ragenresort.com / restaurant123");
  console.log("Bar:       bar@ragenresort.com / bar123");
  console.log("Rooms:     rooms@ragenresort.com / rooms123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
