import { z } from 'zod';

const configBoolean = z
  .enum(['true', 'false'])
  .transform((arg) => JSON.parse(arg));

export const configSchema = z.object({
  withMiddleware: configBoolean.default('true'),
  withShield: configBoolean.default('true'),
  contextPath: z.string().default('../../../../src/context'),
  trpcOptionsPath: z.string().optional()
});

export type Config = z.infer<typeof configSchema>;
