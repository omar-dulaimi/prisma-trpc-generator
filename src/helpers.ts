import { DMMF, EnvValue, GeneratorOptions } from '@prisma/generator-helper';
import { parseEnvValue } from '@prisma/internals';
import { SourceFile } from 'ts-morph';
import { Config } from './config';
import getRelativePath from './utils/getRelativePath';
import { uncapitalizeFirstLetter } from './utils/uncapitalizeFirstLetter';

const getProcedureName = (config: Config) => {
  return config.withShield
    ? 'shieldedProcedure'
    : config.withMiddleware
      ? 'protectedProcedure'
      : 'publicProcedure';
};

export const generateCreateRouterImport = ({
  sourceFile,
  config,
}: {
  sourceFile: SourceFile;
  config?: Config;
}) => {
  const imports = ['t'];

  if (config) {
    imports.push(getProcedureName(config));
  }

  sourceFile.addImportDeclaration({
    moduleSpecifier: './helpers/createRouter',
    namedImports: imports,
  });
};

export const generatetRPCImport = (sourceFile: SourceFile) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: '@trpc/server',
    namespaceImport: 'trpc',
  });
};

export const generateShieldImport = (
  sourceFile: SourceFile,
  options: GeneratorOptions,
  value: string | boolean,
) => {
  const outputDir = parseEnvValue(options.generator.output as EnvValue);

  let shieldPath = getRelativePath(outputDir, 'shield/shield');

  if (typeof value === 'string') {
    shieldPath = getRelativePath(outputDir, value, true, options.schemaPath);
  }
  // Emit using single quotes to align with test expectations
  sourceFile.addStatements(/* ts */ `
  import { permissions } from '${shieldPath}';
  `);
};

export const generateMiddlewareImport = (
  sourceFile: SourceFile,
  options: GeneratorOptions,
) => {
  const outputDir = parseEnvValue(options.generator.output as EnvValue);
  sourceFile.addImportDeclaration({
    moduleSpecifier: getRelativePath(outputDir, 'middleware'),
    namedImports: ['permissions'],
  });
};

export const generateRouterImport = (
  sourceFile: SourceFile,
  modelNamePlural: string,
  modelNameCamelCase: string,
) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: `./${modelNameCamelCase}.router`,
    namedImports: [`${modelNamePlural}Router`],
  });
};

export function generateBaseRouter(
  sourceFile: SourceFile,
  config: Config,
  options: GeneratorOptions,
) {
  const outputDir = parseEnvValue(options.generator.output as EnvValue);
  sourceFile.addStatements(/* ts */ `
  import type { Context } from '${getRelativePath(
    outputDir,
    config.contextPath,
    true,
    options.schemaPath,
  )}';
  `);
  // Re-export Context for downstream type-only imports from this helper module
  sourceFile.addStatements(/* ts */ `
  export type { Context } from '${getRelativePath(
    outputDir,
    config.contextPath,
    true,
    options.schemaPath,
  )}';
  `);

  if (config.trpcOptionsPath) {
    sourceFile.addStatements(/* ts */ `
      import trpcOptions from '${getRelativePath(
        outputDir,
        config.trpcOptionsPath,
        true,
        options.schemaPath,
      )}';
    `);
  }

  sourceFile.addStatements(/* ts */ `
  export const t = trpc.initTRPC.context<Context>().create(${
    config.trpcOptionsPath ? 'trpcOptions' : ''
  });
  `);

  const middlewares = [];

  if (config.withMiddleware && typeof config.withMiddleware === 'boolean') {
    sourceFile.addStatements(/* ts */ `
    export const globalMiddleware = t.middleware(async ({ ctx, next }) => {
      // Add your middleware logic here
      return next()
    });`);
    middlewares.push({
      type: 'global',
      value: /* ts */ `.use(globalMiddleware)`,
    });
  }

  if (config.withMiddleware && typeof config.withMiddleware === 'string') {
    sourceFile.addStatements(/* ts */ `
  import defaultMiddleware from '${getRelativePath(
    outputDir,
    config.withMiddleware,
    true,
    options.schemaPath,
  )}';
  `);
    sourceFile.addStatements(/* ts */ `
    export const globalMiddleware = t.middleware(defaultMiddleware);`);
    middlewares.push({
      type: 'global',
      value: /* ts */ `.use(globalMiddleware)`,
    });
  }

  if (config.withShield) {
    sourceFile.addStatements(/* ts */ `
    export const permissionsMiddleware = t.middleware(permissions); `);
    middlewares.push({
      type: 'shield',
      value: /* ts */ `
      .use(permissions)`,
    });
  }

  sourceFile.addStatements(/* ts */ `
    export const publicProcedure = t.procedure; `);

  if (middlewares.length > 0) {
    const procName = getProcedureName(config);

    middlewares.forEach((middleware, i) => {
      if (i === 0) {
        sourceFile.addStatements(/* ts */ `
    export const ${procName} = t.procedure
      `);
      }

      sourceFile.addStatements(/* ts */ `
      .use(${
        middleware.type === 'shield'
          ? 'permissionsMiddleware'
          : 'globalMiddleware'
      })
      `);
    });
  }
}

