import 'dotenv/config';
import { PrismaClient } from '../client/client';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { createSqliteAdapter } from './sqliteAdapter';

export const createContext = ({ req, res }: CreateExpressContextOptions) => {
  const prisma = new PrismaClient({
    adapter: createSqliteAdapter(),
  });
  const rid = () =>
    (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    ).toUpperCase();
  const requestId =
    (req.headers['x-request-id'] as string | undefined) ?? rid();
  return {
    prisma,
    req,
    user: null,
    requestId,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
