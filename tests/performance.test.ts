import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { TrpcGeneratorTestUtils } from './comprehensive-test-utils';

describe('Performance Tests', () => {
  const schemas = [
    { name: 'basic', path: join(process.cwd(), 'tests', 'schemas', 'basic.prisma') },
    { name: 'comprehensive', path: join(process.cwd(), 'tests', 'schemas', 'comprehensive.prisma') },
    { name: 'edge-cases', path: join(process.cwd(), 'tests', 'schemas', 'edge-cases.prisma') }
  ];

  it.each(schemas)('should generate $name schema within performance limits', async ({ name, path }) => {
    const performance = await TrpcGeneratorTestUtils.testGenerationPerformance(path);
    
    // Performance expectations
    expect(performance.duration).toBeLessThan(30000); // 30 seconds max
    expect(performance.memoryUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // 500MB max heap increase
  });

  it('should handle large schemas efficiently', async () => {
    const comprehensiveSchemaPath = join(process.cwd(), 'tests', 'schemas', 'comprehensive.prisma');
    
    const performance = await TrpcGeneratorTestUtils.testGenerationPerformance(comprehensiveSchemaPath);
    
    // Large schema should still be reasonable
    expect(performance.duration).toBeLessThan(60000); // 1 minute max for large schema
    
    console.log(`Comprehensive schema generation took ${performance.duration.toFixed(2)}ms`);
  });

  it('should generate files of reasonable size', async () => {
    const comprehensiveOutputDir = join(process.cwd(), 'tests', 'generated', 'comprehensive');
    const routers = TrpcGeneratorTestUtils.readGeneratedRouters(comprehensiveOutputDir);
    
    // Check file sizes
    for (const [modelName, routerContent] of Object.entries(routers.modelRouters)) {
      const sizeKB = Buffer.byteLength(routerContent, 'utf8') / 1024;
      
      // Individual router files should be reasonable size
      expect(sizeKB).toBeLessThan(100); // 100KB max per router file
    }
    
    if (routers.appRouter) {
      const appRouterSizeKB = Buffer.byteLength(routers.appRouter, 'utf8') / 1024;
      expect(appRouterSizeKB).toBeLessThan(50); // 50KB max for app router
    }
  });

  it('should scale linearly with model count', async () => {
    const basicPerf = await TrpcGeneratorTestUtils.testGenerationPerformance(
      join(process.cwd(), 'tests', 'schemas', 'basic.prisma')
    );
    
    const comprehensivePerf = await TrpcGeneratorTestUtils.testGenerationPerformance(
      join(process.cwd(), 'tests', 'schemas', 'comprehensive.prisma')
    );
    
    // Comprehensive schema has more models, should take longer but not exponentially
    const ratio = comprehensivePerf.duration / basicPerf.duration;
    
    // Should not be more than 10x slower (reasonable scaling)
    expect(ratio).toBeLessThan(10);
    
    console.log(`Performance ratio (comprehensive/basic): ${ratio.toFixed(2)}x`);
  });

  it('should not have memory leaks during generation', async () => {
    const initialMemory = process.memoryUsage();
    
    // Generate multiple schemas in sequence
    for (const schema of schemas) {
      await TrpcGeneratorTestUtils.generateRouters(schema.path);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Memory increase should be reasonable (less than 100MB)
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
  });

  it('should handle concurrent generation requests', async () => {
    // Test generating multiple schemas concurrently
    const startTime = performance.now();
    
    const promises = schemas.map(async (schema) => {
      return TrpcGeneratorTestUtils.testGenerationPerformance(schema.path);
    });
    
    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;
    
    // Concurrent generation should be efficient
    expect(totalTime).toBeLessThan(45000); // 45 seconds max for all schemas
    
    // All should succeed
    results.forEach((result, index) => {
      expect(result.duration).toBeGreaterThan(0);
      console.log(`${schemas[index].name}: ${result.duration.toFixed(2)}ms`);
    });
  });

  it('should optimize repeated generations', async () => {
    const schemaPath = join(process.cwd(), 'tests', 'schemas', 'basic.prisma');
    
    // First generation (cold)
    const firstRun = await TrpcGeneratorTestUtils.testGenerationPerformance(schemaPath);
    
    // Second generation (should be faster due to caching/optimization)
    const secondRun = await TrpcGeneratorTestUtils.testGenerationPerformance(schemaPath);
    
    // Second run should not be significantly slower
    const ratio = secondRun.duration / firstRun.duration;
    expect(ratio).toBeLessThan(2); // Should not be more than 2x slower
    
    console.log(`Repeated generation ratio: ${ratio.toFixed(2)}x`);
  });

  it('should handle edge cases without performance degradation', async () => {
    const edgeCasesPath = join(process.cwd(), 'tests', 'schemas', 'edge-cases.prisma');
    
    const performance = await TrpcGeneratorTestUtils.testGenerationPerformance(edgeCasesPath);
    
    // Edge cases should not cause exponential slowdown
    expect(performance.duration).toBeLessThan(45000); // 45 seconds max
    
    console.log(`Edge cases generation took ${performance.duration.toFixed(2)}ms`);
  });

  it('should measure router complexity impact', async () => {
    const basicOutputDir = join(process.cwd(), 'tests', 'generated', 'basic');
    const comprehensiveOutputDir = join(process.cwd(), 'tests', 'generated', 'comprehensive');
    
    const basicRouters = TrpcGeneratorTestUtils.readGeneratedRouters(basicOutputDir);
    const comprehensiveRouters = TrpcGeneratorTestUtils.readGeneratedRouters(comprehensiveOutputDir);
    
    // Measure complexity by counting procedures
    let basicProcedureCount = 0;
    let comprehensiveProcedureCount = 0;
    
    for (const routerContent of Object.values(basicRouters.modelRouters)) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(routerContent);
      basicProcedureCount += structure.procedures.length;
    }
    
    for (const routerContent of Object.values(comprehensiveRouters.modelRouters)) {
      const structure = TrpcGeneratorTestUtils.validateRouterStructure(routerContent);
      comprehensiveProcedureCount += structure.procedures.length;
    }
    
    console.log(`Basic procedures: ${basicProcedureCount}`);
    console.log(`Comprehensive procedures: ${comprehensiveProcedureCount}`);
    
    // Comprehensive should have more procedures
    expect(comprehensiveProcedureCount).toBeGreaterThan(basicProcedureCount);
  });
});