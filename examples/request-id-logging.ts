import * as trpc from '@trpc/server';
import { z } from 'zod';
import { createContext, type Context } from '../prisma/context';
import trpcOptions from '../prisma/trpcOptions';

async function main() {
  // Simulate a request without x-request-id header; middleware will generate one
  const ctx = createContext({
    req: { headers: {} } as any,
    res: {} as any,
    info: undefined,
  } as any);
  const caller = router.createCaller(ctx);

  // Pick a procedure that will error; e.g., findUnique with missing args
  try {
    // intentional bad input to trigger zod error
    await caller.broken({ id: 'not-a-number' } as any);
  } catch (err: any) {
    // tRPC wraps error; log the formatter shape-like info if present
    const data = err?.data || {};
    console.log('Error data requestId:', data.requestId);
    console.log('Zod error present:', !!data.zodError);
  }
}

const t = trpc.initTRPC.context<Context>().create(trpcOptions);

const _rid = () =>
  (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();

export const requestIdMiddleware = t.middleware(
  async ({ ctx, next, path, type }) => {
    const requestId = ctx.requestId ?? _rid();
    const start = Date.now();
    const result = await next({ ctx: { ...ctx, requestId } });
    const ms = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({ level: 'info', msg: 'trpc', requestId, path, type, ms }),
    );
    return result;
  },
);

const router = t.router({
  // Intentionally require a number to trigger Zod error when passing wrong type
  broken: t.procedure
    .use(requestIdMiddleware)
    .input(z.object({ id: z.number() }))
    .query(({ input }) => ({ ok: true, id: input.id })),
  boom: t.procedure.use(requestIdMiddleware).query(({ ctx }) => {
    throw new trpc.TRPCError({
      code: 'BAD_REQUEST',
      message: `boom r:${ctx.requestId ?? 'none'}`,
    });
  }),
});

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Also call a procedure that throws and includes requestId in its message
(async () => {
  const ctx = createContext({
    req: { headers: {} } as any,
    res: {} as any,
    info: undefined,
  } as any);
  const caller = router.createCaller(ctx);
  try {
    await caller.boom();
  } catch (err: any) {
    console.log('Boom route — error message contains requestId:', err?.message);
  }
})();
