// import { PrismaClient } from "./src/generated/prisma";
// import bcrypt from "bcryptjs";

// const prisma = new PrismaClient();

// async function createUser(username: string, password: string) {
//   try {
//     // Check if user already exists
//     const existingUser = await prisma.users.findFirst({
//       where: { username },
//     });

//     if (existingUser) {
//       console.log(`❌ User '${username}' already exists`);
//       return;
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 12);

//     // Create user
//     const user = await prisma.users.create({
//       data: {
//         username,
//         password: hashedPassword,
//       },
//     });

//     console.log(`✅ User '${username}' created successfully`);
//     console.log(`   ID: ${user.id}`);
//     console.log(`   Username: ${user.username}`);
//     console.log(`   Created: ${user.createdAt}`);
//   } catch (error) {
//     console.error("❌ Error creating user:", error);
//   }
// }

// async function main() {
//   const args = process.argv.slice(2);

//   if (args.length !== 2) {
//     console.log("Usage: bun run create-user.ts <username> <password>");
//     console.log("Example: bun run create-user.ts admin2 mypassword123");
//     process.exit(1);
//   }

//   const [username, password] = args;

//   console.log(`🌱 Creating user: ${username}`);
//   await createUser(username, password);
// }

// main()
//   .catch((e) => {
//     console.error("❌ Error:", e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
