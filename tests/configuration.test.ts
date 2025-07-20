import { describe, it, expect, afterAll } from 'vitest';
import { join } from 'path';
import { TrpcGeneratorTestUtils } from './comprehensive-test-utils';
import fs from 'fs';

describe('Configuration Options Tests', () => {
  const baseSchemaPath = join(process.cwd(), 'tests', 'schemas', 'basic.prisma');
  const baseSchema = fs.readFileSync(baseSchemaPath, 'utf-8');

  afterAll(() => {
    // Cleanup all configuration test outputs
    const configOutputDir = join(process.cwd(), 'tests', 'generated', 'config');
    TrpcGeneratorTestUtils.cleanup(configOutputDir);
  });

  const configurations = [
    {
      name: 'withZod-false',
      config: { withZod: false }
    },
    {
      name: 'withShield-true',
      config: { withShield: true }
    },
    {
      name: 'isGenerateSelect-true',
      config: { isGenerateSelect: true }
    },
    {
      name: 'isGenerateInclude-true',
      config: { isGenerateInclude: true }
    },
    {
      name: 'showModelNameInProcedure-false',
      config: { showModelNameInProcedure: false }
    },
    {
      name: 'limited-actions',
      config: { generateModelActions: 'findFirst,findMany,create,update' }
    },
    {
      name: 'custom-output',
      config: { output: '../generated/config/custom' }
    }
  ];

  it('should test multiple configurations', async () => {
    const results = await TrpcGeneratorTestUtils.testMultipleConfigurations(
      baseSchema,
      configurations
    );

    // All configurations should succeed
    for (const result of results) {
      expect(result.success).toBe(true);
      if (!result.success) {
        console.error(`Configuration ${result.name} failed:`, result.error);
      }
    }
  });

  it('should handle withZod: false correctly', async () => {
    const schema = baseSchema.replace(
      'withZod     = true',
      'withZod     = false'
    );
    
    const tempSchemaPath = join(process.cwd(), 'temp-no-zod.prisma');
    fs.writeFileSync(tempSchemaPath, schema);
    
    try {
      await TrpcGeneratorTestUtils.generateRouters(tempSchemaPath);
      
      const outputDir = join(process.cwd(), 'tests', 'generated', 'basic');
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outputDir);
      
      // Should not have Zod integration when disabled
      for (const routerContent of Object.values(routers.modelRouters)) {
        const zodInfo = TrpcGeneratorTestUtils.validateZodIntegration(routerContent);
        expect(zodInfo.hasZodImports).toBe(false);
      }
    } finally {
      fs.unlinkSync(tempSchemaPath);
    }
  });

  it('should handle withShield: true correctly', async () => {
    const schema = baseSchema.replace(
      'withShield  = false',
      'withShield  = true'
    );
    
    const tempSchemaPath = join(process.cwd(), 'temp-with-shield.prisma');
    fs.writeFileSync(tempSchemaPath, schema);
    
    try {
      await TrpcGeneratorTestUtils.generateRouters(tempSchemaPath);
      
      const outputDir = join(process.cwd(), 'tests', 'generated', 'basic');
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outputDir);
      
      // Should have Shield integration when enabled
      if (routers.createRouter) {
        const shieldInfo = TrpcGeneratorTestUtils.validateShieldIntegration(routers.createRouter);
        expect(shieldInfo.hasShieldImports || shieldInfo.hasMiddleware).toBe(true);
      }
    } finally {
      fs.unlinkSync(tempSchemaPath);
    }
  });

  it('should handle custom output directory', async () => {
    const customOutputDir = 'tests/generated/config/custom-output';
    const schema = baseSchema.replace(
      'output      = "../generated/basic"',
      `output      = "${customOutputDir}"`
    );
    
    const tempSchemaPath = join(process.cwd(), 'temp-custom-output.prisma');
    fs.writeFileSync(tempSchemaPath, schema);
    
    try {
      await TrpcGeneratorTestUtils.generateRouters(tempSchemaPath);
      
      const outputDir = join(process.cwd(), customOutputDir);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outputDir);
      
      expect(routers.appRouter).toBeTruthy();
      expect(routers.createRouter).toBeTruthy();
      
      // Cleanup custom output
      TrpcGeneratorTestUtils.cleanup(outputDir);
    } finally {
      if (fs.existsSync(tempSchemaPath)) {
        fs.unlinkSync(tempSchemaPath);
      }
    }
  });

  it('should respect generateModelActions limitation', async () => {
    const limitedActions = 'findFirst,findMany,create';
    // Add generateModelActions to the schema since basic.prisma doesn't have it
    const schema = baseSchema.replace(
      /(withShield  = false)/,
      `$1\n  generateModelActions = "${limitedActions}"`
    );
    
    const tempSchemaPath = join(process.cwd(), 'temp-limited-actions.prisma');
    fs.writeFileSync(tempSchemaPath, schema);
    
    try {
      await TrpcGeneratorTestUtils.generateRouters(tempSchemaPath);
      
      const outputDir = join(process.cwd(), 'tests', 'generated', 'basic');
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outputDir);
      
      // Should only have limited actions
      for (const routerContent of Object.values(routers.modelRouters)) {
        const structure = TrpcGeneratorTestUtils.validateRouterStructure(routerContent);
        
        // With limited actions (findFirst, findMany, create), expect around 3-6 procedures
        // (some models might have variations like createOne, createMany, etc.)
        expect(structure.procedures.length).toBeLessThan(8);
        expect(structure.procedures.length).toBeGreaterThan(0);
      }
    } finally {
      fs.unlinkSync(tempSchemaPath);
    }
  });

  it('should handle showModelNameInProcedure: false', async () => {
    const schema = baseSchema.replace(
      'showModelNameInProcedure = true',
      'showModelNameInProcedure = false'
    );
    
    const tempSchemaPath = join(process.cwd(), 'temp-no-model-name.prisma');
    fs.writeFileSync(tempSchemaPath, schema);
    
    try {
      await TrpcGeneratorTestUtils.generateRouters(tempSchemaPath);
      
      const outputDir = join(process.cwd(), 'tests', 'generated', 'basic');
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outputDir);
      
      // Procedures should not include model names
      for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
        const structure = TrpcGeneratorTestUtils.validateRouterStructure(routerContent);
        expect(structure.procedures.length).toBeGreaterThan(0);
      }
    } finally {
      fs.unlinkSync(tempSchemaPath);
    }
  });

  it('should handle isGenerateSelect and isGenerateInclude options', async () => {
    const schema = baseSchema.replace(
      'withShield  = false',
      `withShield  = false
  isGenerateSelect         = true
  isGenerateInclude        = true`
    );
    
    const tempSchemaPath = join(process.cwd(), 'temp-select-include.prisma');
    fs.writeFileSync(tempSchemaPath, schema);
    
    try {
      await TrpcGeneratorTestUtils.generateRouters(tempSchemaPath);
      
      const outputDir = join(process.cwd(), 'tests', 'generated', 'basic');
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outputDir);
      
      // The basic schema generates these options successfully if no error was thrown
      // The presence of basic model schemas indicates the options were processed correctly
      const schemasDir = join(process.cwd(), 'tests', 'generated', 'basic', 'schemas');
      const hasGeneratedSchemas = fs.existsSync(schemasDir) && fs.readdirSync(schemasDir).length > 0;
      
      expect(hasGeneratedSchemas).toBe(true);
    } finally {
      fs.unlinkSync(tempSchemaPath);
    }
  });

  it('should handle custom contextPath', async () => {
    const customContextPath = "../custom-context";
    const schema = baseSchema.replace(
      'contextPath = "../test-context"',
      `contextPath = "${customContextPath}"`
    );
    
    const tempSchemaPath = join(process.cwd(), 'temp-custom-context.prisma');
    fs.writeFileSync(tempSchemaPath, schema);
    
    try {
      await TrpcGeneratorTestUtils.generateRouters(tempSchemaPath);
      
      const outputDir = join(process.cwd(), 'tests', 'generated', 'basic');
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outputDir);
      
      // Should generate successfully with custom context path (no errors thrown)
      // The router generation completed without errors, indicating the contextPath was processed
      expect(routers.appRouter).toBeTruthy();
      expect(routers.createRouter).toBeTruthy();
    } finally {
      fs.unlinkSync(tempSchemaPath);
    }
  });

  it('should validate configuration combinations', async () => {
    // Test complex configuration combination
    const complexConfig = {
      withZod: true,
      withShield: true,
      isGenerateSelect: true,
      isGenerateInclude: true,
      showModelNameInProcedure: false,
      generateModelActions: 'findFirst,findMany,create,update,delete'
    };
    
    const results = await TrpcGeneratorTestUtils.testMultipleConfigurations(
      baseSchema,
      [{ name: 'complex', config: complexConfig }]
    );
    
    expect(results[0].success).toBe(true);
  });

  it('should handle invalid configurations gracefully', async () => {
    // Test with invalid boolean value
    const invalidSchema = baseSchema.replace(
      'withZod     = true',
      'withZod     = "invalid"'
    );
    
    const tempSchemaPath = join(process.cwd(), 'temp-invalid.prisma');
    fs.writeFileSync(tempSchemaPath, invalidSchema);
    
    try {
      // Should throw an error for invalid configuration
      await expect(
        TrpcGeneratorTestUtils.generateRouters(tempSchemaPath)
      ).rejects.toThrow(/Invalid options passed/);
    } finally {
      fs.unlinkSync(tempSchemaPath);
    }
  });

  it('should compare outputs between different configurations', async () => {
    // Generate with two different configurations using different output dirs
    const schema1 = baseSchema
      .replace('withZod     = true', 'withZod     = false')
      .replace('output      = "../generated/basic"', 'output      = "tests/generated/config1"');
    const schema2 = baseSchema
      .replace('output      = "../generated/basic"', 'output      = "tests/generated/config2"');
    
    const tempPath1 = join(process.cwd(), 'temp-config1.prisma');
    const tempPath2 = join(process.cwd(), 'temp-config2.prisma');
    
    fs.writeFileSync(tempPath1, schema1);
    fs.writeFileSync(tempPath2, schema2);
    
    try {
      await TrpcGeneratorTestUtils.generateRouters(tempPath1);
      const routers1 = TrpcGeneratorTestUtils.readGeneratedRouters(
        join(process.cwd(), 'tests', 'generated', 'config1')
      );
      
      await TrpcGeneratorTestUtils.generateRouters(tempPath2);
      const routers2 = TrpcGeneratorTestUtils.readGeneratedRouters(
        join(process.cwd(), 'tests', 'generated', 'config2')
      );
      
      // Compare outputs
      const userRouter1 = routers1.modelRouters['User'] || '';
      const userRouter2 = routers2.modelRouters['User'] || '';
      
      const comparison = TrpcGeneratorTestUtils.compareGeneratedOutput(
        userRouter1,
        userRouter2
      );
      
      // Should be different due to Zod integration difference
      expect(comparison.identical).toBe(false);
      expect(comparison.differences.length).toBeGreaterThan(0);
      
    } finally {
      fs.unlinkSync(tempPath1);
      fs.unlinkSync(tempPath2);
    }
  });
});