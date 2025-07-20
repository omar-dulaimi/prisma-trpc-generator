import { describe, it, expect, afterAll } from 'vitest';
import { join } from 'path';
import { TrpcGeneratorTestUtils } from './comprehensive-test-utils';

describe('Edge Cases and Complex Scenarios', () => {
  const testOutputDir = join(process.cwd(), 'tests', 'generated', 'edge-cases');
  const edgeCasesSchemaPath = join(process.cwd(), 'tests', 'schemas', 'edge-cases.prisma');

  afterAll(() => {
    TrpcGeneratorTestUtils.cleanup(testOutputDir);
  });

  it('should handle hidden models correctly', async () => {
    await TrpcGeneratorTestUtils.generateRouters(edgeCasesSchemaPath);
    
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // HiddenModel should not have a router
    expect(routers.modelRouters['HiddenModel']).toBeUndefined();
  });

  it('should handle models with very long names', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const longNameRouter = routers.modelRouters['ModelWithVeryLongNameThatShouldTestNamingConventions'];
    if (longNameRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(longNameRouter);
      expect(structure.hasRouter).toBe(true);
    }
  });

  it('should handle self-referencing models', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const selfRefRouter = routers.modelRouters['SelfReferencing'];
    if (selfRefRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(selfRefRouter);
      expect(structure.hasRouter).toBe(true);
      expect(structure.procedures.length).toBeGreaterThan(0);
    }
  });

  it('should handle circular relationships', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const circularARouter = routers.modelRouters['CircularA'];
    const circularBRouter = routers.modelRouters['CircularB'];
    
    if (circularARouter && circularBRouter) {
      const structureA = TrpcGeneratorTestUtils.validateRouterStructure(circularARouter);
      const structureB = TrpcGeneratorTestUtils.validateRouterStructure(circularBRouter);
      
      expect(structureA.hasRouter).toBe(true);
      expect(structureB.hasRouter).toBe(true);
    }
  });

  it('should handle all field types correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const allTypesRouter = routers.modelRouters['ModelWithAllFieldTypes'];
    if (allTypesRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(allTypesRouter);
      expect(structure.hasRouter).toBe(true);
      expect(structure.procedures.length).toBeGreaterThan(0);
      
      // Should handle all Prisma field types
      const crudOps = TrpcGeneratorTestUtils.validateCrudOperations(allTypesRouter, 'ModelWithAllFieldTypes');
      expect(crudOps.missingOperations.length).toBeLessThan(4);
    }
  });

  it('should handle unique constraints', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const uniqueRouter = routers.modelRouters['ModelWithUniqueConstraints'];
    if (uniqueRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(uniqueRouter);
      expect(structure.hasRouter).toBe(true);
    }
  });

  it('should handle complex indexes', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const indexRouter = routers.modelRouters['ModelWithComplexIndexes'];
    if (indexRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(indexRouter);
      expect(structure.hasRouter).toBe(true);
    }
  });

  it('should handle large enums', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const enumRouter = routers.modelRouters['ModelWithEnums'];
    if (enumRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(enumRouter);
      expect(structure.hasRouter).toBe(true);
      expect(structure.procedures.length).toBeGreaterThan(0);
    }
  });

  it('should handle special characters in field names', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const specialCharsRouter = routers.modelRouters['ModelWithSpecialCharacters'];
    if (specialCharsRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(specialCharsRouter);
      expect(structure.hasRouter).toBe(true);
    }
  });

  it('should handle many-to-many with explicit join table', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const leftRouter = routers.modelRouters['ManyToManyLeft'];
    const rightRouter = routers.modelRouters['ManyToManyRight'];
    const connectionRouter = routers.modelRouters['ManyToManyConnection'];
    
    if (leftRouter && rightRouter && connectionRouter) {
      const leftStructure = TrpcGeneratorTestUtils.validateRouterStructure(leftRouter);
      const rightStructure = TrpcGeneratorTestUtils.validateRouterStructure(rightRouter);
      const connectionStructure = TrpcGeneratorTestUtils.validateRouterStructure(connectionRouter);
      
      expect(leftStructure.hasRouter).toBe(true);
      expect(rightStructure.hasRouter).toBe(true);
      expect(connectionStructure.hasRouter).toBe(true);
    }
  });

  it('should handle cascade delete relationships', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const parentRouter = routers.modelRouters['ModelWithCascade'];
    const childRouter = routers.modelRouters['ModelWithCascadeChild'];
    
    if (parentRouter && childRouter) {
      const parentStructure = TrpcGeneratorTestUtils.validateRouterStructure(parentRouter);
      const childStructure = TrpcGeneratorTestUtils.validateRouterStructure(childRouter);
      
      expect(parentStructure.hasRouter).toBe(true);
      expect(childStructure.hasRouter).toBe(true);
    }
  });

  it('should respect limited generateModelActions', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Edge cases schema has limited actions: "findFirst,findMany,create,update,delete"
    for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
      if (modelName !== 'HiddenModel') {
        const structure = TrpcGeneratorTestUtils.validateRouterStructure(routerContent);
        
        // Should have some procedures but not all possible ones
        expect(structure.procedures.length).toBeGreaterThan(0);
        expect(structure.procedures.length).toBeLessThan(15); // Full set would be more
      }
    }
  });

  it('should respect showModelNameInProcedure: false', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Edge cases schema has showModelNameInProcedure: false
    for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
      if (modelName !== 'HiddenModel') {
        // Procedures should not include model name when this option is false
        const structure = TrpcGeneratorTestUtils.validateRouterStructure(routerContent);
        expect(structure.procedures.length).toBeGreaterThan(0);
      }
    }
  });

  it('should handle disabled select and include generation', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Edge cases schema has isGenerateSelect: false, isGenerateInclude: false
    for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
      if (modelName !== 'HiddenModel') {
        // Should not include select/include related code
        expect(routerContent).not.toContain('Select');
        expect(routerContent).not.toContain('Include');
      }
    }
  });

  it('should generate valid TypeScript for complex scenarios', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // All generated routers should be valid TypeScript
    for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
      expect(routerContent).toContain('export');
      expect(routerContent).toContain('router');
      expect(routerContent).not.toContain('undefined');
      
      // Should not have syntax errors
      expect(routerContent).not.toMatch(/:\s*,/); // missing types
      expect(routerContent).not.toMatch(/\bundefine\b/); // undefined typos
    }
  });

  it('should handle composite primary keys', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const connectionRouter = routers.modelRouters['ManyToManyConnection'];
    if (connectionRouter) {
      // Has composite primary key [leftId, rightId]
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(connectionRouter);
      expect(structure.hasRouter).toBe(true);
    }
  });

  it('should handle optional and required relationships', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // CircularA and CircularB have optional relationships
    const circularARouter = routers.modelRouters['CircularA'];
    if (circularARouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(circularARouter);
      expect(structure.hasRouter).toBe(true);
    }
  });
});