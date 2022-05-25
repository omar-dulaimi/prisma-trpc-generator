import { DMMF as PrismaDMMF } from '@prisma/client/runtime';
import { parseEnvValue } from '@prisma/sdk';
import { EnvValue, GeneratorOptions } from '@prisma/generator-helper';
import { promises as fs } from 'fs';
import path from 'path';
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

  if (config.withShield) {
    const outputPath = options.generator.output.value;
    const newPath =
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
          value: newPath,
        },
      },
    });
  }

  const prismaClientProvider = options.otherGenerators.find(
    (it) => parseEnvValue(it.provider) === 'prisma-client-js',
  );
  const prismaClientPath = parseEnvValue(
    prismaClientProvider?.output as EnvValue,
  );
  const prismaClientDmmf = (await import(prismaClientPath))
    .dmmf as PrismaDMMF.Document;

  const createRouter = project.createSourceFile(
    path.resolve(outputDir, 'routers', 'helpers', 'createRouter.ts'),
    undefined,
    { overwrite: true },
  );

  generatetRPCImport(createRouter);
  generateBaseRouter(createRouter, config.withMiddleware);

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
    const { model, plural, ...operations } = modelOperation;
    generateRouterImport(appRouter, plural, model);
    const modelRouter = project.createSourceFile(
      path.resolve(outputDir, 'routers', `${model}.router.ts`),
      undefined,
      { overwrite: true },
    );

    generateCreateRouterImport(modelRouter, false);
    generateRouterSchemaImports(modelRouter, model);

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
