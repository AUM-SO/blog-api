import 'dotenv/config';
import mysql from 'mysql2/promise';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { buildPgConnection } from '../src/prisma/pg-connection';

// One-off data migration: legacy MySQL `blog_db` -> Supabase PostgreSQL.
//
//   MYSQL_URL="mysql://root:password@localhost:3306/blog_db" npx tsx prisma/migrate-from-mysql.ts
//
// Run AFTER `yarn prisma:deploy` has created the Postgres schema.
// Original primary keys are preserved so foreign keys stay intact, and the
// identity sequences are re-synced at the end.
//
// Refuses to run when the target tables already hold rows; pass --force to
// wipe the target first (destructive) or --dry-run to only report counts.

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

const MYSQL_URL = process.env.MYSQL_URL ?? 'mysql://root:password@localhost:3306/blog_db';

// Prefer the direct Supabase connection: bulk writes and setval() through the
// transaction pooler are needlessly fragile.
const PG_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!PG_URL) throw new Error('DIRECT_URL or DATABASE_URL must be set');

const pg = buildPgConnection(PG_URL);
if (!pg.verified) {
  console.warn(
    'WARNING: connection is encrypted but the server certificate is NOT verified. ' +
      'Add the Supabase CA at certs/supabase-ca.crt (or set PG_SSL_ROOT_CERT) before ' +
      'copying production data.',
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg(pg.config) });

// Child-before-parent for deletes, parent-before-child for inserts.
const TABLES = ['users', 'blogs', 'comments', 'notifications', 'refresh_tokens'] as const;

type Row = Record<string, unknown>;

const toBool = (v: unknown) => v === 1 || v === true || v === '1';

async function main() {
  const source = await mysql.createConnection({
    uri: MYSQL_URL,
    // MySQL DATETIME carries no timezone; Prisma wrote these as UTC, so parse
    // them back as UTC instead of the machine's local zone.
    timezone: 'Z',
    dateStrings: false,
  });

  const read = async (table: string): Promise<Row[]> => {
    const [rows] = await source.query(`SELECT * FROM \`${table}\` ORDER BY id`);
    return rows as Row[];
  };

  const users = await read('users');
  const blogs = await read('blogs');
  const comments = await read('comments');
  const notifications = await read('notifications');
  const refreshTokens = await read('refresh_tokens');
  await source.end();

  console.log('Source (MySQL):');
  console.log(`  users           ${users.length}`);
  console.log(`  blogs           ${blogs.length}`);
  console.log(`  comments        ${comments.length}`);
  console.log(`  notifications   ${notifications.length}`);
  console.log(`  refresh_tokens  ${refreshTokens.length}`);

  const existing = await Promise.all([
    prisma.user.count(),
    prisma.blog.count(),
    prisma.comment.count(),
    prisma.notification.count(),
    prisma.refreshToken.count(),
  ]);
  const existingTotal = existing.reduce((a, b) => a + b, 0);
  console.log(`Target (PostgreSQL) currently holds ${existingTotal} rows.`);

  if (DRY_RUN) {
    console.log('--dry-run: nothing written.');
    return;
  }

  if (existingTotal > 0) {
    if (!FORCE) {
      throw new Error(
        'Target database is not empty. Re-run with --force to delete its rows and re-import.',
      );
    }
    console.log('--force: clearing target tables...');
    // Cascades would handle this, but be explicit about the order.
    await prisma.notification.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.blog.deleteMany();
    await prisma.user.deleteMany();
  }

  await prisma.$transaction(async (tx) => {
    if (users.length) {
      await tx.user.createMany({
        data: users.map((u) => ({
          id: Number(u.id),
          username: String(u.username),
          email: String(u.email),
          password: String(u.password),
          role: u.role as 'SUPER_ADMIN' | 'GENERAL_USER',
          isActive: toBool(u.isActive),
          createdAt: u.createdAt as Date,
          updatedAt: u.updatedAt as Date,
        })),
      });
    }

    if (blogs.length) {
      await tx.blog.createMany({
        data: blogs.map((b) => ({
          id: Number(b.id),
          title: String(b.title),
          content: String(b.content),
          authorId: Number(b.authorId),
          createdAt: b.createdAt as Date,
          updatedAt: b.updatedAt as Date,
        })),
      });
    }

    if (comments.length) {
      await tx.comment.createMany({
        data: comments.map((c) => ({
          id: Number(c.id),
          content: String(c.content),
          blogId: Number(c.blogId),
          userId: Number(c.userId),
          createdAt: c.createdAt as Date,
        })),
      });
    }

    if (notifications.length) {
      await tx.notification.createMany({
        data: notifications.map((n) => ({
          id: Number(n.id),
          recipientId: Number(n.recipientId),
          commentId: Number(n.commentId),
          isRead: toBool(n.isRead),
          createdAt: n.createdAt as Date,
        })),
      });
    }

    if (refreshTokens.length) {
      await tx.refreshToken.createMany({
        data: refreshTokens.map((t) => ({
          id: Number(t.id),
          token: String(t.token),
          userId: Number(t.userId),
          expiresAt: t.expiresAt as Date,
          revoked: toBool(t.revoked),
          createdAt: t.createdAt as Date,
        })),
      });
    }
  });

  // Explicit ids bypass the SERIAL sequences, which would otherwise still sit
  // at 1 and collide on the next insert.
  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`,
    );
  }

  const after = await Promise.all([
    prisma.user.count(),
    prisma.blog.count(),
    prisma.comment.count(),
    prisma.notification.count(),
    prisma.refreshToken.count(),
  ]);
  const expected = [
    users.length,
    blogs.length,
    comments.length,
    notifications.length,
    refreshTokens.length,
  ];

  console.log('Target (PostgreSQL) after import:');
  TABLES.forEach((table, i) => {
    const ok = after[i] === expected[i] ? 'OK' : 'MISMATCH';
    console.log(`  ${table.padEnd(15)} ${after[i]}/${expected[i]}  ${ok}`);
  });

  if (after.some((n, i) => n !== expected[i])) {
    throw new Error('Row counts do not match the source. Investigate before using this data.');
  }
  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
