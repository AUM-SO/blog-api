import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../generated/prisma/client';
import { buildPgConnection } from '../src/prisma/pg-connection';

const adapter = new PrismaPg(
  buildPgConnection(process.env.DATABASE_URL!).config,
);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@blog.local';
  const username = process.env.ADMIN_USERNAME ?? 'superadmin';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@12345';
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username,
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`Super Admin ready: ${admin.email} (username: ${admin.username})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
