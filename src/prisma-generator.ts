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
  getInputTypeByOpName
} from './helpers';
import { project } from './project';
import removeDir from './utils/removeDir';

export async function generate(options: GeneratorOptions) {
  const outputDir = parseEnvValue(options.generator.output as EnvValue);
  const results = configSchema.safeParse(options.generator.config);
  if (!results.success) throw new Error('Invalid options passed');
  const config = results.data;

  await fs.mkdir(outputDir, { recursive: true });
  await removeDir(outputDir, true);

  options.generator.config["isGenerateSelect"] = "true";
  await PrismaZodGenerator(options);

  let shieldOutputPath: string;
  if (config.withShield) {
    const outputPath = options.generator.output.value;
    shieldOutputPath =
      (outputPath
        .split(path.sep)
        .slice(0, outputPath.split(path.sep).length - 1)
        .join(path.sep) + '/shield')
        .split(path.sep)
        .join(path.posix.sep);

    shieldOutputPath = path.relative(path.join(outputPath, 'routers', 'helpers'), shieldOutputPath)

    await PrismaTrpcShieldGenerator({
      ...options,
      generator: {
        ...options.generator,
        output: {
          ...options.generator.output,
          value: shieldOutputPath,
        },
      },
    });
  }

  const prismaClientProvider = options.otherGenerators.find(
    (it) => parseEnvValue(it.provider) === 'prisma-client-js',
  );

  const dataSource = options.datasources?.[0];

  const prismaClientDmmf = await getDMMF({
    datamodel: options.datamodel,
    previewFeatures: prismaClientProvider.previewFeatures,
  });

  const createRouter = project.createSourceFile(
    path.resolve(outputDir, 'routers', 'helpers', 'createRouter.ts'),
    undefined,
    { overwrite: true },
  );

  generatetRPCImport(createRouter);
  if (config.withShield) {
    generateShieldImport(createRouter, shieldOutputPath);
  }
  generateBaseRouter(createRouter, config);

  createRouter.formatText({
    indentSize: 2,
  });

  const appRouter = project.createSourceFile(
    path.resolve(outputDir, 'routers', `index.ts`),
    undefined,
    { overwrite: true },
  );

  generateCreateRouterImport(appRouter, config.withMiddleware);
  appRouter.addStatements(/* ts */ `
  export const appRouter = ${config.withMiddleware ? 'createProtectedRouter' : 'createRouter'
    }()`);

  prismaClientDmmf.mappings.modelOperations.forEach((modelOperation) => {
    const { model, ...operations } = modelOperation;
    const plural = pluralize(model.toLowerCase());
    const hasCreateMany = Boolean(operations.createMany);
    generateRouterImport(appRouter, plural, model);
    const modelRouter = project.createSourceFile(
      path.resolve(outputDir, 'routers', `${model}.router.ts`),
      undefined,
      { overwrite: true },
    );

    generateCreateRouterImport(modelRouter, false);
    generateRouterSchemaImports(
      modelRouter,
      model,
      hasCreateMany,
      dataSource.provider,
    );

    modelRouter.addStatements(/* ts */ `
    export const ${plural}Router = createRouter()`);
    for (const [opType, opNameWithModel] of Object.entries(operations)) {
      generateProcedure(
        modelRouter,
        opNameWithModel,
        getInputTypeByOpName(opType, model),
        model,
        opType,
      );
    }
    modelRouter.formatText({ indentSize: 2 });
    appRouter.addStatements(/* ts */ `
    .merge('${model.toLowerCase()}.', ${plural}Router)`);
  });

  appRouter.formatText({ indentSize: 2 });
  await project.save();
}
