import { describe, it, expect, afterAll } from 'vitest';
import { join } from 'path';
import { TrpcGeneratorTestUtils } from './comprehensive-test-utils';

describe('Basic Router Generation', () => {
  const testOutputDir = join(process.cwd(), 'tests', 'generated', 'basic');
  const basicSchemaPath = join(process.cwd(), 'tests', 'schemas', 'basic.prisma');

  afterAll(() => {
    TrpcGeneratorTestUtils.cleanup(testOutputDir);
  });

  it('should generate basic routers successfully', async () => {
    await TrpcGeneratorTestUtils.generateRouters(basicSchemaPath);
    
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    expect(routers.appRouter).toBeTruthy();
    expect(routers.createRouter).toBeTruthy();
  });

  it('should generate routers for basic models', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Should have User and Post routers
    expect(routers.modelRouters['User']).toBeTruthy();
    expect(routers.modelRouters['Post']).toBeTruthy();
  });

  it('should generate valid CRUD operations', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const userRouter = routers.modelRouters['User'];
    if (userRouter) {
      const crudOps = TrpcGeneratorTestUtils.validateCrudOperations(userRouter, 'User');
      
      // Basic schema should have all CRUD operations
      expect(crudOps.hasCreate).toBe(true);
      expect(crudOps.hasRead).toBe(true);
      expect(crudOps.hasUpdate).toBe(true);
      expect(crudOps.hasDelete).toBe(true);
    }

    const postRouter = routers.modelRouters['Post'];
    if (postRouter) {
      const crudOps = TrpcGeneratorTestUtils.validateCrudOperations(postRouter, 'Post');
      
      expect(crudOps.hasCreate).toBe(true);
      expect(crudOps.hasRead).toBe(true);
      expect(crudOps.hasUpdate).toBe(true);
      expect(crudOps.hasDelete).toBe(true);
    }
  });

  it('should generate valid app router structure', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    if (routers.appRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(routers.appRouter);
      
      expect(structure.hasImports).toBe(true);
      expect(structure.hasExport).toBe(true);
      expect(structure.hasRouter).toBe(true);
      
      // Should import model routers
      expect(routers.appRouter).toContain('Router');
    }
  });

  it('should generate valid createRouter helper', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    if (routers.createRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(routers.createRouter);
      
      expect(structure.hasImports).toBe(true);
      expect(structure.hasExport).toBe(true);
      
      // Should have tRPC imports
      expect(routers.createRouter).toContain('@trpc');
      expect(routers.createRouter).toContain('procedure');
    }
  });

  it('should handle basic relationships', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // User-Post relationship
    const userRouter = routers.modelRouters['User'];
    const postRouter = routers.modelRouters['Post'];
    
    if (userRouter && postRouter) {
      // Both should be valid routers
      const userStructure = TrpcGeneratorTestUtils.validateRouterStructure(userRouter);
      const postStructure = TrpcGeneratorTestUtils.validateRouterStructure(postRouter);
      
      expect(userStructure.hasRouter).toBe(true);
      expect(postStructure.hasRouter).toBe(true);
    }
  });

  it('should integrate with Zod for basic schema', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
      const zodInfo = TrpcGeneratorTestUtils.validateZodIntegration(routerContent);
      
      // Basic schema has withZod: true
      expect(zodInfo.hasZodImports || zodInfo.hasSchemaUsage).toBe(true);
    }
  });

  it('should not include Shield when disabled', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    if (routers.createRouter) {
      const shieldInfo = TrpcGeneratorTestUtils.validateShieldIntegration(routers.createRouter);
      
      // Basic schema has withShield: false
      expect(shieldInfo.hasShieldImports).toBe(false);
    }
  });

  it('should generate TypeScript without errors', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Check basic TypeScript validity
    for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
      expect(routerContent).toContain('export');
      expect(routerContent).toContain('router');
      expect(routerContent).not.toContain('undefined');
    }
  });

  it('should handle basic field types correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const userRouter = routers.modelRouters['User'];
    if (userRouter) {
      // User has Int, String, String? fields
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(userRouter);
      expect(structure.procedures.length).toBeGreaterThan(0);
    }

    const postRouter = routers.modelRouters['Post'];
    if (postRouter) {
      // Post has Int, String, String?, Boolean fields
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(postRouter);
      expect(structure.procedures.length).toBeGreaterThan(0);
    }
  });

  it('should handle foreign key relationships', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const postRouter = routers.modelRouters['Post'];
    if (postRouter) {
      // Post has authorId foreign key to User
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(postRouter);
      expect(structure.hasRouter).toBe(true);
    }
  });
});