import { SourceFile } from 'ts-morph';

export const generateCreateRouterImport = (sourceFile: SourceFile) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: './helpers/createRouter',
    namedImports: ['createRouter'],
  });
};

export const generatetRPCImport = (sourceFile: SourceFile) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: '@trpc/server',
    namespaceImport: 'trpc',
  });
};

export const generateRouterImport = (
  sourceFile: SourceFile,
  modelNamePlural: String,
  modelNameCamelCase: String,
) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: `./${modelNameCamelCase}.router`,
    namedImports: [`${modelNamePlural}Router`],
  });
};

export function generateBaseRouter(sourceFile: SourceFile) {
  sourceFile.addStatements(/* ts */ `
  export type Context = trpc.inferAsyncReturnType<typeof createContext>;
    
  export function createRouter() {
    return trpc.router<Context>();
  }`);
}

export function generateProcedure(
  sourceFile: SourceFile,
  name: String,
  typeName: String,
  modelName: String,
  opType: String,
) {
  sourceFile.addStatements(/* ts */ `
  .mutation("${name}", {
    input: ${typeName},
    async resolve({ ctx, input }) {
      const ${name} = await ctx.prisma.${modelName.toLowerCase()}.${opType}(input);
      return ${name};
    },
  })`);
}

export function generateRouterSchemaImports(
  sourceFile: SourceFile,
  name: String,
) {
  sourceFile.addStatements(/* ts */ `
  import { ${name}FindUniqueSchema } from "../schemas/findUnique${name}.schema";
  import { ${name}FindFirstSchema } from "../schemas/findFirst${name}.schema";
  import { ${name}FindManySchema } from "../schemas/findMany${name}.schema";
  import { ${name}CreateSchema } from "../schemas/createOne${name}.schema";
  import { ${name}DeleteOneSchema } from "../schemas/deleteOne${name}.schema";
  import { ${name}UpdateOneSchema } from "../schemas/updateOne${name}.schema";
  import { ${name}DeleteManySchema } from "../schemas/deleteMany${name}.schema";
  import { ${name}UpdateManySchema } from "../schemas/updateMany${name}.schema";
  import { ${name}UpsertSchema } from "../schemas/upsertOne${name}.schema";
  import { ${name}AggregateSchema } from "../schemas/aggregate${name}.schema";
  import { ${name}GroupBySchema } from "../schemas/groupBy${name}.schema";
  `);
}

export const getInputTypeByOpName = (opName: String, modelName: String) => {
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
    case 'create':
    case 'createMany':
      inputType = `${modelName}CreateSchema`;
      break;
    case 'delete':
      inputType = `${modelName}DeleteOneSchema`;
      break;
    case 'update':
      inputType = `${modelName}UpdateOneSchema`;
      break;
    case 'deleteMany':
      inputType = `${modelName}DeleteManySchema`;
      break;
    case 'updateMany':
      inputType = `${modelName}UpdateManySchema`;
      break;
    case 'upsert':
      inputType = `${modelName}UpsertSchema`;
      break;
    case 'aggregate':
      inputType = `${modelName}AggregateSchema`;
      break;
    case 'groupBy':
      inputType = `${modelName}GroupBySchema`;
      break;
    default:
      console.log({ opName, modelName });
  }
  return inputType;
};
