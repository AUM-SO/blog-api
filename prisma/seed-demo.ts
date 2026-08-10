import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../generated/prisma/client';
import { buildPgConnection } from '../src/prisma/pg-connection';

// Demo fixtures for manual QA and before/after screenshots.
// Not part of `prisma db seed` — run explicitly with `npx tsx prisma/seed-demo.ts`.
// Safe to re-run: every record is upserted or looked up before creating.
// To remove: `npx tsx prisma/seed-demo.ts --clean`

const adapter = new PrismaPg(
  buildPgConnection(process.env.DATABASE_URL!).config,
);
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = 'Demo@12345';
const DEMO_EMAILS = ['alice@demo.local', 'bob@demo.local', 'carol@demo.local'];

async function upsertUser(
  username: string,
  email: string,
  isActive: boolean,
) {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { isActive },
    create: {
      username,
      email,
      password,
      role: Role.GENERAL_USER,
      isActive,
    },
  });
}

async function ensureBlog(title: string, content: string, authorId: number) {
  const existing = await prisma.blog.findFirst({ where: { title, authorId } });
  if (existing) return existing;
  return prisma.blog.create({ data: { title, content, authorId } });
}

// Mirrors CommentsService.create: the blog author gets a notification only
// when somebody else comments, so the demo data exercises the same path.
async function ensureComment(blogId: number, userId: number, content: string) {
  const existing = await prisma.comment.findFirst({
    where: { blogId, userId, content },
  });
  if (existing) return existing;

  const comment = await prisma.comment.create({
    data: { blogId, userId, content },
  });
  const blog = await prisma.blog.findUniqueOrThrow({ where: { id: blogId } });

  if (blog.authorId !== userId) {
    await prisma.notification.create({
      data: { recipientId: blog.authorId, commentId: comment.id },
    });
  }
  return comment;
}

async function clean() {
  const users = await prisma.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: { id: true },
  });
  // Blog/Comment/Notification all cascade from User, so deleting the demo
  // accounts removes everything this script created.
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  console.log(`Removed ${users.length} demo user(s) and their cascaded data`);
}

async function main() {
  if (process.argv.includes('--clean')) {
    await clean();
    return;
  }

  const alice = await upsertUser('alicewriter', 'alice@demo.local', true);
  const bob = await upsertUser('bobreader', 'bob@demo.local', true);
  // Left inactive on purpose: gives the Admin › Users "Pending" tab a row so
  // the Activate flow can be screenshotted.
  const carol = await upsertUser('carolpending', 'carol@demo.local', false);

  const blogA = await ensureBlog(
    'Getting started with the Blog Management System',
    'This walkthrough covers registering an account, waiting for Super Admin activation, and publishing a first post.\n\nThe activation step exists so that only approved members can reach the blog features.',
    alice.id,
  );

  const blogB = await ensureBlog(
    'Why every post shows its author and creation date',
    'Readers need provenance. Showing who wrote a post and when it was published is the cheapest way to give an article context.\n\nThis post is long enough to make list excerpts visible in the card layout.',
    alice.id,
  );

  const blogC = await ensureBlog(
    'Notes on comment notifications',
    'When somebody comments on your post you should be told about it, with an unread count that goes down as you read each item.\n\nThat is exactly what the notification bell in the header is for.',
    bob.id,
  );

  await ensureComment(
    blogA.id,
    bob.id,
    'Clear walkthrough — the activation step tripped me up at first.',
  );
  await ensureComment(blogA.id, alice.id, 'Thanks! I will expand the section on roles.');
  await ensureComment(blogC.id, alice.id, 'The unread counter is the part I care about most.');
  await ensureComment(blogB.id, bob.id, 'Agreed, the date matters as much as the author name.');

  console.log('Demo data ready:');
  console.log(`  users   : ${alice.username} (active), ${bob.username} (active), ${carol.username} (PENDING)`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  blogs   : #${blogA.id}, #${blogB.id} by ${alice.username}; #${blogC.id} by ${bob.username}`);
  console.log('  comments: 4 (3 of them cross-author, so 3 notifications were created)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
