import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { db } from "./db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// JWT secret key (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || "sk.dvls df;sdf lsdjfsjdfglsjdkkj";

// Token blacklist to track deleted users (in production, use Redis or database)
const tokenBlacklist = new Set<string>();

// Commission rates for different installment periods
const month18 = 0.38; // 35% commission for 18 months
const month14 = 0.36; // 33% commission for 14 months
const month12 = 0.34; // 30% commission for 12 months
const month10 = 0.32; // 28% commission for 10 months

// Calculate monthly payment for a given price and months
function calculateMonthlyPayment(
  basePrice: number,
  months: number,
  commissionRate: number
): number {
  const totalWithCommission = basePrice * (1 + commissionRate);
  return Math.round(totalWithCommission / months); // Round to whole number
}

// Format number with comma separators
function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Authentication middleware
async function authenticateToken(token: string) {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      return null;
    }

    const res = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      username: string;
    };

    const user = await db.users.findUnique({
      where: { id: res.userId },
      select: { id: true, username: true },
    });

    if (!user) {
      return null;
    }

    return res;
  } catch (error) {
    return null;
  }
}

// Helper function to extract token from Authorization header
function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

const app = new Elysia()
  .use(
    staticPlugin({
      assets: "public",
      prefix: "/",
    })
  )
  // Authentication endpoints
  .post("/api/auth/login", async ({ body }) => {
    try {
      const { username, password } = body as {
        username: string;
        password: string;
      };

      if (!username || !password) {
        return new Response("Username and password are required", {
          status: 400,
        });
      }

      // Find user in database
      const user = await db.users.findFirst({
        where: { username },
      });

      if (!user) {
        return new Response("Invalid credentials", { status: 401 });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return new Response("Invalid credentials", { status: 401 });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      };
    } catch (error) {
      console.error("Login error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .post("/api/auth/register", async ({ body }) => {
    try {
      const { username, password } = body as {
        username: string;
        password: string;
      };

      if (!username || !password) {
        return new Response("Username and password are required", {
          status: 400,
        });
      }

      // Check if user already exists
      const existingUser = await db.users.findFirst({
        where: { username },
      });

      if (existingUser) {
        return new Response("Username already exists", { status: 400 });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await db.users.create({
        data: {
          username,
          password: hashedPassword,
        },
      });

      return {
        message: "User created successfully",
        user: {
          id: user.id,
          username: user.username,
        },
      };
    } catch (error) {
      console.error("Registration error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .get("/api/auth/verify", async ({ headers }) => {
    try {
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("No token provided", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      // Check if user still exists in database
      const user = await db.users.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true },
      });

      if (!user) {
        return new Response("User no longer exists", { status: 401 });
      }

      return {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
        },
      };
    } catch (error) {
      console.error("Token verification error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .post("/api/auth/logout", async ({ headers }) => {
    try {
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("No token provided", { status: 401 });
      }

      // Add token to blacklist
      tokenBlacklist.add(token);

      return new Response("Logged out successfully", { status: 200 });
    } catch (error) {
      console.error("Logout error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .get("/", async () => {
    const categories = await db.category.findMany({
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {},
    });

    // Map categories with product count
    const mappedCategories = categories.map((category) => ({
      id: category.id,
      name: category.name,
      imageUrl: category.imageUrl,
      productCount: category._count.products,
    }));

    const htmlTemplate = await Bun.file("public/index.html").text();

    // Replace the placeholder with actual categories data
    const htmlWithCategories = htmlTemplate.replace(
      "let categories = [];",
      `let categories = ${JSON.stringify(mappedCategories)};`
    );

    return new Response(htmlWithCategories, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  })
  .get("/category/:id", async ({ params }) => {
    return Bun.file("public/category.html");
  })
  .get("/search", async () => {
    return Bun.file("public/search.html");
  })
  .get("/product", () => {
    return Bun.file("public/product.html");
  })
  .get("/components/:component", async ({ params }) => {
    const componentPath = `public/components/${params.component}.html`;
    try {
      return Bun.file(componentPath);
    } catch (error) {
      return new Response("Component not found", { status: 404 });
    }
  })
  // Categories API
  .get("/api/categories", async () => {
    const categories = await db.category.findMany({
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    // Map categories with product count
    const mappedCategories = categories.map((category) => ({
      id: category.id,
      name: category.name,
      imageUrl: category.imageUrl,
      productCount: category._count.products,
    }));

    return mappedCategories;
  })
  .get("/api/categories/:id", async ({ params }) => {
    const category = await db.category.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      return new Response("Category not found", { status: 404 });
    }

    return {
      id: category.id,
      name: category.name,
      imageUrl: category.imageUrl,
      productCount: category._count.products,
    };
  })
  .get("/api/categories/:id/products", async ({ params }) => {
    const products = await db.products.findMany({
      where: { categoryId: params.id },
    });

    // Map database fields to frontend expected format
    const mappedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description || "",
      imageUrl: product.imageUrl,
      price: product.price,
    }));

    return mappedProducts;
  })
  // Search API
  .get("/api/search", async ({ query }) => {
    const searchQuery = query.q;

    if (!searchQuery || searchQuery.trim() === "") {
      return [];
    }

    // Clean and normalize the search query
    const cleanQuery = searchQuery.trim();

    try {
      const products = await db.products.findMany({
        where: {
          OR: [
            {
              name: {
                contains: cleanQuery,
              },
            },
            {
              description: {
                contains: cleanQuery,
              },
            },
          ],
        },
        include: {
          category: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      // Also search in categories and include those products
      const categoryProducts = await db.products.findMany({
        where: {
          categoryId: {
            not: null,
          },
          category: {
            name: {
              contains: cleanQuery,
            },
          },
        },
        include: {
          category: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      // Combine and deduplicate results
      const allProducts = [...products, ...categoryProducts];
      const uniqueProducts = allProducts.filter(
        (product, index, self) =>
          index === self.findIndex((p) => p.id === product.id)
      );

      // Map database fields to frontend expected format
      const mappedProducts = uniqueProducts.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description || "",
        imageUrl: product.imageUrl,
        price: product.price,
        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
            }
          : null,
      }));

      console.log(
        `Search for "${cleanQuery}" returned ${mappedProducts.length} results`
      );
      return mappedProducts;
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  })
  // Products API (updated)
  .get("/api/products", async () => {
    const products = await db.products.findMany({
      include: {
        category: true,
      },
    });

    // Map database fields to frontend expected format
    const mappedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description || "",
      imageUrl: product.imageUrl,
      price: product.price,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
          }
        : null,
    }));

    return mappedProducts;
  })
  .get("/api/products/:id", async ({ params }) => {
    const product = await db.products.findUnique({
      where: { id: params.id },
      include: {
        category: true,
      },
    });

    if (!product) {
      return new Response("Product not found", { status: 404 });
    }

    // Calculate all installment options
    const installmentOptions = [
      {
        months: 10,
        commission: month10,
        monthlyPayment: calculateMonthlyPayment(product.price, 10, month10),
        totalWithCommission: Math.round(product.price * (1 + month10)),
      },
      {
        months: 12,
        commission: month12,
        monthlyPayment: calculateMonthlyPayment(product.price, 12, month12),
        totalWithCommission: Math.round(product.price * (1 + month12)),
      },
      {
        months: 14,
        commission: month14,
        monthlyPayment: calculateMonthlyPayment(product.price, 14, month14),
        totalWithCommission: Math.round(product.price * (1 + month14)),
      },
      {
        months: 18,
        commission: month18,
        monthlyPayment: calculateMonthlyPayment(product.price, 18, month18),
        totalWithCommission: Math.round(product.price * (1 + month18)),
      },
    ];

    // Map database fields to frontend expected format
    const mappedProduct = {
      id: product.id,
      name: product.name,
      description: product.description || "",
      image: product.imageUrl,
      imageUrl: product.imageUrl,
      basePrice: product.price,
      price: `${formatNumber(
        calculateMonthlyPayment(product.price, 18, month18)
      )} دينار/شهر`,
      installmentOptions: installmentOptions,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
          }
        : null,
    };

    return mappedProduct;
  })
  // Protected Admin API endpoints for CRUD operations
  // Categories CRUD
  .post("/api/categories", async ({ body, headers }) => {
    try {
      // Verify authentication
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      const { name, imageUrl } = body as { name: string; imageUrl?: string };

      if (!name) {
        return new Response("Category name is required", { status: 400 });
      }

      const category = await db.category.create({
        data: {
          name,
          imageUrl: imageUrl ?? null,
        },
      });

      return category;
    } catch (error) {
      console.error("Error creating category:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .put("/api/categories/:id", async ({ params, body, headers }) => {
    try {
      // Verify authentication
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      const { name, imageUrl } = body as { name: string; imageUrl?: string };

      if (!name) {
        return new Response("Category name is required", { status: 400 });
      }

      const category = await db.category.update({
        where: { id: params.id },
        data: {
          name,
          imageUrl: imageUrl ?? null,
        },
      });

      return category;
    } catch (error) {
      console.error("Error updating category:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .delete("/api/categories/:id", async ({ params, headers }) => {
    try {
      // Verify authentication
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      // Check if category has products
      const productsCount = await db.products.count({
        where: { categoryId: params.id },
      });

      if (productsCount > 0) {
        return new Response("Cannot delete category with existing products", {
          status: 400,
        });
      }

      await db.category.delete({
        where: { id: params.id },
      });

      return new Response("Category deleted successfully", { status: 200 });
    } catch (error) {
      console.error("Error deleting category:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  // Products CRUD
  .post("/api/products", async ({ body, headers }) => {
    try {
      // Verify authentication
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      const { name, categoryId, price, imageUrl, description } = body as {
        name: string;
        categoryId?: string;
        price: number;
        imageUrl: string;
        description?: string;
      };

      if (!name || !price || !imageUrl) {
        return new Response("Name, price, and imageUrl are required", {
          status: 400,
        });
      }

      const product = await db.products.create({
        data: {
          name,
          categoryId: categoryId ?? null,
          price,
          imageUrl,
          description: description ?? null,
        },
        include: {
          category: true,
        },
      });

      // Map to frontend format
      return {
        id: product.id,
        name: product.name,
        description: product.description || "",
        imageUrl: product.imageUrl,
        price: product.price,
        categoryId: product.categoryId,
        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
            }
          : null,
      };
    } catch (error) {
      console.error("Error creating product:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .put("/api/products/:id", async ({ params, body, headers }) => {
    try {
      // Verify authentication
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      const { name, categoryId, price, imageUrl, description } = body as {
        name: string;
        categoryId?: string;
        price: number;
        imageUrl: string;
        description?: string;
      };

      if (!name || !price || !imageUrl) {
        return new Response("Name, price, and imageUrl are required", {
          status: 400,
        });
      }

      const product = await db.products.update({
        where: { id: params.id },
        data: {
          name,
          categoryId: categoryId ?? null,
          price,
          imageUrl,
          description: description ?? null,
        },
        include: {
          category: true,
        },
      });

      // Map to frontend format
      return {
        id: product.id,
        name: product.name,
        description: product.description || "",
        imageUrl: product.imageUrl,
        price: product.price,
        categoryId: product.categoryId,
        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
            }
          : null,
      };
    } catch (error) {
      console.error("Error updating product:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .delete("/api/products/:id", async ({ params, headers }) => {
    try {
      // Verify authentication
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      await db.products.delete({
        where: { id: params.id },
      });

      return new Response("Product deleted successfully", { status: 200 });
    } catch (error) {
      console.error("Error deleting product:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  // Users CRUD (Admin only)
  .get("/api/users", async ({ headers }) => {
    try {
      // Verify authentication
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      const users = await db.users.findMany({
        select: {
          id: true,
          username: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return users;
    } catch (error) {
      console.error("Error fetching users:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .post("/api/users", async ({ body, headers }) => {
    try {
      // Verify authentication
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      const { username, password } = body as {
        username: string;
        password: string;
      };

      if (!username || !password) {
        return new Response("Username and password are required", {
          status: 400,
        });
      }

      // Check if user already exists
      const existingUser = await db.users.findFirst({
        where: { username },
      });

      if (existingUser) {
        return new Response("Username already exists", { status: 400 });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await db.users.create({
        data: {
          username,
          password: hashedPassword,
        },
        select: {
          id: true,
          username: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .put("/api/users/:id", async ({ params, body, headers }) => {
    try {
      // Verify authentication
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      const { username, password } = body as {
        username: string;
        password?: string;
      };

      if (!username) {
        return new Response("Username is required", { status: 400 });
      }

      // Check if username is already taken by another user
      const existingUser = await db.users.findFirst({
        where: {
          username,
          id: { not: params.id },
        },
      });

      if (existingUser) {
        return new Response("Username already exists", { status: 400 });
      }

      // Prepare update data
      const updateData: any = { username };

      if (password) {
        updateData.password = await bcrypt.hash(password, 12);
      }

      // Update user
      const user = await db.users.update({
        where: { id: params.id },
        data: updateData,
        select: {
          id: true,
          username: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      console.error("Error updating user:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  .delete("/api/users/:id", async ({ params, headers }) => {
    try {
      // Verify authentication
      const authHeader = headers.authorization;
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }

      const decoded = await authenticateToken(token);
      if (!decoded) {
        return new Response("Invalid token", { status: 401 });
      }

      // Prevent deleting own account
      if (decoded.userId === params.id) {
        return new Response("Cannot delete your own account", { status: 400 });
      }

      // Get the user to be deleted
      const userToDelete = await db.users.findUnique({
        where: { id: params.id },
      });

      if (!userToDelete) {
        return new Response("User not found", { status: 404 });
      }

      // Delete the user
      await db.users.delete({
        where: { id: params.id },
      });

      // Blacklist all tokens for this user (in production, you'd want to store user tokens in database)
      // For now, we'll add a note that the user was deleted
      console.log(
        `User ${userToDelete.username} (${params.id}) has been deleted. Their tokens should be invalidated.`
      );

      return new Response("User deleted successfully", { status: 200 });
    } catch (error) {
      console.error("Error deleting user:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
  // Admin routes
  .get("/admin", () => {
    return Bun.file("public/admin/index.html");
  })
  .get("/admin/login", () => {
    return Bun.file("public/admin/login.html");
  })
  .get("/admin/login.html", () => {
    return Bun.file("public/admin/login.html");
  })
  .get("/admin/dashboard", () => {
    return Bun.file("public/admin/dashboard.html");
  })
  .get("/admin/dashboard.html", () => {
    return Bun.file("public/admin/dashboard.html");
  })
  .get("/admin/categories", () => {
    return Bun.file("public/admin/categories.html");
  })
  .get("/admin/categories.html", () => {
    return Bun.file("public/admin/categories.html");
  })
  .get("/admin/products", () => {
    return Bun.file("public/admin/products.html");
  })
  .get("/admin/products.html", () => {
    return Bun.file("public/admin/products.html");
  })
  .get("/admin/users", () => {
    return Bun.file("public/admin/users.html");
  })
  .get("/admin/users.html", () => {
    return Bun.file("public/admin/users.html");
  })
  .listen(3100);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
