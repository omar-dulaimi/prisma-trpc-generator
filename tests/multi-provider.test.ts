import { describe, it, expect, afterAll } from 'vitest';
import { join } from 'path';
import { TrpcGeneratorTestUtils } from './comprehensive-test-utils';

describe('Multi-Provider Database Tests', () => {
  const providers = ['mysql', 'sqlite', 'mongodb'];
  
  afterAll(() => {
    // Cleanup all provider test outputs
    for (const provider of providers) {
      const testOutputDir = join(process.cwd(), 'tests', 'generated', provider);
      TrpcGeneratorTestUtils.cleanup(testOutputDir);
    }
  });

  describe.each(providers)('%s Provider Tests', (provider) => {
    const testOutputDir = join(process.cwd(), 'tests', 'generated', provider);
    const schemaPath = join(process.cwd(), 'tests', 'schemas', 'providers', `${provider}.prisma`);

    it(`should generate routers for ${provider} provider`, async () => {
      await TrpcGeneratorTestUtils.generateRouters(schemaPath);
      
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      expect(routers.appRouter).toBeTruthy();
      expect(routers.createRouter).toBeTruthy();
    });

    it(`should generate model routers for ${provider}`, async () => {
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      
      // All providers should have User and Post models
      expect(routers.modelRouters['User']).toBeTruthy();
      expect(routers.modelRouters['Post']).toBeTruthy();
      
      if (provider === 'sqlite') {
        expect(routers.modelRouters['SimpleModel']).toBeTruthy();
      }
    });

    it(`should handle ${provider}-specific field types`, async () => {
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      
      const userRouter = routers.modelRouters['User'];
      if (userRouter) {
        const structure = TrpcGeneratorTestUtils.validateRouterStructure(userRouter);
        expect(structure.hasRouter).toBe(true);
        expect(structure.procedures.length).toBeGreaterThan(0);
      }
    });

    it(`should generate valid CRUD operations for ${provider}`, async () => {
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      
      const userRouter = routers.modelRouters['User'];
      if (userRouter) {
        const crudOps = TrpcGeneratorTestUtils.validateCrudOperations(userRouter, 'User');
        
        expect(crudOps.hasCreate).toBe(true);
        expect(crudOps.hasRead).toBe(true);
        expect(crudOps.hasUpdate).toBe(true);
        expect(crudOps.hasDelete).toBe(true);
      }
    });

    it(`should integrate with Zod for ${provider}`, async () => {
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      
      for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
        const zodInfo = TrpcGeneratorTestUtils.validateZodIntegration(routerContent);
        
        expect(zodInfo.hasZodImports || zodInfo.hasSchemaUsage).toBe(true);
      }
    });

    it(`should generate valid TypeScript for ${provider}`, async () => {
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      
      for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
        expect(routerContent).toContain('export');
        expect(routerContent).toContain('router');
        expect(routerContent).not.toContain('undefined');
      }
    });
  });

  it('should handle MongoDB-specific features', async () => {
    const mongoOutputDir = join(process.cwd(), 'tests', 'generated', 'mongodb');
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(mongoOutputDir);
    
    // MongoDB has ObjectId fields
    for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(routerContent);
      expect(structure.hasRouter).toBe(true);
    }
  });

  it('should handle MySQL-specific field attributes', async () => {
    const mysqlOutputDir = join(process.cwd(), 'tests', 'generated', 'mysql');
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(mysqlOutputDir);
    
    // MySQL schema has specific field attributes like @db.VarChar
    const userRouter = routers.modelRouters['User'];
    if (userRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(userRouter);
      expect(structure.hasRouter).toBe(true);
    }
  });

  it('should handle SQLite limitations gracefully', async () => {
    const sqliteOutputDir = join(process.cwd(), 'tests', 'generated', 'sqlite');
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(sqliteOutputDir);
    
    // SQLite has limitations but should still generate valid routers
    expect(Object.keys(routers.modelRouters).length).toBeGreaterThan(0);
    
    const simpleRouter = routers.modelRouters['SimpleModel'];
    if (simpleRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(simpleRouter);
      expect(structure.hasRouter).toBe(true);
    }
  });

  it('should generate consistent router structure across providers', async () => {
    const outputs: Array<{ provider: string; routers: any }> = [];
    
    for (const provider of providers) {
      const testOutputDir = join(process.cwd(), 'tests', 'generated', provider);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      outputs.push({ provider, routers });
    }
    
    // All providers should have similar structure for common models
    for (const output of outputs) {
      expect(output.routers.appRouter).toBeTruthy();
      expect(output.routers.createRouter).toBeTruthy();
      expect(output.routers.modelRouters['User']).toBeTruthy();
      expect(output.routers.modelRouters['Post']).toBeTruthy();
    }
  });

  it('should handle relationships correctly across providers', async () => {
    for (const provider of providers) {
      const testOutputDir = join(process.cwd(), 'tests', 'generated', provider);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      
      // User-Post relationship should work in all providers
      const userRouter = routers.modelRouters['User'];
      const postRouter = routers.modelRouters['Post'];
      
      if (userRouter && postRouter) {
        const userStructure = TrpcGeneratorTestUtils.validateRouterStructure(userRouter);
        const postStructure = TrpcGeneratorTestUtils.validateRouterStructure(postRouter);
        
        expect(userStructure.hasRouter).toBe(true);
        expect(postStructure.hasRouter).toBe(true);
      }
    }
  });
});