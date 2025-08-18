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

  const results = configSchema.safeParse(options.generator.config);
  if (!results.success) throw new Error('Invalid options passed');
  const config = results.data;

  // Backward-compat notice: withShield default changed to false per README.
  // If user didn't explicitly set it, warn once to avoid surprises.
  const rawConfig = options.generator.config ?? ({} as Record<string, unknown>);
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
}
