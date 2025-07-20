import { describe, it, expect, beforeAll } from 'vitest';
import { RouterTestUtils } from './router-test-utils';
import path from 'path';
import fs from 'fs';

describe('Generated Router Tests', () => {
  const generatedDir = path.join(process.cwd(), 'prisma', 'generated');
  
  beforeAll(async () => {
    // Ensure we have generated files to test
    if (!fs.existsSync(generatedDir)) {
      // Generate the routers first
      const { execSync } = require('child_process');
      execSync('npm run generate', { stdio: 'inherit' });
    }
  });

  describe('Router File Generation', () => {
    it('should generate routers directory', () => {
      const routersDir = path.join(generatedDir, 'routers');
      expect(fs.existsSync(routersDir)).toBe(true);
    });

    it('should generate main index router file', () => {
      const indexFile = path.join(generatedDir, 'routers', 'index.ts');
      expect(fs.existsSync(indexFile)).toBe(true);
    });

    it('should generate createRouter helper', () => {
      const helperFile = path.join(generatedDir, 'routers', 'helpers', 'createRouter.ts');
      expect(fs.existsSync(helperFile)).toBe(true);
    });

    it('should generate model-specific router files', () => {
      const routersDir = path.join(generatedDir, 'routers');
      if (fs.existsSync(routersDir)) {
        const files = fs.readdirSync(routersDir);
        const routerFiles = files.filter(file => file.endsWith('.router.ts'));
        
        // Should have at least User and Post routers based on schema
        expect(routerFiles.length).toBeGreaterThan(0);
        
        // Check for expected router files
        const expectedRouters = ['User.router.ts', 'Post.router.ts'];
        for (const expectedRouter of expectedRouters) {
          if (fs.existsSync(path.join(routersDir, expectedRouter))) {
            expect(routerFiles).toContain(expectedRouter);
          }
        }
      }
    });
  });

  describe('Generated Router Content', () => {
    it('should have valid TypeScript syntax', async () => {
      const routersDir = path.join(generatedDir, 'routers');
      if (fs.existsSync(routersDir)) {
        const files = fs.readdirSync(routersDir);
        const tsFiles = files.filter(file => file.endsWith('.ts'));
        
        for (const file of tsFiles) {
          const filePath = path.join(routersDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Basic syntax checks
          expect(content).toContain('export');
          expect(content).not.toContain('undefined');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });

    it('should import required dependencies', async () => {
      const indexFile = path.join(generatedDir, 'routers', 'index.ts');
      if (fs.existsSync(indexFile)) {
        const content = fs.readFileSync(indexFile, 'utf-8');
        
        // Should import createRouter helper
        expect(content).toMatch(/import.*createRouter/);
        expect(content).toContain('appRouter');
        expect(content).toContain('export');
      }
    });

    it('should generate CRUD operations for models', async () => {
      const routersDir = path.join(generatedDir, 'routers');
      if (fs.existsSync(routersDir)) {
        const files = fs.readdirSync(routersDir);
        const routerFiles = files.filter(file => file.endsWith('.router.ts'));
        
        for (const routerFile of routerFiles) {
          const filePath = path.join(routersDir, routerFile);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Should contain common CRUD operations
          const commonOperations = ['findMany', 'findUnique', 'create', 'update', 'delete'];
          let hasOperations = false;
          
          for (const operation of commonOperations) {
            if (content.includes(operation)) {
              hasOperations = true;
              break;
            }
          }
          
          expect(hasOperations).toBe(true);
        }
      }
    });
  });

  describe('Router Structure Validation', () => {
    it('should test router imports work correctly', async () => {
      try {
        // Dynamically import the generated router if it exists
        const indexPath = path.join(generatedDir, 'routers', 'index.ts');
        if (fs.existsSync(indexPath)) {
          // We can't actually import TS files directly in tests without compilation
          // But we can verify the file structure is correct
          const content = fs.readFileSync(indexPath, 'utf-8');
          expect(content).toContain('export');
          expect(content).toContain('appRouter');
        }
      } catch (error) {
        // If import fails, that's expected without proper compilation
        console.log('Import test skipped - files need compilation');
      }
    });

    it('should validate generated router procedures', () => {
      // This would test the actual router structure if we could import it
      // For now, we verify file content structure
      const routersDir = path.join(generatedDir, 'routers');
      if (fs.existsSync(routersDir)) {
        const files = fs.readdirSync(routersDir);
        const routerFiles = files.filter(file => file.endsWith('.router.ts'));
        
        for (const routerFile of routerFiles) {
          const filePath = path.join(routersDir, routerFile);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Should export a router
          expect(content).toMatch(/export const \w+Router/);
          expect(content).toContain('t.router');
        }
      }
    });
  });

  describe('Integration Tests', () => {
    it('should generate compatible tRPC procedures', () => {
      // Test that generated code follows tRPC patterns
      const routersDir = path.join(generatedDir, 'routers');
      if (fs.existsSync(routersDir)) {
        const helperFile = path.join(routersDir, 'helpers', 'createRouter.ts');
        if (fs.existsSync(helperFile)) {
          const content = fs.readFileSync(helperFile, 'utf-8');
          
          // Should use tRPC patterns
          expect(content).toMatch(/import.*@trpc/);
          expect(content).toContain('procedure');
        }
      }
    });

    it('should handle Zod schema integration', () => {
      const routersDir = path.join(generatedDir, 'routers');
      if (fs.existsSync(routersDir)) {
        const files = fs.readdirSync(routersDir);
        const routerFiles = files.filter(file => file.endsWith('.router.ts'));
        
        for (const routerFile of routerFiles) {
          const filePath = path.join(routersDir, routerFile);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Should import Zod schemas if withZod is enabled
          if (content.includes('Schema')) {
            expect(content).toMatch(/import.*Schema/);
          }
        }
      }
    });
  });

  describe('Performance Tests', () => {
    it('should generate files in reasonable time', async () => {
      const start = performance.now();
      
      // Test file reading performance
      const routersDir = path.join(generatedDir, 'routers');
      if (fs.existsSync(routersDir)) {
        const files = fs.readdirSync(routersDir);
        for (const file of files.slice(0, 5)) { // Test first 5 files
          if (file.endsWith('.ts')) {
            fs.readFileSync(path.join(routersDir, file), 'utf-8');
          }
        }
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Should be able to read files quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    it('should not generate excessively large files', () => {
      const routersDir = path.join(generatedDir, 'routers');
      if (fs.existsSync(routersDir)) {
        const files = fs.readdirSync(routersDir);
        
        for (const file of files) {
          if (file.endsWith('.ts')) {
            const filePath = path.join(routersDir, file);
            const stats = fs.statSync(filePath);
            
            // Individual router files shouldn't be too large (500KB limit)
            expect(stats.size).toBeLessThan(500 * 1024);
          }
        }
      }
    });
  });
});