import { PrismaClient } from "./src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Create default admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);

  try {
    const adminUser = await prisma.users.upsert({
      where: { username: "admin" },
      update: {},
      create: {
        username: "admin",
        password: hashedPassword,
      },
    });
    console.log("✅ Admin user created:", adminUser.username);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  }

  // Create some sample categories
  const categories = [
    {
      name: "الإلكترونيات",
      imageUrl: "https://via.placeholder.com/300x200?text=الإلكترونيات",
    },
    {
      name: "الملابس",
      imageUrl: "https://via.placeholder.com/300x200?text=الملابس",
    },
    {
      name: "الأثاث",
      imageUrl: "https://via.placeholder.com/300x200?text=الأثاث",
    },
  ];

  for (const categoryData of categories) {
    try {
      const existingCategory = await prisma.category.findFirst({
        where: { name: categoryData.name },
      });

      if (!existingCategory) {
        const category = await prisma.category.create({
          data: categoryData,
        });
        console.log("✅ Category created:", category.name);
      } else {
        console.log("⏭️ Category already exists:", categoryData.name);
      }
    } catch (error) {
      console.error("❌ Error creating category:", error);
    }
  }

  // Create some sample products
  const products = [
    {
      name: "هاتف ذكي",
      description: "هاتف ذكي حديث مع كاميرا عالية الجودة",
      price: 500,
      imageUrl: "https://via.placeholder.com/300x300?text=هاتف+ذكي",
      categoryName: "الإلكترونيات",
    },
    {
      name: "لابتوب",
      description: "لابتوب للأعمال والألعاب",
      price: 1200,
      imageUrl: "https://via.placeholder.com/300x300?text=لابتوب",
      categoryName: "الإلكترونيات",
    },
    {
      name: "قميص رجالي",
      description: "قميص رجالي أنيق",
      price: 50,
      imageUrl: "https://via.placeholder.com/300x300?text=قميص+رجالي",
      categoryName: "الملابس",
    },
    {
      name: "طاولة مكتب",
      description: "طاولة مكتب خشبية عالية الجودة",
      price: 300,
      imageUrl: "https://via.placeholder.com/300x300?text=طاولة+مكتب",
      categoryName: "الأثاث",
    },
  ];

  for (const productData of products) {
    try {
      const category = await prisma.category.findFirst({
        where: { name: productData.categoryName },
      });

      if (category) {
        const existingProduct = await prisma.products.findFirst({
          where: { name: productData.name },
        });

        if (!existingProduct) {
          const product = await prisma.products.create({
            data: {
              name: productData.name,
              description: productData.description,
              price: productData.price,
              imageUrl: productData.imageUrl,
              categoryId: category.id,
            },
          });
          console.log("✅ Product created:", product.name);
        } else {
          console.log("⏭️ Product already exists:", productData.name);
        }
      }
    } catch (error) {
      console.error("❌ Error creating product:", error);
    }
  }

  console.log("🎉 Database seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
