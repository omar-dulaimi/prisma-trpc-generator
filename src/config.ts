import { z } from 'zod';

const configBoolean = z
  .enum(['true', 'false'])
  .transform((arg) => JSON.parse(arg));

const configMiddleware = z.union([
  configBoolean,
  z.string().default('../../../../src/middleware'),
]);

const configShield = z.union([
  configBoolean,
  z.string().default('../../../../src/shield'),
]);

// Define model actions directly since DMMF.ModelAction is not available at runtime
const ModelAction = {
  findFirst: 'findFirst',
  findFirstOrThrow: 'findFirstOrThrow', 
  findMany: 'findMany',
  findUnique: 'findUnique',
  findUniqueOrThrow: 'findUniqueOrThrow',
  create: 'create',
  createMany: 'createMany',
  update: 'update',
  updateMany: 'updateMany',
  upsert: 'upsert',
  delete: 'delete',
  deleteMany: 'deleteMany',
  aggregate: 'aggregate',
  groupBy: 'groupBy',
  count: 'count',
  findRaw: 'findRaw',
  aggregateRaw: 'aggregateRaw'
} as const;

const modelActionEnum = z.nativeEnum(ModelAction);

export const configSchema = z.object({
  withMiddleware: configMiddleware.default('true'),
  withShield: configShield.default('true'),
  withZod: configBoolean.default('true'),
  contextPath: z.string().default('../../../../src/context'),
  trpcOptionsPath: z.string().optional(),
  showModelNameInProcedure: configBoolean.default('true'),
  generateModelActions: z
    .string()
    .default(Object.values(ModelAction).join(','))
    .transform((arg) => {
      return arg
        .split(',')
        .map((action) => modelActionEnum.parse(action.trim()));
    }),
});

export type Config = z.infer<typeof configSchema>;
