import 'dotenv/config';
import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

function normalizeSqliteUrl(raw?: string | null) {
  const url = raw ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be set for sqlite connections');
  if (url === ':memory:') return url as ':memory:';
  if (url.startsWith('file:')) return url as string & {};
  const absolutePath = path.isAbsolute(url)
    ? url
    : path.resolve(process.cwd(), url);
  return `file:${absolutePath}` as string & {};
}

export function createSqliteAdapter(databaseUrl?: string) {
  const url = normalizeSqliteUrl(databaseUrl);
  return new PrismaBetterSqlite3({ url });
}
