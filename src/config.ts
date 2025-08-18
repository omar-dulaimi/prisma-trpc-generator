import { z } from 'zod';

// Accept booleans and boolean-like strings
const booleanLike = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((val) => (typeof val === 'string' ? JSON.parse(val) : val));

// Middleware/shield can be boolean (enabled/disabled) or a string path
const configMiddleware = z.union([booleanLike, z.string()]);
const configShield = z.union([booleanLike, z.string()]);

// Define model actions directly since DMMF.ModelAction is not available at runtime
const ModelAction = {
  findFirst: 'findFirst',
  findFirstOrThrow: 'findFirstOrThrow',
  findMany: 'findMany',
  findUnique: 'findUnique',
  findUniqueOrThrow: 'findUniqueOrThrow',
  create: 'create',
  createMany: 'createMany',
  createManyAndReturn: 'createManyAndReturn',
  update: 'update',
  updateMany: 'updateMany',
  updateManyAndReturn: 'updateManyAndReturn',
  upsert: 'upsert',
  delete: 'delete',
  deleteMany: 'deleteMany',
  aggregate: 'aggregate',
  groupBy: 'groupBy',
  count: 'count',
  findRaw: 'findRaw',
  aggregateRaw: 'aggregateRaw',
} as const;

const modelActionEnum = z.nativeEnum(ModelAction);

// Service layer configuration (opt-in)
const serviceStyleEnum = z.enum(['class', 'factory', 'plain']);
const additionalImportSpec = z.object({
  from: z.string(),
  names: z.array(z.string()).optional(),
  default: z.string().optional(),
  namespace: z.string().optional(),
});

const authStrategyEnum = z.enum(['session', 'jwt', 'custom']);

const authConfig = z.object({
  strategy: authStrategyEnum.optional().default('session'),
  rolesField: z.string().optional().default('role'),
  jwt: z
    .object({
      header: z.string().optional().default('authorization'),
      scheme: z.string().optional().default('Bearer'),
      secretEnv: z.string().optional().default('JWT_SECRET'),
      verifyPath: z.string().optional(), // path to module exporting verifyToken(token, secret): any
      getUserFromPayloadPath: z.string().optional(), // path to module exporting getUserFromPayload(payload): any
    })
    .optional(),
  session: z
    .object({
      getUserPath: z.string().optional(), // path to module exporting getUser(req): any
    })
    .optional(),
  custom: z
    .object({
      resolverPath: z.string().optional(), // path to module exporting resolveUser(req): any
    })
    .optional(),
});

export const configSchema = z.object({
  // Defaults: middleware/shield on by default; can be a path string to custom impls
  withMiddleware: configMiddleware.optional().default(true),
  // README: default false
  withShield: configShield.optional().default(false),
  withZod: booleanLike.optional().default(true),
  contextPath: z.string().default('../../../../src/context'),
  // README default
  trpcOptionsPath: z.string().optional().default('../../../../src/trpcOptions'),
  // Postman collection emission
  postman: z
    .union([
      booleanLike,
      z.object({
        endpoint: z.string().optional().default('http://localhost:3000/trpc'),
        envName: z.string().optional().default('TRPC_ENDPOINT'),
        fromOpenApi: booleanLike.optional().default(false),
        // Examples mode for request bodies in generated collection
        examples: z
          .enum(['none', 'skeleton'])
          .optional()
          .default('none'),
      }),
    ])
    .optional()
    .default(false),
  // OpenAPI emission (opt-in)
  openapi: z
    .union([
      booleanLike,
      z.object({
        enabled: booleanLike.optional().default(true),
        title: z.string().optional().default('Prisma tRPC API'),
        version: z.string().optional().default('1.0.0'),
        baseUrl: z.string().optional().default('http://localhost:3000'),
        pathPrefix: z.string().optional().default('trpc'),
        pathStyle: z.enum(['slash', 'dot']).optional().default('slash'),
        includeExamples: booleanLike.optional().default(true),
      }),
    ])
    .optional()
    .default(false),
  // Flat fallbacks for OpenAPI fine-tuning (Prisma config is flat key-value)
  openapiTitle: z.string().optional(),
  openapiVersion: z.string().optional(),
  openapiBaseUrl: z.string().optional(),
  openapiPathPrefix: z.string().optional(),
  openapiPathStyle: z.enum(['slash', 'dot']).optional(),
  openapiIncludeExamples: booleanLike.optional(),
  // Flat fallback for Postman fromOpenApi toggle
  postmanFromOpenApi: booleanLike.optional(),
  // Flat alternative for configuring Postman examples (since Prisma generator config is flat key-value)
  postmanExamples: z
    .enum(['none', 'skeleton'])
    .optional()
    .default('none'),
  // Request ID + logging
  withRequestId: booleanLike.optional().default(false),
  withLogging: booleanLike.optional().default(false),
  // Auth (session/JWT/custom) basic guard and strategy hooks
  auth: z.union([booleanLike, authConfig]).optional().default(false),
  // README options (currently not used in generation, but accepted)
  isGenerateSelect: booleanLike.optional().default(false),
  isGenerateInclude: booleanLike.optional().default(false),
  showModelNameInProcedure: booleanLike.optional().default(true),
  generateModelActions: z
    .string()
    .default(Object.values(ModelAction).join(','))
    .transform((arg) => {
      return arg
        .split(',')
        .map((action) => modelActionEnum.parse(action.trim()));
    }),
  // Service layer (optional)
  withServices: booleanLike.optional().default(false),
  serviceStyle: serviceStyleEnum.optional().default('class'),
  serviceDir: z.string().optional().default('services'),
  withListMethod: booleanLike.optional().default(true),
  serviceImports: z.array(additionalImportSpec).optional().default([]),
});

export type Config = z.infer<typeof configSchema>;
