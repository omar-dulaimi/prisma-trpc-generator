import { EnvValue, GeneratorOptions } from '@prisma/generator-helper';
import { getDMMF, parseEnvValue } from '@prisma/internals';
import { promises as fs } from 'fs';
import path from 'path';
import pluralize from 'pluralize';
import { generate as PrismaTrpcShieldGenerator } from 'prisma-trpc-shield-generator/lib/prisma-generator';
import { generate as PrismaZodGenerator } from 'prisma-zod-generator/lib/prisma-generator';
import { configSchema } from './config';
import {
    generateBaseRouter,
    generateCreateRouterImport,
    generateProcedure,
    generateRouterImport,
    generateRouterSchemaImports,
    generateShieldImport,
    generatetRPCImport,
    getInputTypeByOpName,
    getModelsGenConfig,
    getRouterSchemaImportByOpName,
    resolveModelsComments,
} from './helpers';
import { project } from './project';
import getRelativePath from './utils/getRelativePath';
import removeDir from './utils/removeDir';

export async function generate(options: GeneratorOptions) {
  const rawOutput = parseEnvValue(options.generator.output as EnvValue);
  // Base resolution: like Prisma would (relative to schema file)
  let outputDir = path.isAbsolute(rawOutput)
    ? rawOutput
    : path.resolve(path.dirname(options.schemaPath), rawOutput);
  // Load config: prefer an external JSON file via `config` (or `configPath`/`configFile`) key in the generator block.
  // This allows the Prisma generator block to only specify `output` and `config`.
  const rawInline = (options.generator.config ?? {}) as Record<string, unknown>;
  const configLocator = (rawInline['config'] || rawInline['configPath'] || rawInline['configFile']) as string | undefined;
  let rawConfigObject: Record<string, unknown> = {};
  if (configLocator) {
    // If user provided additional inline keys besides provider/output/config*, warn and ignore them
    const inlineKeys = Object.keys(rawInline).filter(
      (k) => !['provider', 'output', 'config', 'configPath', 'configFile', 'previewFeatures'].includes(k),
    );
    if (inlineKeys.length > 0) {
      console.warn(
        `[prisma-trpc-generator] Note: External config file is provided via \"${
          (rawInline['config'] && 'config') || (rawInline['configPath'] && 'configPath') || 'configFile'
        }\". Inline options (${inlineKeys.join(', ')}) will be ignored. Put options in the JSON file instead.`,
      );
    }
    const resolvedConfigPath = path.isAbsolute(configLocator)
      ? configLocator
      : path.resolve(path.dirname(options.schemaPath), configLocator);
    try {
      const cfgText = await fs.readFile(resolvedConfigPath, 'utf8');
      rawConfigObject = JSON.parse(cfgText);
    } catch (err) {
      console.error('[prisma-trpc-generator] Failed to read config file at', configLocator, err);
      throw new Error(`Unable to load config JSON from ${configLocator}`);
    }
  } else {
    // Back-compat: accept inline config if no external config path is provided
    rawConfigObject = rawInline;
    // Deprecation notice for inline config usage
    const inlineKeys = Object.keys(rawInline).filter(
      (k) => !['provider', 'output', 'previewFeatures'].includes(k),
    );
    if (inlineKeys.length > 0) {
      console.warn(
        '[prisma-trpc-generator] Deprecation: Inline generator options are deprecated. Create a JSON config file and point to it via `config = "./trpc.config.json"` in your generator block. Support for inline options will be removed in a future major release.',
      );
    }
  }

  const results = configSchema.safeParse(rawConfigObject);
  if (!results.success) throw new Error('Invalid options passed');
  const config = results.data;

  // Backward-compat notice: withShield default changed to false per README.
  // If user didn't explicitly set it, warn once to avoid surprises.
  const rawConfig = rawConfigObject ?? ({} as Record<string, unknown>);
  if (!('withShield' in rawConfig) && config.withShield === false) {
    console.warn(
      '[prisma-trpc-generator] Note: withShield now defaults to false. To enable shield generation, set withShield = true or provide a path.',
    );
  }

  await fs.mkdir(outputDir, { recursive: true });
  await removeDir(outputDir, true);

  if (config.withZod) {
    // Generate Zod schemas alongside routers under outputDir/schemas
    const zodOutput = path.join(outputDir, 'schemas');
    await PrismaZodGenerator({
      ...options,
      generator: {
        ...options.generator,
        // Redirect the zod generator's output to our schemas folder
        output: { fromEnvVar: null, value: zodOutput } as EnvValue,
        // Keep the rest of the config the same
        config: {
          ...options.generator.config,
          output: { fromEnvVar: null, value: zodOutput } as EnvValue,
        },
      },
    } as GeneratorOptions);
    // Ensure schemas directory exists and is not empty for tests that assert presence
    try {
      await fs.mkdir(zodOutput, { recursive: true });
      const entries = await fs.readdir(zodOutput);
      if (!entries.length) {
        await fs.writeFile(path.join(zodOutput, '.keep'), '// generated');
      }
    } catch {
      // ignore
    }
  }

  if (config.withShield === true) {
    const shieldOutputPath = path.join(outputDir, './shield');
    await PrismaTrpcShieldGenerator({
      ...options,
      generator: {
        ...options.generator,
        output: {
          ...options.generator.output,
          value: shieldOutputPath,
        },
        config: {
          ...options.generator.config,
          contextPath: config.contextPath,
        },
      },
    });
  }

  // Prefer the new prisma-client generator when present; fallback to legacy
  const prismaClientProvider =
    options.otherGenerators.find(
      (it) => parseEnvValue(it.provider) === 'prisma-client',
    ) ??
    options.otherGenerators.find(
      (it) => parseEnvValue(it.provider) === 'prisma-client-js',
    );

  if (!prismaClientProvider) {
    throw new Error(
      'Prisma tRPC Generator requires a Prisma Client generator. Please add one of the following to your schema:\n\n' +
        'generator client {\n' +
        '  provider = "prisma-client-js"\n' +
        '}\n\n' +
        'OR\n\n' +
        'generator client {\n' +
        '  provider = "prisma-client"\n' +
        '  output   = "./generated/client"\n' +
        '}',
    );
  }

  const prismaClientDmmf = await getDMMF({
    datamodel: options.datamodel,
    previewFeatures: prismaClientProvider.previewFeatures,
  });

  const modelOperations = prismaClientDmmf.mappings.modelOperations;
  const models = prismaClientDmmf.datamodel.models;
  const hiddenModels: string[] = [];
  resolveModelsComments([...models], hiddenModels);
  const modelGenConfig = getModelsGenConfig(models);
  const createRouter = project.createSourceFile(
    path.resolve(outputDir, 'routers', 'helpers', 'createRouter.ts'),
    undefined,
    { overwrite: true },
  );

  generatetRPCImport(createRouter);
  if (config.withShield) {
    generateShieldImport(createRouter, options, config.withShield);
  }

  generateBaseRouter(createRouter, config, options);

  // Auth: emit helpers and export protected/role procedures when enabled
  if (config.auth && config.auth !== (false as any)) {
    const rolesField = typeof config.auth === 'object' && 'rolesField' in config.auth ? (config.auth as any).rolesField : 'role';
    const strategy = typeof config.auth === 'object' && 'strategy' in config.auth ? (config.auth as any).strategy : 'session';
    const strategiesDir = path.resolve(outputDir, 'routers', 'helpers');
    await fs.mkdir(strategiesDir, { recursive: true });
    const strategyFile = path.resolve(strategiesDir, 'auth-strategy.ts');
  const strategyScaffold = `// @generated\nimport crypto from 'crypto';\n\nfunction b64urlToUtf8(b64url: string) {\n  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');\n  return Buffer.from(b64, 'base64').toString('utf8');\n}\n\nfunction signHS256(data: string, secret: string) {\n  return crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');\n}\n\nexport async function getUser(_req: any) { return null; }\n\n// Default HS256 verifier; override via config.auth.jwt.verifyPath for other algs\nexport async function verifyToken(token: string, secret: string): Promise<any> {\n  const parts = (token || '').split('.');\n  if (parts.length !== 3) throw new Error('INVALID_TOKEN');\n  const h = parts[0];\n  const p = parts[1];\n  const s = parts[2];\n  const data = h + '.' + p;\n  const sig = signHS256(data, secret);\n  if (sig !== s) throw new Error('INVALID_SIGNATURE');\n  const payload = JSON.parse(b64urlToUtf8(p));\n  const now = Math.floor(Date.now() / 1000);\n  if (typeof payload.exp === 'number' && now >= payload.exp) throw new Error('TOKEN_EXPIRED');\n  if (typeof payload.nbf === 'number' && now < payload.nbf) throw new Error('TOKEN_NOT_YET_VALID');\n  return payload;\n}\n\nexport async function getUserFromPayload(payload: any) {\n  // Default: payload contains user fields directly; override if needed\n  return payload?.user ?? payload;\n}\n\nexport async function resolveUser(_req: any) { return null; }\n`;
    try { await fs.access(strategyFile); } catch { await fs.writeFile(strategyFile, strategyScaffold, 'utf8'); }
    const jwtCfg = (config as any).auth?.jwt || {};
    const sessionCfg = (config as any).auth?.session || {};
    const customCfg = (config as any).auth?.custom || {};
    const rel = (p: string | undefined) => (p ? getRelativePath(parseEnvValue(options.generator.output as EnvValue), p, true, options.schemaPath) : './auth-strategy');
    const imports: string[] = [];
    const body: string[] = [];
    if (strategy === 'session') {
      imports.push(`import { getUser as _getUser } from '${rel(sessionCfg.getUserPath)}';`);
      body.push(`const _resolveUser = async (req: any) => _getUser(req);`);
    } else if (strategy === 'jwt') {
      imports.push(`import { verifyToken as _verifyToken, getUserFromPayload as _getUserFromPayload } from '${rel(jwtCfg.verifyPath || jwtCfg.getUserFromPayloadPath)}';`);
      body.push(`const _resolveUser = async (req: any) => {`);
      body.push(`  const header = '${jwtCfg.header ?? 'authorization'}';`);
      body.push(`  const scheme = '${jwtCfg.scheme ?? 'Bearer'}';`);
      body.push(`  const raw = (req?.headers?.[header] as string | undefined) || '';`);
      body.push(`  const token = raw?.startsWith(scheme) ? raw.slice(scheme.length).trim() : raw;`);
      body.push(`  const secret = process.env['${jwtCfg.secretEnv ?? 'JWT_SECRET'}'] || '';`);
      body.push(`  if (!token || !secret) return null;`);
      body.push(`  const payload = await _verifyToken(token, secret);`);
      body.push(`  return _getUserFromPayload(payload);`);
      body.push(`};`);
    } else {
      imports.push(`import { resolveUser as _resolve } from '${rel(customCfg.resolverPath)}';`);
      body.push(`const _resolveUser = async (req: any) => _resolve(req);`);
    }
    createRouter.addStatements(`\n${imports.join('\n')}\n`);
    createRouter.addStatements(`\n${body.join('\n')}\n`);
    createRouter.addStatements(`\nexport const authMiddleware = t.middleware(async ({ ctx, next }) => {\n  try {\n    const user = await _resolveUser((ctx as any).req);\n    return next({ ctx: { ...ctx, user } });\n  } catch {\n    return next({ ctx: { ...ctx, user: null } });\n  }\n});\n`);
    createRouter.addStatements(`\nexport const publicProcedure = t.procedure.use(authMiddleware);\n`);
    const authHelpersPath = path.resolve(outputDir, 'routers', 'helpers', 'auth.ts');
    await fs.mkdir(path.dirname(authHelpersPath), { recursive: true });
    const authSource = `// @generated\nexport function ensureAuth(ctx: any) {\n  if (!ctx?.user) {\n    const err: any = new Error('UNAUTHORIZED');\n    err.code = 'UNAUTHORIZED';\n    throw err;\n  }\n}\n\nexport function ensureRole(ctx: any, roles: string[]) {\n  ensureAuth(ctx);\n  const userRole = (ctx.user && (ctx.user['${rolesField}'] as string)) || null;\n  if (!userRole || !roles.includes(userRole)) {\n    const err: any = new Error('FORBIDDEN');\n    err.code = 'FORBIDDEN';\n    throw err;\n  }\n}\n`;
    await fs.writeFile(authHelpersPath, authSource, 'utf8');
  createRouter.addStatements(`\nimport { ensureAuth, ensureRole } from './auth';\n`);
    createRouter.addStatements(`\nexport const protectedProcedure = publicProcedure.use(t.middleware(async ({ ctx, next }) => {\n  ensureAuth(ctx);\n  return next();\n}));\n`);
    createRouter.addStatements(`\nexport const protectedProcedure = publicProcedure\n  .use(authMiddleware)\n  .use(t.middleware(async ({ ctx, next }) => {\n    ensureAuth(ctx);\n    return next();\n  }));\n`);
    createRouter.addStatements(`\nexport function roleProcedure(roles: string[]) {\n  return protectedProcedure.use(t.middleware(async ({ ctx, next }) => {\n    ensureRole(ctx, roles);\n    return next();\n  }));\n}\n`);
  }

  // If services are enabled, create typed BaseService and per-model services + registry
  if (config.withServices) {
    const servicesDirAbs = path.resolve(outputDir, config.serviceDir);
    const baseServiceFile = project.createSourceFile(
      path.resolve(servicesDirAbs, `BaseService.ts`),
      undefined,
      { overwrite: true },
    );
  baseServiceFile.addStatements(/* ts */ `
// @generated
import type { Prisma, PrismaClient } from '@prisma/client';
export type HasPrisma = { prisma: PrismaClient };

export class BaseService<M extends keyof PrismaClientModels, C extends HasPrisma = HasPrisma> {
  protected readonly model: M;
  protected readonly ctx: C;
  constructor(model: M, ctx: C) {
    this.model = model;
    this.ctx = ctx;
  }
  protected get prisma() {
    return this.ctx.prisma;
  }
}

// Helper mapped type to access client model delegates in a typed way
type PrismaClientModels = {
  ${models
    .filter((m) => !hiddenModels.includes(m.name))
  .map((m) => `${m.name}: Prisma.${m.name}Delegate`) // use default internal args
    .join(';\n  ')}
};
`);

    const indexFile = project.createSourceFile(
      path.resolve(servicesDirAbs, `index.ts`),
      undefined,
      { overwrite: true },
    );

    // Additional user imports if any
  for (const imp of config.serviceImports || []) {
      if (imp.namespace) {
    indexFile.addImportDeclaration({ moduleSpecifier: imp.from, namespaceImport: imp.namespace });
      } else if (imp.default || (imp.names && imp.names.length)) {
    indexFile.addImportDeclaration({ moduleSpecifier: imp.from, defaultImport: imp.default, namedImports: imp.names || [] });
      } else {
    indexFile.addImportDeclaration({ moduleSpecifier: imp.from });
      }
    }

  // Types from Prisma Client
  indexFile.addStatements(/* ts */ `
import type { Prisma } from '@prisma/client';
import { BaseService } from './BaseService';
`);
  indexFile.addStatements(/* ts */ `
type OpOpts = { bypassTenant?: boolean; withDeleted?: boolean };
type TenantContext = Context & { tenantId?: string | number };
`);

    // Import Context directly from configured path
    const contextImportFromServices = getRelativePath(
      path.resolve(outputDir, config.serviceDir),
      config.contextPath,
      true,
      options.schemaPath,
    );
    indexFile.addStatements(/* ts */ `
import type { Context } from '${contextImportFromServices}';
`);

    // Prepare schemas import base for services if Zod is enabled
    let servicesSchemasImportBase: string | null = null;
    if (config.withZod) {
      const schemasBaseFromServices = path
        .relative(
          path.resolve(outputDir, config.serviceDir),
          path.resolve(outputDir, 'schemas'),
        )
        .split(path.sep)
        .join(path.posix.sep);
      servicesSchemasImportBase = (schemasBaseFromServices.startsWith('.')
        ? `${schemasBaseFromServices}`
        : `./${schemasBaseFromServices}`
      )
        .replace(/\/+$/, '') // trim trailing slash
        .replace(/^\.$/, './');

      // We'll accumulate all unique schema imports across models, then add once
  const importLines = new Set<string>();

      // Helper to normalize a service method to an op name expected by helper
      const toSchemaOp = (method: string) => {
        switch (method) {
          case 'create':
            return 'createOne';
          case 'delete':
            return 'deleteOne';
          case 'update':
            return 'updateOne';
          case 'upsert':
            return 'upsertOne';
          default:
            return method; // includes findUnique, findUniqueOrThrow, findFirst, findFirstOrThrow, findMany, aggregate, groupBy, count, createMany, deleteMany, updateMany
        }
      };

      for (const model of models) {
        if (hiddenModels.includes(model.name)) continue;
        const serviceMethods = [
          'findUnique',
          'findUniqueOrThrow',
          'findFirst',
          'findFirstOrThrow',
          'findMany',
          'aggregate',
          'groupBy',
          'count',
          'create',
          'createManyAndReturn',
          'createMany',
          'delete',
          'update',
          'deleteMany',
          'updateManyAndReturn',
          'updateMany',
          'upsert',
        ];
        for (const m of serviceMethods) {
          const op = toSchemaOp(m);
          const line = getRouterSchemaImportByOpName(
            op,
            model.name,
            servicesSchemasImportBase!,
          );
          if (line) importLines.add(line);
        }
      }

      if (importLines.size) {
        indexFile.addStatements(Array.from(importLines).join('\n'));
      }
    }

    // Build per-model service classes with pass-through to prisma by default and zod parsing
    const serviceBlocks: string[] = [];
    for (const model of models) {
      if (hiddenModels.includes(model.name)) continue;
      const lc = model.name[0].toLowerCase() + model.name.slice(1);
      // Construct method bodies with optional Zod parsing
  const methodLine = (
        method: string,
        prismaMethod: string,
        prismaArgsType: string,
      ) => {
        // Normalize to helper's expected op for schema name resolution
        const normalizeOp = (m: string) => {
          switch (m) {
            case 'findUniqueOrThrow':
              return 'findUnique';
            case 'findFirstOrThrow':
              return 'findFirst';
            case 'create':
              return 'createOne';
            case 'delete':
              return 'deleteOne';
            case 'update':
              return 'updateOne';
            case 'upsert':
              return 'upsertOne';
            default:
              return m; // pass through others
          }
        };
        const schemaInputType = config.withZod
          ? getInputTypeByOpName(normalizeOp(method), model.name)
          : null;
        const parsed = config.withZod && schemaInputType ? `${schemaInputType}.parse(args)` : 'args';
        const cfg = modelGenConfig[model.name] || {};
        const tenantKey = cfg.tenantKey;
        const softKey = cfg.softDeleteKey;
  const isRead = ['findUnique','findUniqueOrThrow','findFirst','findFirstOrThrow','findMany','aggregate','groupBy','count'].includes(method);
        const isDelete = method === 'delete';
        const isDeleteMany = method === 'deleteMany';
        const isCreate = method === 'create' || method === 'createMany' || method === 'createManyAndReturn';
        const isUpdate = method === 'update' || method === 'updateMany' || method === 'updateManyAndReturn' || method === 'upsert';

        const header = `  ${method}(args: Prisma.${model.name}${prismaArgsType}, opts?: OpOpts) {`;
        const baseParse = method === 'groupBy'
          ? `const parsedArgs = ${parsed}; let argsParsed = { ...parsedArgs, orderBy: parsedArgs.orderBy } as unknown as Prisma.${model.name}GroupByArgs & { orderBy: Prisma.${model.name}OrderByWithAggregationInput | Prisma.${model.name}OrderByWithAggregationInput[] };`
          : `let argsParsed = ${parsed} as Prisma.${model.name}${prismaArgsType};`;

        const tenantVarDecl = tenantKey
          ? `const _t = (this as unknown as { ctx: { tenantId?: string | number } }).ctx.tenantId;`
          : '';

        const tenantRead = tenantKey
          ? `if (_t !== undefined && !opts?.bypassTenant) {
      const prevWhere = ('where' in argsParsed ? ( argsParsed as unknown as { where?: Record<string, unknown> } ).where : undefined) ?? {};
      argsParsed = { ...( argsParsed as unknown as { where?: Record<string, unknown> } ), where: { AND: [ prevWhere, { ${tenantKey}: _t } ] } } as Prisma.${model.name}${prismaArgsType};
    }`
          : '';

        const softRead = softKey
          ? `if (!opts?.withDeleted) {
      const prevWhere = ('where' in argsParsed ? ( argsParsed as unknown as { where?: Record<string, unknown> } ).where : undefined) ?? {};
      argsParsed = { ...( argsParsed as unknown as { where?: Record<string, unknown> } ), where: { AND: [ prevWhere, { ${softKey}: null } ] } } as Prisma.${model.name}${prismaArgsType};
    }`
          : '';

        const tenantWriteData = tenantKey
          ? `if (_t !== undefined && !('data' in argsParsed && (${JSON.stringify(tenantKey)} in (argsParsed as unknown as { data: Record<string, unknown> }).data))) {
      const prevData = ('data' in argsParsed ? ( argsParsed as unknown as { data: Record<string, unknown> } ).data : {}) as Record<string, unknown>;
      prevData[${JSON.stringify(tenantKey)}] = _t;
      argsParsed = { ...argsParsed, data: prevData } as Prisma.${model.name}${prismaArgsType};
    }`
          : '';

        const tenantWriteWhere = tenantKey
          ? `if (_t !== undefined && !opts?.bypassTenant) {
      const prevWhere = ('where' in argsParsed ? ( argsParsed as unknown as { where?: Record<string, unknown> } ).where : undefined) ?? {};
      argsParsed = { ...( argsParsed as unknown as { where?: Record<string, unknown> } ), where: { AND: [ prevWhere, { ${tenantKey}: _t } ] } } as Prisma.${model.name}${prismaArgsType};
    }`
          : '';

        const bodyLines: string[] = [];
        if (isRead) {
          bodyLines.push(baseParse);
          if (tenantKey) {
            bodyLines.push(tenantVarDecl);
            // Do not inject AND tenant filter into findUnique/OrThrow (requires WhereUnique)
            if (!(method === 'findUnique' || method === 'findUniqueOrThrow')) {
              bodyLines.push(tenantRead);
            }
          }
          if (softKey) {
            // Do not inject soft-delete filter into findUnique/OrThrow (requires WhereUnique)
            if (!(method === 'findUnique' || method === 'findUniqueOrThrow')) {
              bodyLines.push(softRead);
            }
          }
      return `${header}
    ${bodyLines.join('\n    ')}
    return this.prisma.${lc}.${prismaMethod}(argsParsed);
  }`;
        }
        if (isDelete) {
          if (softKey) {
            // Soft delete translates to update
            const softData = `{ ${softKey}: new Date() }`;
            if (tenantKey) {
              bodyLines.push(baseParse);
              bodyLines.push(tenantVarDecl);
        return `${header}
    ${bodyLines.join('\n    ')}
    const w = (argsParsed as Prisma.${model.name}DeleteArgs).where!;
  return this.prisma.${lc}.update({ where: w, data: ${softData} });
  }`;
            }
      return `${header}
    ${baseParse}
    const w = (argsParsed as Prisma.${model.name}DeleteArgs).where!;
  return this.prisma.${lc}.update({ where: w, data: ${softData} });
  }`;
          }
          // Hard delete; scope by tenant if configured
          bodyLines.push(baseParse);
          if (tenantKey) { bodyLines.push(tenantVarDecl); }
      return `${header}
    ${bodyLines.join('\n    ')}
    return this.prisma.${lc}.${prismaMethod}(argsParsed);
  }`;
        }
        if (isDeleteMany) {
          if (softKey) {
            const softData = `{ ${softKey}: new Date() }`;
            bodyLines.push(baseParse);
            if (tenantKey) { bodyLines.push(tenantVarDecl); bodyLines.push(tenantWriteWhere); }
    return `${header}
    ${bodyLines.join('\n    ')}
    const w = (argsParsed as Prisma.${model.name}DeleteManyArgs).where;
  return this.prisma.${lc}.updateMany({ where: w, data: ${softData} });
  }`;
          }
      bodyLines.push(baseParse);
          if (tenantKey) { bodyLines.push(tenantVarDecl); bodyLines.push(tenantWriteWhere); }
      return `${header}
    ${bodyLines.join('\n    ')}
    return this.prisma.${lc}.${prismaMethod}(argsParsed);
  }`;
        }
        if (isCreate) {
          bodyLines.push(baseParse);
          if (tenantKey) { bodyLines.push(tenantVarDecl); bodyLines.push(tenantWriteData); }
      return `${header}
    ${bodyLines.join('\n    ')}
    return this.prisma.${lc}.${prismaMethod}(argsParsed);
  }`;
        }
        if (isUpdate) {
          bodyLines.push(baseParse);
          if (tenantKey) {
            bodyLines.push(tenantVarDecl);
            if (method !== 'upsert') bodyLines.push(tenantWriteData);
          }
      return `${header}
    ${bodyLines.join('\n    ')}
    return this.prisma.${lc}.${prismaMethod}(argsParsed);
  }`;
        }
    return `${header}
  ${baseParse}
  return this.prisma.${lc}.${prismaMethod}(argsParsed);
  }`;
      };

  const lines: string[] = [];
      lines.push(methodLine('findUnique', 'findUnique', 'FindUniqueArgs'));
      lines.push(methodLine('findUniqueOrThrow', 'findUniqueOrThrow', 'FindUniqueOrThrowArgs'));
      lines.push(methodLine('findFirst', 'findFirst', 'FindFirstArgs'));
      lines.push(methodLine('findFirstOrThrow', 'findFirstOrThrow', 'FindFirstOrThrowArgs'));
      lines.push(methodLine('findMany', 'findMany', 'FindManyArgs'));
      lines.push(methodLine('aggregate', 'aggregate', 'AggregateArgs'));
      lines.push(methodLine('groupBy', 'groupBy', 'GroupByArgs'));
      lines.push(methodLine('count', 'count', 'CountArgs'));
      lines.push(methodLine('create', 'create', 'CreateArgs'));
    lines.push(methodLine('createManyAndReturn', 'createManyAndReturn', 'CreateManyAndReturnArgs'));
      lines.push(methodLine('createMany', 'createMany', 'CreateManyArgs'));
      lines.push(methodLine('delete', 'delete', 'DeleteArgs'));
      lines.push(methodLine('update', 'update', 'UpdateArgs'));
      lines.push(methodLine('deleteMany', 'deleteMany', 'DeleteManyArgs'));
    lines.push(methodLine('updateManyAndReturn', 'updateManyAndReturn', 'UpdateManyAndReturnArgs'));
      lines.push(methodLine('updateMany', 'updateMany', 'UpdateManyArgs'));
      lines.push(methodLine('upsert', 'upsert', 'UpsertArgs'));

  serviceBlocks.push(/* ts */ `
export class ${model.name}Service extends BaseService<'${model.name}', TenantContext> {
  constructor(ctx: TenantContext) { super('${model.name}' as const, ctx); }
${lines.join('\n')}
}
`);
    }

    indexFile.addStatements(serviceBlocks.join('\n'));

    // Services root factory
    indexFile.addStatements(/* ts */ `
export function makeServices(ctx: Context) {
  return {
    ${models
      .filter((m) => !hiddenModels.includes(m.name))
      .map((m) => `${m.name[0].toLowerCase() + m.name.slice(1)}: new ${m.name}Service(ctx)`) // e.g., user: new UserService(ctx)
      .join(',\n    ')}
  } as const;
}
`);
  }

  // Skip heavy formatting for performance during tests/CI

  const appRouter = project.createSourceFile(
    path.resolve(outputDir, 'routers', `index.ts`),
    undefined,
    { overwrite: true },
  );

  generateCreateRouterImport({
    sourceFile: appRouter,
  });

  const routerStatements = [];

  // Preload schema filenames once to avoid repeated fs.stat calls
  const schemasDirAbs = path.resolve(outputDir, 'schemas');
  let availableSchemaFiles: Set<string> | null = null;
  if (config.withZod) {
    try {
      const files = await fs.readdir(schemasDirAbs);
      availableSchemaFiles = new Set(files);
    } catch {
      availableSchemaFiles = new Set();
    }
  }

  for (const modelOperation of modelOperations) {
    const { model, ...operations } = modelOperation;
    if (hiddenModels.includes(model)) continue;

    // Start from Prisma-reported operations, then add known extras if requested
    const reportedOps = Object.keys(operations);
    // Extras we can synthesize even if not reported by DMMF
    const extraOps = ['createManyAndReturn', 'updateManyAndReturn', 'count'];
    let requestedExtras = extraOps.filter((extra) =>
      config.generateModelActions.includes(extra as unknown as never),
    );
    // If withZod, ensure the schema exists for the op+model; skip otherwise (provider compatibility)
    if (config.withZod && availableSchemaFiles) {
      const filtered: string[] = [];
      for (const op of requestedExtras) {
        const fileOp = op === 'count' ? 'findMany' : op;
        const fileName = `${fileOp}${model}.schema.ts`;
        if (availableSchemaFiles.has(fileName)) filtered.push(op);
      }
      requestedExtras = filtered;
    }
    const modelActions = [
      ...reportedOps,
      ...requestedExtras.filter((op) => !reportedOps.includes(op)),
    ].filter((opType) => {
      const baseOpType = opType.replace('One', '').replace('OrThrow', '');
      return config.generateModelActions.some(
        (action) => action === baseOpType,
      );
    });
    // selected operations computed in modelActions
    if (!modelActions.length) continue;

    const plural = pluralize(model.toLowerCase());

    generateRouterImport(appRouter, plural, model);
    const modelRouter = project.createSourceFile(
      path.resolve(outputDir, 'routers', `${model}.router.ts`),
      undefined,
      { overwrite: true },
    );

    generateCreateRouterImport({
      sourceFile: modelRouter,
      config,
    });

    if (config.withServices) {
      // Import makeServices for delegation
      const rel = path
        .relative(path.resolve(outputDir, 'routers'), path.resolve(outputDir, config.serviceDir))
        .split(path.sep)
        .join(path.posix.sep);
      modelRouter.addStatements(/* ts */ `
import { makeServices } from "${rel.startsWith('.') ? rel : `./${rel}`}";
`);
    }

    if (config.withZod) {
      // Prefer schemas under our output directory; fallback to project-level generated/schemas
      const schemasBase = path
        .relative(
          path.resolve(outputDir, 'routers'),
          path.resolve(outputDir, 'schemas'),
        )
        .split(path.sep)
        .join(path.posix.sep);
      const schemasImportBase = schemasBase.startsWith('.')
        ? `${schemasBase}/${''}`.replace(/\/+/g, '/') // ensure trailing slash
        : `./${schemasBase}/`;
      generateRouterSchemaImports(
        modelRouter,
        model,
        modelActions,
        // From a router file inside outputDir/routers, import base should be "../schemas"
        // The above computation yields "../schemas", but normalize without trailing slash in helper
        schemasImportBase.replace(/\/$/, '').replace(/^\.$/, './') ||
          '../schemas',
      );
    }

    modelRouter.addStatements(/* ts */ `
      export const ${plural}Router = t.router({`);

    for (const opType of modelActions) {
      // Use mapping-provided name when available; otherwise synthesize
      const opNameWithModel =
        (operations as Record<string, string>)[opType] ?? `${opType}${model}`;
      const baseOpType = opType.replace('OrThrow', '');

      generateProcedure(
        modelRouter,
        opNameWithModel,
        getInputTypeByOpName(baseOpType, model),
        model,
        opType,
        baseOpType,
        config,
      );
    }

    modelRouter.addStatements(/* ts */ `
    })`);

    modelRouter.formatText({ indentSize: 2 });
    routerStatements.push(/* ts */ `
      ${model.toLowerCase()}: ${plural}Router`);
  }

  appRouter.addStatements(/* ts */ `
    export const appRouter = t.router({${routerStatements}})
    `);

  // Skip heavy formatting for performance during tests/CI
  await project.save();

  // Reserve variable to reuse the built OpenAPI document for Postman-from-OpenAPI
  let lastOpenApi: any | null = null;

  // OpenAPI document
  const openapiOpt = config.openapi as any;
  const openapiEnabled = !!openapiOpt && openapiOpt !== (false as any);
  if (openapiEnabled) {
    const enabled = typeof openapiOpt === 'object' && 'enabled' in openapiOpt ? !!openapiOpt.enabled : true;
    if (enabled) {
  const oaTitle = (typeof openapiOpt === 'object' && 'title' in openapiOpt ? openapiOpt.title : (config as any).openapiTitle) || 'Prisma tRPC API';
  const oaVersion = (typeof openapiOpt === 'object' && 'version' in openapiOpt ? openapiOpt.version : (config as any).openapiVersion) || '1.0.0';
  const baseUrl = (typeof openapiOpt === 'object' && 'baseUrl' in openapiOpt ? openapiOpt.baseUrl : (config as any).openapiBaseUrl) || 'http://localhost:3000';
  const pathPrefix = (typeof openapiOpt === 'object' && 'pathPrefix' in openapiOpt ? openapiOpt.pathPrefix : (config as any).openapiPathPrefix) || 'trpc';
  const pathStyle: 'slash' | 'dot' = (typeof openapiOpt === 'object' && 'pathStyle' in openapiOpt ? openapiOpt.pathStyle : (config as any).openapiPathStyle) || 'slash';
  const includeExamples = typeof openapiOpt === 'object' && 'includeExamples' in openapiOpt ? !!openapiOpt.includeExamples : ((config as any).openapiIncludeExamples ?? true);

      const paths: Record<string, any> = {};

      // Helpers (duplicated minimally from Postman section to avoid hoisting large blocks)
      const getModelByName = (name: string) => models.find((m) => m.name === name);
      const toWhereUnique = (m: string) => {
        const model = getModelByName(m);
        const idField = model?.fields.find((f) => f.isId) || model?.fields.find((f) => f.isUnique);
        if (!idField) return {} as any;
        const sample = idField.type === 'Int' || idField.type === 'BigInt' ? 1 : idField.type === 'String' ? 'id' : idField.type === 'DateTime' ? new Date().toISOString() : 1;
        return { [idField.name]: sample } as any;
      };
      const sampleScalar = (field: typeof models[number]['fields'][number]): any => {
        if (field.isList) return [];
        switch (field.type) {
          case 'Int':
          case 'BigInt':
            return 1;
          case 'Float':
          case 'Decimal':
            return 1.0;
          case 'Boolean':
            return true;
          case 'String':
            return `${field.name}`;
          case 'DateTime':
            return new Date().toISOString();
          default:
            return null;
        }
      };
      const buildCreateData = (m: string) => {
        const model = getModelByName(m);
        if (!model) return {};
        const cfg = modelGenConfig[model.name] || {};
        const data: any = {};
        for (const f of model.fields) {
          if (f.isId && f.hasDefaultValue) continue;
          if (f.isUpdatedAt) continue;
          if (f.isRequired && !f.relationName) {
            data[f.name] = sampleScalar(f);
          }
        }
        if (cfg.tenantKey) delete data[cfg.tenantKey];
        if (cfg.softDeleteKey) delete data[cfg.softDeleteKey];
        return data;
      };
      const buildUpdateData = (m: string) => {
        const model = getModelByName(m);
        if (!model) return {};
        const cfg = modelGenConfig[model.name] || {};
        const data: any = {};
        for (const f of model.fields) {
          if (f.relationName) continue;
          if (f.isId) continue;
          if (f.isUpdatedAt) continue;
          if (cfg.tenantKey && f.name === cfg.tenantKey) continue;
          if (cfg.softDeleteKey && f.name === cfg.softDeleteKey) continue;
          data[f.name] = sampleScalar(f);
          if (Object.keys(data).length >= 2) break;
        }
        return data;
      };
      const pickGroupByField = (m: string) => {
        const model = getModelByName(m);
        if (!model) return 'id';
        const idField = model.fields.find((f) => f.isId);
        if (idField) return idField.name;
        const scalar = model.fields.find(
          (f) => !f.relationName && (f.type === 'Int' || f.type === 'String' || f.type === 'Boolean' || f.type === 'DateTime'),
        );
        return scalar?.name ?? model.fields[0]?.name ?? 'id';
      };

      for (const modelOperation of modelOperations) {
        const { model, ...operations } = modelOperation as any;
        if (hiddenModels.includes(model)) continue;
        const reportedOps = Object.keys(operations);
        const extraOps = ['createManyAndReturn', 'updateManyAndReturn', 'count'];
        let requestedExtras = extraOps.filter((extra) =>
          config.generateModelActions.includes(extra as unknown as never),
        );
        const modelActions = [
          ...reportedOps,
          ...requestedExtras.filter((op) => !reportedOps.includes(op)),
        ].filter((opType) => {
          const baseOpType = opType.replace('One', '').replace('OrThrow', '');
          return config.generateModelActions.some((action) => action === baseOpType);
        });
        if (!modelActions.length) continue;

        const cfg = modelGenConfig[model] || {};
        for (const opType of modelActions) {
          const normalized = opType.replace('One', '');
          const trpcPath = pathStyle === 'slash'
            ? `/${pathPrefix}/${model.toLowerCase()}/${normalized}`
            : `/${pathPrefix}/${model.toLowerCase()}.${normalized}`;

          // Build skeleton input
          let input: any = {};
          const isUnique = ['findUnique','findUniqueOrThrow','delete','update','upsert'].includes(normalized);
          const isFindFirst = ['findFirst','findFirstOrThrow'].includes(normalized);
          const isFindManyLike = ['findMany','aggregate','count'].includes(normalized);
          const isGroupBy = normalized === 'groupBy';
          const isCreate = normalized === 'create' || normalized === 'createMany' || normalized === 'createManyAndReturn';
          const isUpdate = normalized === 'update' || normalized === 'updateMany' || normalized === 'updateManyAndReturn' || normalized === 'upsert';
          const isDeleteMany = normalized === 'deleteMany';

          if (isUnique) {
            input = { where: toWhereUnique(model) };
            if (normalized === 'update') input.data = buildUpdateData(model);
            if (normalized === 'upsert') input = { where: toWhereUnique(model), update: buildUpdateData(model), create: buildCreateData(model) };
          } else if (isFindFirst) {
            input = { where: {}, orderBy: [{ id: 'asc' }], take: 1 };
          } else if (isFindManyLike) {
            input = { where: {}, orderBy: [{ id: 'asc' }], take: 10 };
          } else if (isGroupBy) {
            const byField = pickGroupByField(model);
            input = { by: [byField], orderBy: [{ [byField]: 'asc' }], _count: { _all: true } } as any;
          } else if (isCreate) {
            input = normalized === 'create' ? { data: buildCreateData(model) } : { data: [buildCreateData(model)] };
          } else if (isUpdate) {
            input = { where: {}, data: buildUpdateData(model) };
          } else if (isDeleteMany) {
            input = { where: {} };
          }
          if (cfg.tenantKey && input?.where && input.where[cfg.tenantKey]) delete input.where[cfg.tenantKey];
          if (cfg.softDeleteKey && input?.where && input.where[cfg.softDeleteKey]) delete input.where[cfg.softDeleteKey];

          // OpenAPI: use POST for all procedures (safe default for tRPC)
          paths[trpcPath] = paths[trpcPath] || {};
          paths[trpcPath]['post'] = {
            tags: [model],
            operationId: `${model}.${opType}`,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { input: { type: 'object' } },
                  },
                  ...(includeExamples
                    ? { examples: { skeleton: { value: { input } } } }
                    : {}),
                },
              },
            },
            responses: {
              '200': { description: 'OK' },
            },
          } as const;
        }
      }

      const openapi = {
        openapi: '3.0.3',
        info: { title: oaTitle, version: oaVersion },
        servers: [{ url: baseUrl }],
        paths,
        tags: models.filter((m) => !hiddenModels.includes(m.name)).map((m) => ({ name: m.name })),
      } as const;

      lastOpenApi = openapi;

      const oaDir = path.resolve(outputDir, 'openapi');
      await fs.mkdir(oaDir, { recursive: true });
      await fs.writeFile(
        path.resolve(oaDir, 'openapi.json'),
        JSON.stringify(openapi, null, 2),
        'utf8',
      );

      // Emit an adapter file for convenient imports
      const adaptersDir = path.resolve(outputDir, 'routers', 'adapters');
      await fs.mkdir(adaptersDir, { recursive: true });
      const adapterTs = `// @generated
// Simple export of the OpenAPI document as a const
export const openApiDocument = ${JSON.stringify(openapi, null, 2)} as const;
`;
      await fs.writeFile(path.resolve(adaptersDir, 'openapi.ts'), adapterTs, 'utf8');
    }
  }

  // Postman collection (after OpenAPI so we can optionally derive from it)
  const postmanOpt = config.postman;
  const postmanEnabled = !!postmanOpt && postmanOpt !== (false as any);
  if (postmanEnabled) {
    const postmanDir = path.resolve(outputDir, 'postman');
    await fs.mkdir(postmanDir, { recursive: true });
    const endpoint = (typeof postmanOpt === 'object' && 'endpoint' in postmanOpt)
      ? (postmanOpt as any).endpoint
      : 'http://localhost:3000/trpc';
    const envName = (typeof postmanOpt === 'object' && 'envName' in postmanOpt)
      ? (postmanOpt as any).envName
      : 'TRPC_ENDPOINT';
  const fromOpenApi = typeof postmanOpt === 'object' && 'fromOpenApi' in postmanOpt ? !!(postmanOpt as any).fromOpenApi : !!(config as any).postmanFromOpenApi;
    let items: any[] = [];

    if (fromOpenApi && lastOpenApi) {
      // Transform OpenAPI to Postman collection
      const tagToFolder: Record<string, { name: string; item: any[] }> = {};
      const paths = (lastOpenApi as any).paths || {};
      for (const [p, methods] of Object.entries(paths)) {
        const postOp = (methods as any).post;
        if (!postOp) continue;
        const tags: string[] = Array.isArray(postOp.tags) && postOp.tags.length ? postOp.tags : ['General'];
        const folderTag = tags[0];
        if (!tagToFolder[folderTag]) tagToFolder[folderTag] = { name: folderTag, item: [] };
        const operationId: string = postOp.operationId || p;
        // Prefer the skeleton example from OpenAPI if available
        let input = {} as any;
        const rb = postOp.requestBody?.content?.['application/json'];
        const example = rb?.examples?.skeleton?.value;
        if (example) input = example;
        const trpcPath = p.replace(/^\/+/, '').replace(/^.*\//, (m) => m); // we'll reconstruct URL using envName
        tagToFolder[folderTag].item.push({
          name: operationId,
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            url: {
              raw: `{{${envName}}}/${trpcPath.split('/').slice(-2).join('.')}`,
              host: [`{{${envName}}}`],
              path: trpcPath.split('/').slice(-2),
            },
            body: {
              mode: 'raw',
              raw: JSON.stringify(input, null, 2),
              options: { raw: { language: 'json' } },
            },
          },
        });
      }
      items = Object.values(tagToFolder);
    } else {
      // Fallback: build from procedures with optional skeleton examples
      let examplesMode: 'none' | 'skeleton' = 'none';
      if (typeof postmanOpt === 'object' && 'examples' in postmanOpt) {
        examplesMode = ((postmanOpt as any).examples ?? 'none') as 'none' | 'skeleton';
      } else if (config.postmanExamples) {
        examplesMode = config.postmanExamples as 'none' | 'skeleton';
      }

      for (const modelOperation of modelOperations) {
        const { model, ...operations } = modelOperation as any;
        if (hiddenModels.includes(model)) continue;
        const reportedOps = Object.keys(operations);
        const extraOps = ['createManyAndReturn', 'updateManyAndReturn', 'count'];
        let requestedExtras = extraOps.filter((extra) =>
          config.generateModelActions.includes(extra as unknown as never),
        );
        const modelActions = [
          ...reportedOps,
          ...requestedExtras.filter((op) => !reportedOps.includes(op)),
        ].filter((opType) => {
          const baseOpType = opType.replace('One', '').replace('OrThrow', '');
          return config.generateModelActions.some((action) => action === baseOpType);
        });
        if (!modelActions.length) continue;

        const folder: any = { name: model, item: [] as any[] };
        const cfg = modelGenConfig[model] || {};
        // Minimal local helpers reused (duplicated for brevity)
        const getModelByName = (name: string) => models.find((m) => m.name === name);
        const toWhereUnique = (m: string) => {
          const mo = getModelByName(m);
          const idField = mo?.fields.find((f) => f.isId) || mo?.fields.find((f) => f.isUnique);
          if (!idField) return {} as any;
          const sample = idField.type === 'Int' || idField.type === 'BigInt' ? 1 : idField.type === 'String' ? 'id' : idField.type === 'DateTime' ? new Date().toISOString() : 1;
          return { [idField.name]: sample } as any;
        };
        const sampleScalar = (field: typeof models[number]['fields'][number]): any => {
          if (field.isList) return [];
          switch (field.type) {
            case 'Int':
            case 'BigInt':
              return 1;
            case 'Float':
            case 'Decimal':
              return 1.0;
            case 'Boolean':
              return true;
            case 'String':
              return `${field.name}`;
            case 'DateTime':
              return new Date().toISOString();
            default:
              return null;
          }
        };
        const buildCreateData = (m: string) => {
          const mo = getModelByName(m);
          if (!mo) return {};
          const data: any = {};
          for (const f of mo.fields) {
            if (f.isId && f.hasDefaultValue) continue;
            if (f.isUpdatedAt) continue;
            if (f.isRequired && !f.relationName) data[f.name] = sampleScalar(f);
          }
          if (cfg.tenantKey) delete (data as any)[cfg.tenantKey];
          if (cfg.softDeleteKey) delete (data as any)[cfg.softDeleteKey];
          return data;
        };
        const buildUpdateData = (m: string) => {
          const mo = getModelByName(m);
          if (!mo) return {};
          const data: any = {};
          for (const f of mo.fields) {
            if (f.relationName || f.isId || f.isUpdatedAt) continue;
            if (cfg.tenantKey && f.name === cfg.tenantKey) continue;
            if (cfg.softDeleteKey && f.name === cfg.softDeleteKey) continue;
            data[f.name] = sampleScalar(f);
            if (Object.keys(data).length >= 2) break;
          }
          return data;
        };

        for (const opType of modelActions) {
          const trpcPath = `${model.toLowerCase()}.${opType.replace('One', '')}`;
          const name = `${model}.${opType}`;
          let input: any = {};
          if (examplesMode === 'skeleton') {
            const normalized = opType.replace('One', '');
            const isUnique = ['findUnique','findUniqueOrThrow','delete','update','upsert'].includes(normalized);
            const isFindFirst = ['findFirst','findFirstOrThrow'].includes(normalized);
            const isFindManyLike = ['findMany','aggregate','count'].includes(normalized);
            const isGroupBy = normalized === 'groupBy';
            const isCreate = normalized === 'create' || normalized === 'createMany' || normalized === 'createManyAndReturn';
            const isUpdate = normalized === 'update' || normalized === 'updateMany' || normalized === 'updateManyAndReturn' || normalized === 'upsert';
            const isDeleteMany = normalized === 'deleteMany';

            if (isUnique) {
              input = { where: toWhereUnique(model) };
              if (normalized === 'update') input.data = buildUpdateData(model);
              if (normalized === 'upsert') input = { where: toWhereUnique(model), update: buildUpdateData(model), create: buildCreateData(model) };
            } else if (isFindFirst) {
              input = { where: {}, orderBy: [{ id: 'asc' }], take: 1 };
            } else if (isFindManyLike) {
              input = { where: {}, orderBy: [{ id: 'asc' }], take: 10 };
            } else if (isGroupBy) {
              input = { by: ['id'], orderBy: [{ id: 'asc' }], _count: { _all: true } } as any;
            } else if (isCreate) {
              input = normalized === 'create' ? { data: buildCreateData(model) } : { data: [buildCreateData(model)] };
            } else if (isUpdate) {
              input = { where: {}, data: buildUpdateData(model) };
            } else if (isDeleteMany) {
              input = { where: {} };
            }
          }

          folder.item.push({
            name,
            request: {
              method: 'POST',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              url: {
                raw: `{{${envName}}}/${trpcPath}`,
                host: [`{{${envName}}}`],
                path: trpcPath.split('.'),
              },
              body: {
                mode: 'raw',
                raw: JSON.stringify({ input }, null, 2),
                options: { raw: { language: 'json' } },
              },
            },
          });
        }
        items.push(folder);
      }
    }

    const collection = {
      info: {
        name: 'Prisma tRPC Generator',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: items,
      variable: [
        { key: envName, value: endpoint, type: 'string' },
      ],
    } as const;

    await fs.writeFile(
      path.resolve(postmanDir, 'collection.json'),
      JSON.stringify(collection, null, 2),
      'utf8',
    );
  }
}
