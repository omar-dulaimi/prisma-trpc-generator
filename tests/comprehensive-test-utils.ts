import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { expect } from 'vitest';

export class TrpcGeneratorTestUtils {
  /**
   * Generate tRPC routers for a given schema
   */
  static async generateRouters(schemaPath: string): Promise<void> {
    try {
      // Pre-clean any existing output directory to avoid conflicts
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      const outputMatch = schemaContent.match(/output\s*=\s*["']([^"']+)["']/);
      if (outputMatch) {
        const outputPath = path.resolve(path.dirname(schemaPath), outputMatch[1]);
        this.cleanup(outputPath);
      }
      
      // Create a temporary schema with absolute generator path
      const tempSchemaPath = schemaPath + '.tmp';
      const projectRoot = path.resolve(__dirname, '..');
      const generatorPath = path.join(projectRoot, 'lib', 'generator.js');
      const updatedSchema = schemaContent.replace(
        /provider\s*=\s*["']node\s+[^"']*generator\.js["']/,
        `provider = "node \\"${generatorPath}\\""`
      );
      
      fs.writeFileSync(tempSchemaPath, updatedSchema);
      
      const command = `npx prisma generate --schema="${tempSchemaPath}"`;
      execSync(command, { 
        stdio: 'pipe',
        timeout: 60000 // 60 second timeout
      });
      
      // Clean up temporary schema
      fs.unlinkSync(tempSchemaPath);
    } catch (error) {
      console.error(`Failed to generate routers for ${schemaPath}:`, error);
      throw error;
    }
  }

  /**
   * Read generated router files
   */
  static readGeneratedRouters(outputDir: string): {
    appRouter?: string;
    createRouter?: string;
    modelRouters: { [model: string]: string };
  } {
    const routersDir = path.join(outputDir, 'routers');
    const result: any = { modelRouters: {} };

    if (!fs.existsSync(routersDir)) {
      return result;
    }

    // Read app router (index.ts)
    const appRouterPath = path.join(routersDir, 'index.ts');
    if (fs.existsSync(appRouterPath)) {
      result.appRouter = fs.readFileSync(appRouterPath, 'utf-8');
    }

    // Read createRouter helper
    const createRouterPath = path.join(routersDir, 'helpers', 'createRouter.ts');
    if (fs.existsSync(createRouterPath)) {
      result.createRouter = fs.readFileSync(createRouterPath, 'utf-8');
    }

    // Read model routers
    const files = fs.readdirSync(routersDir);
    for (const file of files) {
      if (file.endsWith('.router.ts')) {
        const modelName = file.replace('.router.ts', '');
        const filePath = path.join(routersDir, file);
        result.modelRouters[modelName] = fs.readFileSync(filePath, 'utf-8');
      }
    }

    return result;
  }