export function generateProcedure(
  sourceFile: SourceFile,
  name: string,
  typeName: string,
  modelName: string,
  opType: string,
  baseOpType: string,
  config: Config,
) {
  let input = 'input';
  const nameWithoutModel = name.replace(modelName as string, '');
  if (nameWithoutModel === 'groupBy' && config.withZod) {
    // Ensure 'orderBy' key exists in the argument type to satisfy Prisma's groupBy constraints
    input = '{ ...input, orderBy: input.orderBy }';
  }
  // For groupBy, pass the full input (schema aligns with Prisma.GroupByArgs)
  const procHeader = `${
    config.showModelNameInProcedure ? name : nameWithoutModel
  }: ${getProcedureName(config)}
  ${config.withZod ? `.input(${typeName})` : ''}.${getProcedureTypeByOpName(
    baseOpType,
  )}`;

  if (!config.withServices) {
    sourceFile.addStatements(/* ts */ `${procHeader}(async ({ ctx, input }) => {
    const ${name} = await ctx.prisma.${uncapitalizeFirstLetter(
      modelName,
    )}.${opType === 'count' ? 'count' : opType.replace('One', '')}(${input});
    return ${name};
  }),`);
  } else {
    const methodName = opType === 'count' ? 'count' : opType.replace('One', '');
    sourceFile.addStatements(/* ts */ `${procHeader}(async ({ ctx, input }) => {
    const services = makeServices(ctx);
    const ${name} = await services.${uncapitalizeFirstLetter(modelName)}.${methodName}(${input});
    return ${name};
  }),`);
  }
}

export function generateRouterSchemaImports(
  sourceFile: SourceFile,
  modelName: string,
  modelActions: string[],
  schemasImportBase: string,
) {
  sourceFile.addStatements(
    /* ts */
    [
      // remove any duplicate import statements
      ...new Set(
        modelActions.map((opName) =>
          getRouterSchemaImportByOpName(opName, modelName, schemasImportBase),
        ),
      ),
    ].join('\n'),
  );
}

export const getRouterSchemaImportByOpName = (
  opName: string,
  modelName: string,
  schemasImportBase: string,
) => {
  const opType = opName.replace('OrThrow', '');
  const inputType = getInputTypeByOpName(opType, modelName);
  if (!inputType) return '';

  // Determine the actual schema filename prefix for this op
  // Most ops match opType, but some reuse other inputs
  let fileOp = opType;
  if (opType === 'count') fileOp = 'count';

  return `import { ${inputType} } from "${schemasImportBase}/${fileOp}${modelName}.schema"; `;
};

export const getInputTypeByOpName = (opName: string, modelName: string) => {
  let inputType;
  switch (opName) {
    case 'findUnique':
      inputType = `${modelName}FindUniqueSchema`;
      break;
    case 'findFirst':
      inputType = `${modelName}FindFirstSchema`;
      break;
    case 'findMany':
      inputType = `${modelName}FindManySchema`;
      break;
    case 'findRaw':
      inputType = `${modelName}FindRawObjectSchema`;
      break;
    case 'createOne':
      inputType = `${modelName}CreateOneSchema`;
      break;
    case 'createMany':
      inputType = `${modelName}CreateManySchema`;
      break;
    case 'createManyAndReturn':
      inputType = `${modelName}CreateManyAndReturnSchema`;
      break;
    case 'deleteOne':
      inputType = `${modelName}DeleteOneSchema`;
      break;
    case 'updateOne':
      inputType = `${modelName}UpdateOneSchema`;
      break;
    case 'deleteMany':
      inputType = `${modelName}DeleteManySchema`;
      break;
    case 'updateMany':
      inputType = `${modelName}UpdateManySchema`;
      break;
    case 'updateManyAndReturn':
      inputType = `${modelName}UpdateManyAndReturnSchema`;
      break;
    case 'upsertOne':
      inputType = `${modelName}UpsertSchema`;
      break;
    case 'aggregate':
      inputType = `${modelName}AggregateSchema`;
      break;
    case 'aggregateRaw':
      inputType = `${modelName}AggregateRawObjectSchema`;
      break;
    case 'groupBy':
      inputType = `${modelName}GroupBySchema`;
      break;
    case 'count':
      // Use dedicated Count args schema
      inputType = `${modelName}CountSchema`;
      break;
    default:
    // Fallback for unknown operation types
  }
  return inputType;
};

