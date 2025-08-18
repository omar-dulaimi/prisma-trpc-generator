import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  globalSetup: 'tests/global.setup.ts',
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      'lib',
      'package',
      'tests/generated/**',
      'tests/schemas/**/*.prisma',
    ],
    testTimeout: 300000, // 5 minutes for complex generation tests
    hookTimeout: 60000,
    maxConcurrency: 1, // Serialize generation tests to avoid output collisions
    pool: 'threads',
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'tests/generated/**/routers/**/*.ts',
        'prisma/generated/routers/**/*.ts',
        'src/**/*.ts',
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
        'tests/**/temp-*.prisma',
      ],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
      reportsDirectory: './coverage',
      reportOnFailure: true,
    },
    sequence: {
      shuffle: false, // Keep deterministic test order for generation tests
      hooks: 'stack',
    },
    logHeapUsage: true, // Monitor memory usage in performance tests
    reporter: ['verbose'],
    outputFile: {
      json: './test-results.json',
      html: './test-report.html',
    },
  },
  resolve: {
    alias: {
      '@': './tests/generated',
      '@schemas': './tests/schemas',
      '@utils': './tests',
    },
  },
  esbuild: {
    target: 'node18',
  },
});