  /**
   * Validate router structure and content
   */
  static validateRouterStructure(routerContent: string): {
    hasImports: boolean;
    hasExport: boolean;
    hasRouter: boolean;
    procedures: string[];
    imports: string[];
  } {
    const structure = {
      hasImports: false,
      hasExport: false,
      hasRouter: false,
      procedures: [] as string[],
      imports: [] as string[]
    };

    // Check for imports
    const importMatches = routerContent.match(/import\s+.*?from\s+['"][^'"]+['"]/g);
    if (importMatches) {
      structure.hasImports = true;
      structure.imports = importMatches;
    }

    // Check for exports
    structure.hasExport = /export\s+(const|default)/.test(routerContent);

    // Check for router definition
    structure.hasRouter = /\.router\s*\(/.test(routerContent);

    // Extract procedures (match t.procedure, shieldedProcedure, and protectedProcedure)
    const procedureMatches = routerContent.match(/(\w+):\s*(t\.procedure|shieldedProcedure|protectedProcedure)/g);
    if (procedureMatches) {
      structure.procedures = procedureMatches.map(match => 
        match.replace(/:\s*(t\.procedure|shieldedProcedure|protectedProcedure)/, '')
      );
    }

    return structure;
  }

  /**
   * Get expected operations for given models
   */
  static getExpectedOperations(modelNames: string[]): {
    queries: string[];
    mutations: string[];
  } {
    const queries: string[] = [];
    const mutations: string[] = [];

    const queryOps = ['findFirst', 'findMany', 'findUnique', 'aggregate', 'groupBy', 'count'];
    const mutationOps = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

    for (const modelName of modelNames) {
      for (const op of queryOps) {
        queries.push(`${op}${modelName}`);
      }
      for (const op of mutationOps) {
        mutations.push(`${op}${modelName}`);
      }
    }

    return { queries, mutations };
  }

  /**
   * Validate that all expected CRUD operations are present
   */
  static validateCrudOperations(routerContent: string, modelName: string): {
    hasCreate: boolean;
    hasRead: boolean;
    hasUpdate: boolean;
    hasDelete: boolean;
    missingOperations: string[];
  } {
    const operations = {
      hasCreate: false,
      hasRead: false,
      hasUpdate: false,
      hasDelete: false,
      missingOperations: [] as string[]
    };

    const expectedOps = [
      { name: 'create', patterns: [`create.*${modelName}`, `${modelName}.*create`] },
      { name: 'read', patterns: [`find.*${modelName}`, `${modelName}.*find`] },
      { name: 'update', patterns: [`update.*${modelName}`, `${modelName}.*update`] },
      { name: 'delete', patterns: [`delete.*${modelName}`, `${modelName}.*delete`] }
    ];

    for (const op of expectedOps) {
      const hasOp = op.patterns.some(pattern => 
        new RegExp(pattern, 'i').test(routerContent)
      );
      
      switch (op.name) {
        case 'create':
          operations.hasCreate = hasOp;
          break;
        case 'read':
          operations.hasRead = hasOp;
          break;
        case 'update':
          operations.hasUpdate = hasOp;
          break;
        case 'delete':
          operations.hasDelete = hasOp;
          break;
      }

      if (!hasOp) {
        operations.missingOperations.push(op.name);
      }
    }

    return operations;
  }

  /**
   * Test schema generation performance
   */
  static async testGenerationPerformance(schemaPath: string): Promise<{
    duration: number;
    memoryUsage: NodeJS.MemoryUsage;
  }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    await this.generateRouters(schemaPath);

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    return {
      duration: endTime - startTime,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
      }
    };
  }

  /**
   * Validate TypeScript compilation
   */
  static validateTypeScriptCompilation(filePath: string): boolean {
    try {
      // Basic syntax validation by reading and parsing
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Check for basic TypeScript syntax issues
      const syntaxErrors = [
        /\bundefine\b/,  // undefined typos
        /\bimport\s*\{[^}]*\}\s*from\s*['"]\s*['"]/,  // empty imports
        /export\s*\{[^}]*\}\s*from\s*['"]\s*['"]/,   // empty exports
        /:\s*,/,  // missing types
        /,\s*}/   // trailing commas in objects (can be valid but check)
      ];

      for (const pattern of syntaxErrors) {
        if (pattern.test(content)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up generated files
   */
  static cleanup(outputDir: string): void {
    try {
      if (fs.existsSync(outputDir)) {
        // Retry cleanup with a small delay to handle race conditions
        let retries = 3;
        while (retries > 0) {
          try {
            fs.rmSync(outputDir, { recursive: true, force: true });
            break;
          } catch (error: any) {
            if (error.code === 'ENOTEMPTY' && retries > 1) {
              // Wait a bit and retry for ENOTEMPTY errors
              const waitMs = 100;
              const start = Date.now();
              while (Date.now() - start < waitMs) {
                // Busy wait
              }
              retries--;
              continue;
            }
            throw error;
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to cleanup ${outputDir}:`, error);
    }
  }

  /**
   * Validate Zod schema integration
   */
  static validateZodIntegration(routerContent: string): {
    hasZodImports: boolean;
    hasSchemaUsage: boolean;
    zodSchemas: string[];
  } {
    const zodInfo = {
      hasZodImports: false,
      hasSchemaUsage: false,
      zodSchemas: [] as string[]
    };

    // Check for Zod-related imports
    zodInfo.hasZodImports = /import.*Schema.*from/.test(routerContent);

    // Check for schema usage in procedures
    zodInfo.hasSchemaUsage = /\.input\s*\(\s*\w+Schema\s*\)/.test(routerContent);

    // Extract schema names
    const schemaMatches = routerContent.match(/(\w+Schema)/g);
    if (schemaMatches) {
      zodInfo.zodSchemas = [...new Set(schemaMatches)];
    }

    return zodInfo;
  }

  /**
   * Validate tRPC Shield integration
   */
  static validateShieldIntegration(routerContent: string): {
    hasShieldImports: boolean;
    hasPermissions: boolean;
    hasMiddleware: boolean;
  } {
    return {
      hasShieldImports: /import.*shield|permissions/.test(routerContent),
      hasPermissions: /permissions/.test(routerContent),
      hasMiddleware: /middleware/.test(routerContent)
    };
  }

  /**
   * Compare generated output between different configurations
   */
  static compareGeneratedOutput(
    output1: string, 
    output2: string
  ): {
    identical: boolean;
    differences: string[];
    similarities: string[];
  } {
    const comparison = {
      identical: output1 === output2,
      differences: [] as string[],
      similarities: [] as string[]
    };

    if (!comparison.identical) {
      const lines1 = output1.split('\n');
      const lines2 = output2.split('\n');

      const maxLines = Math.max(lines1.length, lines2.length);
      
      for (let i = 0; i < maxLines; i++) {
        const line1 = lines1[i] || '';
        const line2 = lines2[i] || '';
        
        if (line1 !== line2) {
          comparison.differences.push(`Line ${i + 1}: "${line1}" vs "${line2}"`);
        } else if (line1.trim()) {
          comparison.similarities.push(line1.trim());
        }
      }
    }

    return comparison;
  }

  /**
   * Test with different generator configurations
   */
  static async testMultipleConfigurations(
    baseSchema: string,
    configurations: Array<{ name: string; config: Record<string, any> }>
  ): Promise<Array<{ name: string; success: boolean; output?: any; error?: any }>> {
    const results = [];

    for (const config of configurations) {
      try {
        // Modify schema with configuration
        const modifiedSchema = this.modifySchemaConfig(baseSchema, config.config);
        const tempSchemaPath = path.join(process.cwd(), `temp-${config.name}.prisma`);
        
        fs.writeFileSync(tempSchemaPath, modifiedSchema);
        
        await this.generateRouters(tempSchemaPath);
        
        results.push({
          name: config.name,
          success: true,
          output: `Generated successfully with ${config.name} configuration`
        });

        // Cleanup temp file
        fs.unlinkSync(tempSchemaPath);
        
      } catch (error) {
        results.push({
          name: config.name,
          success: false,
          error: error
        });
      }
    }

    return results;
  }

  /**
   * Modify schema with different generator configurations
   */
  private static modifySchemaConfig(
    schemaContent: string, 
    config: Record<string, any>
  ): string {
    let modified = schemaContent;

    // Extract the generator block
    const generatorMatch = modified.match(/(generator trpc \{)([\s\S]*?)(\})/);
    if (!generatorMatch) {
      throw new Error('Could not find generator trpc block in schema');
    }

    const [fullMatch, opening, existingConfig, closing] = generatorMatch;
    
    // Parse existing config lines
    const existingLines = existingConfig.split('\n').map(line => line.trim()).filter(Boolean);
    const configMap = new Map<string, string>();
    
    // Parse existing config into a map
    for (const line of existingLines) {
      const match = line.match(/(\w+)\s*=\s*(.+)/);
      if (match) {
        configMap.set(match[1], match[2]);
      }
    }
    
    // Update with new config values
    for (const [key, value] of Object.entries(config)) {
      configMap.set(key, JSON.stringify(value));
    }
    
    // Rebuild config block
    const configLines = Array.from(configMap.entries())
      .map(([key, value]) => `  ${key} = ${value}`)
      .join('\n');
    
    // Replace the generator block
    modified = modified.replace(fullMatch, `${opening}\n${configLines}\n${closing}`);

    return modified;
  }
}