export const getProcedureTypeByOpName = (opName: string) => {
  let procType;
  switch (opName) {
    case 'findUnique':
    case 'findFirst':
    case 'findMany':
    case 'findRaw':
    case 'aggregate':
    case 'aggregateRaw':
    case 'groupBy':
    case 'count':
      procType = 'query';
      break;
    case 'createOne':
    case 'createMany':
    case 'createManyAndReturn':
    case 'deleteOne':
    case 'updateOne':
    case 'deleteMany':
    case 'updateMany':
    case 'updateManyAndReturn':
    case 'upsertOne':
      procType = 'mutation';
      break;
    default:
    // Fallback for unknown operation types
  }
  return procType;
};

export function resolveModelsComments(
  models: DMMF.Model[],
  hiddenModels: string[],
) {
  const modelAttributeRegex = /(@@Gen\.)+([A-z])+(\()+(.+)+(\))+/;
  const attributeNameRegex = /(?:\.)+([A-Za-z])+(?:\()+/;
  const attributeArgsRegex = /(?:\()+([A-Za-z])+:+(.+)+(?:\))+/;

  for (const model of models) {
    if (model.documentation) {
      const attribute = model.documentation?.match(modelAttributeRegex)?.[0];
      const attributeName = attribute
        ?.match(attributeNameRegex)?.[0]
        ?.slice(1, -1);
      if (attributeName !== 'model') continue;
      const rawAttributeArgs = attribute
        ?.match(attributeArgsRegex)?.[0]
        ?.slice(1, -1);

      const parsedAttributeArgs: Record<string, unknown> = {};
      if (rawAttributeArgs) {
        const rawAttributeArgsParts = rawAttributeArgs
          .split(':')
          .map((it) => it.trim())
          .map((part) => (part.startsWith('[') ? part : part.split(',')))
          .flat()
          .map((it) => it.trim());

        for (let i = 0; i < rawAttributeArgsParts.length; i += 2) {
          const key = rawAttributeArgsParts[i];
          const value = rawAttributeArgsParts[i + 1];
          parsedAttributeArgs[key] = JSON.parse(value);
        }
      }
      if (parsedAttributeArgs.hide) {
        hiddenModels.push(model.name);
      }
    }
  }
}

export interface ModelGenConfig {
  tenantKey?: string;
  softDeleteKey?: string;
  hide?: boolean;
}

export function getModelsGenConfig(models: ReadonlyArray<DMMF.Model>): Record<string, ModelGenConfig> {
  const modelAttributeRegex = /(@@Gen\.)+([A-z])+(\()+(.+)+(\))+/;
  const attributeNameRegex = /(?:\.)+([A-Za-z])+(?:\()+/;
  const attributeArgsRegex = /(?:\()+([A-Za-z])+:+(.+)+(?:\))+/;
  const result: Record<string, ModelGenConfig> = {};
  for (const model of models) {
    const cfg: ModelGenConfig = {};
    if (model.documentation) {
      const attribute = model.documentation?.match(modelAttributeRegex)?.[0];
      const attributeName = attribute?.match(attributeNameRegex)?.[0]?.slice(1, -1);
      if (attributeName === 'model') {
        const rawAttributeArgs = attribute?.match(attributeArgsRegex)?.[0]?.slice(1, -1);
        const parsed: Record<string, unknown> = {};
        if (rawAttributeArgs) {
          const parts = rawAttributeArgs
            .split(':')
            .map((it) => it.trim())
            .map((part) => (part.startsWith('[') ? part : part.split(',')))
            .flat()
            .map((it) => it.trim());
          for (let i = 0; i < parts.length; i += 2) {
            const key = parts[i];
            const value = parts[i + 1];
            try {
              parsed[key] = JSON.parse(value);
            } catch {
              // ignore malformed
            }
          }
        }
        if (typeof parsed.hide === 'boolean' && parsed.hide) cfg.hide = true;
        if (typeof parsed.tenantKey === 'string') cfg.tenantKey = parsed.tenantKey;
        if (typeof parsed.softDelete === 'string') cfg.softDeleteKey = parsed.softDelete;
      }
    }
    result[model.name] = cfg;
  }
  return result;
}
