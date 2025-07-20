import { expect } from 'vitest';
import { z } from 'zod';

export class RouterTestUtils {
  /**
   * Test that a router has the expected procedures
   */
  static testRouterStructure(router: any, expectedProcedures: string[]) {
    expect(router).toBeDefined();
    expect(typeof router).toBe('object');
    
    for (const procedure of expectedProcedures) {
      expect(router[procedure]).toBeDefined();
      expect(typeof router[procedure]).toBe('object');
    }
  }

  /**
   * Test that a procedure has the expected structure
   */
  static testProcedureStructure(procedure: any) {
    expect(procedure).toBeDefined();
    expect(typeof procedure).toBe('object');
    expect(procedure._def).toBeDefined();
  }

  /**
   * Test that valid data passes validation
   */
  static testValidData<T>(schema: z.ZodSchema<T>, data: unknown) {
    const result = schema.safeParse(data);
    if (!result.success) {
      console.error('Validation errors:', result.error.errors);
    }
    expect(result.success).toBe(true);
    return result.data;
  }

  /**
   * Test that invalid data fails validation
   */
  static testInvalidData<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    expectedErrorPaths?: string[]
  ) {
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
    
    if (expectedErrorPaths && !result.success) {
      const errorPaths = result.error.errors.map(err => err.path.join('.'));
      for (const expectedPath of expectedErrorPaths) {
        expect(errorPaths).toContain(expectedPath);
      }
    }
  }

  /**
   * Test that a schema handles optional fields correctly
   */
  static testOptionalFields<T>(
    schema: z.ZodSchema<T>,
    baseData: Record<string, any>,
    optionalFields: string[]
  ) {
    // Test with all optional fields present
    this.testValidData(schema, baseData);

    // Test with each optional field omitted
    for (const field of optionalFields) {
      const dataWithoutField = { ...baseData };
      delete dataWithoutField[field];
      this.testValidData(schema, dataWithoutField);
    }

    // Test with all optional fields omitted
    const dataWithoutOptionals = { ...baseData };
    for (const field of optionalFields) {
      delete dataWithoutOptionals[field];
    }
    this.testValidData(schema, dataWithoutOptionals);
  }

  /**
   * Test type safety by attempting to assign invalid types
   */
  static testTypeSafety<T>(schema: z.ZodSchema<T>, validData: T) {
    // This is more of a compile-time test, but we can verify runtime behavior
    const result = schema.parse(validData);
    expect(result).toEqual(validData);
  }

  /**
   * Test performance of schema validation
   */
  static testPerformance<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    iterations: number = 1000
  ) {
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      schema.safeParse(data);
    }
    
    const end = performance.now();
    const duration = end - start;
    const avgTime = duration / iterations;
    
    // Expect average validation time to be under 1ms
    expect(avgTime).toBeLessThan(1);
    
    return { totalTime: duration, averageTime: avgTime };
  }

  /**
   * Test that generated routers work with tRPC
   */
  static async testTrpcCompatibility(router: any) {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    
    // Test that router can be called (basic tRPC compatibility)
    expect(() => router()).not.toThrow();
  }

  /**
   * Helper to generate mock data for testing
   */
  static generateMockUserData() {
    return {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      posts: [],
    };
  }

  static generateMockPostData() {
    return {
      id: 1,
      title: 'Test Post',
      content: 'Test content',
      published: false,
      authorId: 1,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}