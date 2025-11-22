// Simple runtime example to demonstrate multi-tenant runs and soft-delete usage
import 'dotenv/config';
import { PrismaClient } from '../client/client';
import type { Context } from '../prisma/context';
import { makeServices } from '../prisma/generated/services/index';
import { createSqliteAdapter } from '../prisma/sqliteAdapter';

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
};

const hr = (label: string) =>
  `${ANSI.dim}${'-'.repeat(8)}${ANSI.reset} ${ANSI.bold}${label}${ANSI.reset} ${ANSI.dim}${'-'.repeat(8)}${ANSI.reset}`;
const tag = (tenantId: number) =>
  `${ANSI.cyan}[tenant:${tenantId}]${ANSI.reset}`;
const ok = `${ANSI.green}✔${ANSI.reset}`;
const warn = `${ANSI.yellow}⚠${ANSI.reset}`;

async function runForTenant(prisma: PrismaClient, tenantId: number) {
  const header = `${ANSI.magenta}🏷️  Running ops for tenant ${tenantId}${ANSI.reset}`;
  console.log('\n' + hr(header));

  const ctx: Context & { tenantId: number } = { prisma, user: null, tenantId };
  const s = makeServices(ctx);

  // Seed per-tenant user (note: schema has no tenant key; this just gives us a distinct authorId)
  await prisma.user.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      email: `tenant${tenantId}@example.com`,
      name: `Tenant ${tenantId}`,
    },
  });
  console.log(tag(tenantId), ok, 'seeded user');

  // Create
  const created = await s.post.create({
    data: {
      title: `Hello T${tenantId}`,
      authorId: tenantId,
      likes: BigInt(0),
      bytes: Buffer.from('x'),
    },
  });
  console.log(tag(tenantId), ok, 'created post id', created.id);

  // List
  const list = await s.post.findMany({});
  console.log(tag(tenantId), ok, 'posts count', list.length);

  // Update
  const updated = await s.post.update({
    where: { id: created.id },
    data: { viewCount: { increment: 1 } },
  });
  console.log(tag(tenantId), ok, 'updated viewCount', updated.viewCount);

  // Optional tenant/soft-delete flags (effective when schema is annotated)
  await s.post.findMany({}, { bypassTenant: false, withDeleted: false });
  console.log(
    tag(tenantId),
    warn,
    'scoping flags applied (effective when schema is annotated)',
  );

  // createMany
  const cm = await s.post.createMany({
    data: [
      {
        title: `B1-T${tenantId}`,
        authorId: tenantId,
        likes: BigInt(1),
        bytes: Buffer.from('a'),
      },
      {
        title: `B2-T${tenantId}`,
        authorId: tenantId,
        likes: BigInt(2),
        bytes: Buffer.from('b'),
      },
    ],
  });
  console.log(tag(tenantId), ok, 'createMany inserted', cm.count);

  // findUnique
  const u1 = await s.post.findUnique({ where: { id: created.id } });
  console.log(tag(tenantId), ok, 'findUnique title', u1?.title);

  // count
  const cnt = await s.post.count({ where: { published: false } });
  console.log(tag(tenantId), ok, 'unpublished count', cnt);

  // aggregate
  const agg = await s.post.aggregate({ _sum: { viewCount: true } });
  console.log(tag(tenantId), ok, 'sum viewCount', agg._sum?.viewCount ?? 0);

  // groupBy (explicit orderBy to satisfy types)
  const gb = await s.post.groupBy({
    by: ['published'],
    _count: { _all: true },
    orderBy: { published: 'asc' },
  });
  console.log(tag(tenantId), ok, 'groupBy published', gb);

  // updateMany
  const um = await s.post.updateMany({
    where: { published: false },
    data: { viewCount: { increment: 2 } },
  });
  console.log(tag(tenantId), ok, 'updateMany count', um.count);

  // upsert
  const up = await s.post.upsert({
    where: { id: 9999 },
    update: { title: `Upserted-Update-T${tenantId}` },
    create: {
      title: `Upserted-Create-T${tenantId}`,
      authorId: tenantId,
      likes: BigInt(0),
      bytes: Buffer.from('u'),
    },
  });
  console.log(tag(tenantId), ok, 'upsert result id', up.id);

  // deleteMany
  const dm = await s.post.deleteMany({ where: { title: { contains: `B` } } });
  console.log(tag(tenantId), ok, 'deleteMany count', dm.count);

  // delete single
  const del = await s.post.delete({ where: { id: created.id } });
  console.log(tag(tenantId), ok, 'deleted id', del.id);
}

async function main() {
  const prisma = new PrismaClient({
    adapter: createSqliteAdapter(),
  });
  try {
    console.log(hr('🚀 Multi-tenant run start'));
    // Run for multiple tenants and log separately
    for (const t of [1, 2]) {
      await runForTenant(prisma, t);
    }
    console.log('\n' + hr('✅ Done'));
  } catch (e) {
    console.error('error', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
