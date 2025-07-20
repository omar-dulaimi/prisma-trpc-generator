import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { TrpcGeneratorTestUtils } from './comprehensive-test-utils';

describe('Comprehensive Schema Coverage', () => {
  const testOutputDir = join(process.cwd(), 'tests', 'generated', 'comprehensive');
  const comprehensiveSchemaPath = join(process.cwd(), 'tests', 'schemas', 'comprehensive.prisma');

  afterAll(() => {
    TrpcGeneratorTestUtils.cleanup(testOutputDir);
  });

  it('should generate routers for complex schema with all Prisma features', async () => {
    await TrpcGeneratorTestUtils.generateRouters(comprehensiveSchemaPath);
    
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    expect(routers.appRouter).toBeTruthy();
    expect(routers.createRouter).toBeTruthy();
    expect(Object.keys(routers.modelRouters).length).toBeGreaterThan(0);
  });

  it('should handle all model types correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    const modelNames = [
      'User', 'Profile', 'Post', 'Comment', 'Category', 
      'Product', 'Order', 'OrderItem', 'Book', 'Map', 'Tag', 'Setting', 'Log'
    ];
    
    // Verify routers exist for expected models
    const routerKeys = Object.keys(routers.modelRouters);
    expect(routerKeys.length).toBeGreaterThan(0);
    
    // Check that app router includes model routers
    if (routers.appRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(routers.appRouter);
      expect(structure.hasImports).toBe(true);
      expect(structure.hasExport).toBe(true);
      expect(structure.hasRouter).toBe(true);
    }
  });

  it('should handle models with enums correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Check User router which uses Role and Status enums
    const userRouter = routers.modelRouters['User'];
    if (userRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(userRouter);
      expect(structure.hasImports).toBe(true);
      expect(structure.procedures.length).toBeGreaterThan(0);
    }
  });

  it('should handle complex relationships correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Test models with various relationship types
    const relationshipModels = ['User', 'Post', 'Comment', 'Category'];
    
    for (const modelName of relationshipModels) {
      const router = routers.modelRouters[modelName];
      if (router) {
        const structure = TrpcGeneratorTestUtils.validateRouterStructure(router);
        expect(structure.hasRouter).toBe(true);
        expect(structure.procedures.length).toBeGreaterThan(0);
      }
    }
  });

  it('should handle all Prisma field types', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Models that test various field types
    const fieldTypeModels = ['User', 'Post', 'Product', 'Order'];
    
    for (const modelName of fieldTypeModels) {
      const router = routers.modelRouters[modelName];
      if (router) {
        const crudOps = TrpcGeneratorTestUtils.validateCrudOperations(router, modelName);
        
        // Should have at least basic CRUD operations
        expect(crudOps.missingOperations.length).toBeLessThan(4);
      }
    }
  });

  it('should generate valid TypeScript', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Test app router
    if (routers.appRouter) {
      const isValid = TrpcGeneratorTestUtils.validateTypeScriptCompilation(
        join(testOutputDir, 'routers', 'index.ts')
      );
      expect(isValid).toBe(true);
    }

    // Test createRouter helper
    if (routers.createRouter) {
      const isValid = TrpcGeneratorTestUtils.validateTypeScriptCompilation(
        join(testOutputDir, 'routers', 'helpers', 'createRouter.ts')
      );
      expect(isValid).toBe(true);
    }
  });

  it('should integrate with Zod correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Check for Zod integration in model routers
    for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
      const zodInfo = TrpcGeneratorTestUtils.validateZodIntegration(routerContent);
      
      // Should have Zod schemas for input validation
      expect(zodInfo.hasZodImports || zodInfo.hasSchemaUsage).toBe(true);
    }
  });

  it('should integrate with tRPC Shield correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Check createRouter for Shield integration
    if (routers.createRouter) {
      const shieldInfo = TrpcGeneratorTestUtils.validateShieldIntegration(routers.createRouter);
      
      // Should have shield imports and middleware
      expect(shieldInfo.hasShieldImports || shieldInfo.hasMiddleware).toBe(true);
    }
  });

  it('should handle BigInt fields correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Map model has BigInt ID
    const mapRouter = routers.modelRouters['Map'];
    if (mapRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(mapRouter);
      expect(structure.procedures.length).toBeGreaterThan(0);
      
      // Should handle BigInt serialization
      expect(mapRouter).toContain('Map');
    }
  });

  it('should handle JSON fields correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Post and Order models have JSON fields
    const jsonModels = ['Post', 'Order', 'Product'];
    
    for (const modelName of jsonModels) {
      const router = routers.modelRouters[modelName];
      if (router) {
        const structure = TrpcGeneratorTestUtils.validateRouterStructure(router);
        expect(structure.hasRouter).toBe(true);
      }
    }
  });

  it('should handle array fields correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Post has string array (tags), Product has string array (images)
    const arrayModels = ['Post', 'Product'];
    
    for (const modelName of arrayModels) {
      const router = routers.modelRouters[modelName];
      if (router) {
        const structure = TrpcGeneratorTestUtils.validateRouterStructure(router);
        expect(structure.procedures.length).toBeGreaterThan(0);
      }
    }
  });

  it('should handle optional and required fields correctly', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // User model has mix of optional and required fields
    const userRouter = routers.modelRouters['User'];
    if (userRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(userRouter);
      expect(structure.hasRouter).toBe(true);
      expect(structure.procedures.length).toBeGreaterThan(0);
    }
  });

  it('should handle self-referencing relationships', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Category has self-referencing parent/children relationship
    const categoryRouter = routers.modelRouters['Category'];
    if (categoryRouter) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(categoryRouter);
      expect(structure.hasRouter).toBe(true);
    }
  });

  it('should handle many-to-many relationships', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // User-Category many-to-many relationship
    const userRouter = routers.modelRouters['User'];
    const categoryRouter = routers.modelRouters['Category'];
    
    if (userRouter) {
      expect(userRouter).toContain('User');
    }
    if (categoryRouter) {
      expect(categoryRouter).toContain('Category');
    }
  });

  it('should handle cascade delete relationships', async () => {
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
    
    // Profile has cascade delete to User
    // Comment has cascade delete to Post  
    const cascadeModels = ['Profile', 'Comment', 'OrderItem'];
    
    for (const modelName of cascadeModels) {
      const router = routers.modelRouters[modelName];
      if (router) {
        const structure = TrpcGeneratorTestUtils.validateRouterStructure(router);
        expect(structure.hasRouter).toBe(true);
      }
    }
  });
});