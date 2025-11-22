import 'dotenv/config';
import { PrismaClient } from '../client/client';
import type { Context } from '../prisma/context';
import { makeServices } from '../prisma/generated/services/index';
import { createSqliteAdapter } from '../prisma/sqliteAdapter';

async function main() {
  // Instantiate Prisma once for the request
  const prisma = new PrismaClient({
    adapter: createSqliteAdapter(),
  });

  // Minimal context shape that satisfies your project's Context type
  const ctx = { prisma, user: null } satisfies Context;

  const services = makeServices(ctx);

  // Create users (emails must be unique)
  const suffix = Date.now();
  const u1 = await services.user.create({
    data: { email: `alice-${suffix}@example.com`, name: 'Alice' },
  });
  const u2 = await services.user.create({
    data: { email: `bob-${suffix}@example.com`, name: 'Bob' },
  });
  console.log('created users:', { u1, u2 });

  // Read user
  const fetchedU1 = await services.user.findUnique({
    where: { id: u1.id, email: u1.email },
  });
  console.log('fetchedU1:', fetchedU1);

  // Update user
  const updatedU1 = await services.user.update({
    where: { id: u1.id, email: u1.email },
    data: { name: 'Alice Updated' },
  });
  console.log('updatedU1:', updatedU1);

  // Create a post for Alice (likes is BigInt; bytes is Buffer)
  const p1 = await services.post.create({
    data: {
      title: 'Hello World',
      content: 'First post',
      published: true,
      viewCount: 1,
      likes: 0n,
      bytes: Buffer.from('hello'),
      author: { connect: { id: u1.id, email: u1.email } },
    },
  });
  console.log('created post:', p1);

  // Read posts for Alice
  const alicePosts = await services.post.findMany({
    where: { authorId: u1.id },
  });
  console.log('alicePosts:', alicePosts);

  // Update post viewCount
  const p1Updated = await services.post.update({
    where: { id: p1.id },
    data: { viewCount: { increment: 1 } },
  });
  console.log('updated post:', p1Updated);

  // Count posts
  const postsCount = await services.post.count({});
  console.log('postsCount:', postsCount);

  // Map CRUD
  const m1 = await services.map.create({
    data: { key: `k-${suffix}`, value: 'v1' },
  });
  const m1u = await services.map.update({
    where: { key: m1.key },
    data: { value: 'v2' },
  });
  const m1d = await services.map.delete({ where: { key: m1.key } });
  console.log('map ops:', { m1, m1u, m1d });

  // Cleanup: delete created post (if not already)
  try {
    await services.post.delete({ where: { id: p1.id } });
  } catch {}

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
});
