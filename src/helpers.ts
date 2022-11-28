import { DMMF } from '@prisma/generator-helper';
import { SourceFile } from 'ts-morph';
import { Config } from './config';
import { uncapitalizeFirstLetter } from './utils/uncapitalizeFirstLetter';

export const generateCreateRouterImport = (
  sourceFile: SourceFile,
  isProtectedMiddleware: boolean,
) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: './helpers/createRouter',
    namedImports: [
      isProtectedMiddleware ? 'createProtectedRouter' : 'createRouter',
    ],
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
  shieldOutputPath: string,
) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: `${shieldOutputPath}/shield`,
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

export function generateBaseRouter(sourceFile: SourceFile, config: Config) {
  sourceFile.addStatements(/* ts */ `
  import { Context } from '${config.contextPath}';
    
  export function createRouter() {
    return trpc.router<Context>();
  }`);

  const middlewares = [];
  if (config.withMiddleware) {
    middlewares.push(/* ts */ `
    .middleware(({ ctx, next }) => {
      console.log("inside middleware!")
      return next();
    })`);
  }

  if (config.withShield) {
    middlewares.push(/* ts */ `
    .middleware(permissions)`);
  }

  sourceFile.addStatements(/* ts */ `
    export function createProtectedRouter() {
      return trpc
        .router<Context>()
        ${middlewares.join('\r')};
    }`);
}

export function generateProcedure(
  sourceFile: SourceFile,
  name: string,
  typeName: string,
  modelName: string,
  opType: string,
  baseOpType: string,
) {
  sourceFile.addStatements(/* ts */ `
  .${getProcedureTypeByOpName(baseOpType)}("${name}", {
    input: ${typeName},
    async resolve({ ctx, input }) {
      const ${name} = await ctx.prisma.${uncapitalizeFirstLetter(
    modelName,
  )}.${opType.replace('One', '')}(input);
      return ${name};
    },
  })`);
}

export function generateRouterSchemaImports(
  sourceFile: SourceFile,
  name: string,
  hasCreateMany: boolean,
  provider: string,
) {
  let statements = [
    `import { ${name}FindUniqueSchema } from "../schemas/findUnique${name}.schema";`,
    `import { ${name}FindFirstSchema } from "../schemas/findFirst${name}.schema";`,
    `import { ${name}FindManySchema } from "../schemas/findMany${name}.schema";`,
    `import { ${name}CreateOneSchema } from "../schemas/createOne${name}.schema";`,
  ];

  if (hasCreateMany) {
    statements.push(
      `import { ${name}CreateManySchema } from "../schemas/createMany${name}.schema";`,
    );
  }

  statements = statements.concat([
    `import { ${name}DeleteOneSchema } from "../schemas/deleteOne${name}.schema";`,
    `import { ${name}UpdateOneSchema } from "../schemas/updateOne${name}.schema";`,
    `import { ${name}DeleteManySchema } from "../schemas/deleteMany${name}.schema";`,
    `import { ${name}UpdateManySchema } from "../schemas/updateMany${name}.schema";`,
    `import { ${name}UpsertSchema } from "../schemas/upsertOne${name}.schema";`,
    `import { ${name}AggregateSchema } from "../schemas/aggregate${name}.schema";`,
    `import { ${name}GroupBySchema } from "../schemas/groupBy${name}.schema";`,
  ]);

  if (provider === 'mongodb') {
    statements = statements.concat([
      `import { ${name}FindRawObjectSchema } from "../schemas/objects/${name}FindRaw.schema";`,
      `import { ${name}AggregateRawObjectSchema } from "../schemas/objects/${name}AggregateRaw.schema";`,
    ]);
  }

  sourceFile.addStatements(/* ts */ statements.join('\n'));
}

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
    default:
      console.log('getInputTypeByOpName: ', { opName, modelName });
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
      procType = 'query';
      break;
    case 'createOne':
    case 'createMany':
    case 'deleteOne':
    case 'updateOne':
    case 'deleteMany':
    case 'updateMany':
    case 'upsertOne':
      procType = 'mutation';
      break;
    default:
      console.log('getProcedureTypeByOpName: ', { opName });
  }
  return procType;
};

export function resolveModelsComments(
  models: DMMF.Model[],
  hiddenModels: string[],
) {
  const modelAttributeRegex = /(@@Gen\.)+([A-z])+(\()+(.+)+(\))+/;
  const attributeNameRegex = /(?:\.)+([A-Za-z])+(?:\()+/;
  const attributeArgsRegex = /(?:\()+([A-Za-z])+\:+(.+)+(?:\))+/;

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
