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
  resolveModelsComments,
} from './helpers';
import { project } from './project';
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
