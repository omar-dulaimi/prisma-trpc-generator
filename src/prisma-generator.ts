import { parseEnvValue, getDMMF } from '@prisma/internals';
import { EnvValue, GeneratorOptions } from '@prisma/generator-helper';
import { promises as fs } from 'fs';
import path from 'path';
import pluralize from 'pluralize';
import { generate as PrismaZodGenerator } from 'prisma-zod-generator/lib/prisma-generator';
import { generate as PrismaTrpcShieldGenerator } from 'prisma-trpc-shield-generator/lib/prisma-generator';
import removeDir from './utils/removeDir';
import {
  generateProcedure,
  generatetRPCImport,
  generateRouterSchemaImports,
  getInputTypeByOpName,
  generateBaseRouter,
  generateCreateRouterImport,
  generateRouterImport,
  generateShieldImport,
} from './helpers';
import { project } from './project';
import { configSchema } from './config';

export async function generate(options: GeneratorOptions) {
  const outputDir = parseEnvValue(options.generator.output as EnvValue);
  const results = configSchema.safeParse(options.generator.config);
  if (!results.success) throw new Error('Invalid options passed');
  const config = results.data;

  await fs.mkdir(outputDir, { recursive: true });
  await removeDir(outputDir, true);
  await PrismaZodGenerator(options);

  let shieldOutputPath: string;
  if (config.withShield) {
    const outputPath = options.generator.output.value;
    shieldOutputPath =
      outputPath
        .split(path.sep)
        .slice(0, outputPath.split(path.sep).length - 1)
        .join(path.sep) + '/shield';

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
  export const appRouter = ${
    config.withMiddleware ? 'createProtectedRouter' : 'createRouter'
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
    generateRouterSchemaImports(modelRouter, model, hasCreateMany);

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
