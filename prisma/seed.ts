import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DRY_CLEAN = "seed-svc-dry-clean";
const WASH_FOLD = "seed-svc-wash-fold";
const SHOES = "seed-svc-shoes";
const OTHER = "seed-svc-other";

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  await prisma.user.upsert({
    where: { email: "admin@laundry.local" },
    update: { passwordHash, role: Role.ADMIN, isActive: true },
    create: {
      email: "admin@laundry.local",
      name: "Admin User",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "reception@laundry.local" },
    update: { passwordHash, role: Role.RECEPTION, isActive: true },
    create: {
      email: "reception@laundry.local",
      name: "Reception User",
      passwordHash,
      role: Role.RECEPTION,
    },
  });

  const categories: {
    id: string;
    name: string;
    sortOrder: number;
    allowsCustomPricing: boolean;
    items: { id: string; name: string; price: string; sortOrder: number }[];
  }[] = [
    {
      id: DRY_CLEAN,
      name: "Dry Clean",
      sortOrder: 10,
      allowsCustomPricing: false,
      items: [
        { id: "seed-item-full-suit", name: "Full Suit", price: "3.00", sortOrder: 10 },
        { id: "seed-item-single-jacket", name: "Single Jacket", price: "3.00", sortOrder: 20 },
      ],
    },
    {
      id: WASH_FOLD,
      name: "Wash and Fold",
      sortOrder: 20,
      allowsCustomPricing: false,
      items: [
        { id: "seed-item-jeans-trouser", name: "Jeans Trouser", price: "3.00", sortOrder: 10 },
        { id: "seed-item-normal-trouser", name: "Normal Trouser", price: "2.00", sortOrder: 20 },
        { id: "seed-item-shirt", name: "Shirt", price: "3.00", sortOrder: 30 },
        { id: "seed-item-underwear", name: "Underwear", price: "0.50", sortOrder: 40 },
        { id: "seed-item-tshirt", name: "T-Shirt", price: "2.00", sortOrder: 50 },
        { id: "seed-item-shorts", name: "Shorts", price: "2.00", sortOrder: 60 },
        { id: "seed-item-socks", name: "Socks", price: "2.00", sortOrder: 70 },
        { id: "seed-item-towel", name: "Towel", price: "2.00", sortOrder: 80 },
        { id: "seed-item-bedsheet", name: "Bedsheet", price: "2.00", sortOrder: 90 },
        { id: "seed-item-pillow-cover", name: "Pillow Cover", price: "2.00", sortOrder: 100 },
      ],
    },
    {
      id: SHOES,
      name: "Shoes",
      sortOrder: 30,
      allowsCustomPricing: false,
      items: [
        { id: "seed-item-sneakers", name: "Sneakers", price: "3.00", sortOrder: 10 },
        { id: "seed-item-leather-shoes", name: "Leather Shoes", price: "3.00", sortOrder: 20 },
        { id: "seed-item-sandals", name: "Sandals", price: "2.00", sortOrder: 30 },
        { id: "seed-item-boots", name: "Boots", price: "3.00", sortOrder: 40 },
      ],
    },
    {
      id: OTHER,
      name: "Other",
      sortOrder: 40,
      allowsCustomPricing: true,
      items: [],
    },
  ];

  for (const c of categories) {
    await prisma.serviceCategory.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        sortOrder: c.sortOrder,
        isActive: true,
        allowsCustomPricing: c.allowsCustomPricing,
      },
      create: {
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        allowsCustomPricing: c.allowsCustomPricing,
      },
    });
    for (const item of c.items) {
      await prisma.serviceItem.upsert({
        where: {
          serviceCategoryId_name: {
            serviceCategoryId: c.id,
            name: item.name,
          },
        },
        update: {
          defaultPrice: item.price,
          sortOrder: item.sortOrder,
          isActive: true,
        },
        create: {
          id: item.id,
          serviceCategoryId: c.id,
          name: item.name,
          defaultPrice: item.price,
          sortOrder: item.sortOrder,
        },
      });
    }
  }

  const expenseCategories = [
    { name: "Rent", sortOrder: 10 },
    { name: "Utilities", sortOrder: 20 },
    { name: "Supplies", sortOrder: 30 },
    { name: "Payroll", sortOrder: 40 },
    { name: "Marketing", sortOrder: 50 },
    { name: "Equipment", sortOrder: 60 },
    { name: "Maintenance", sortOrder: 70 },
    { name: "Other", sortOrder: 99 },
  ];

  for (const c of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { name: c.name },
      update: { sortOrder: c.sortOrder, isActive: true },
      create: { name: c.name, sortOrder: c.sortOrder },
    });
  }

  console.log(
    "Seed done: users, service catalog, expense categories. Password: Password123!",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
