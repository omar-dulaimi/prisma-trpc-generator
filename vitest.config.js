import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: [
      'node_modules', 
      'dist', 
      'coverage', 
      'lib', 
      'package',
      'tests/generated/**',
      'tests/schemas/**/*.prisma'
    ],
    testTimeout: 300000, // 5 minutes for complex generation tests
    hookTimeout: 60000,
    maxConcurrency: 3, // Limit concurrent tests for stability
    pool: 'threads',
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'tests/generated/**/routers/**/*.ts',
        'prisma/generated/routers/**/*.ts',
        'src/**/*.ts'
      ],
      exclude: [
        'node_modules', 
        '**/index.ts',
        '**/node_modules/**',
        '**/*.d.ts',
        'lib/**',
        'package/**',
        'tests/test-context.ts',
        'tests/**/*.test.ts',
        'tests/**/temp-*.prisma'
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 40,
        lines: 60
      },
      reportsDirectory: './coverage',
      reportOnFailure: true
    },
    sequence: {
      shuffle: false, // Keep deterministic test order for generation tests
      hooks: 'stack'
    },
    logHeapUsage: true, // Monitor memory usage in performance tests
    reporter: ['verbose'],
    outputFile: {
      json: './test-results.json',
      html: './test-report.html'
    }
  },
  resolve: {
    alias: {
      '@': './tests/generated',
      '@schemas': './tests/schemas',
      '@utils': './tests'
    }
  },
  esbuild: {
    target: 'node18'
  }
});