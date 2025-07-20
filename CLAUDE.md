# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **prisma-trpc-generator** - a Prisma generator that automates creating tRPC routers from Prisma schemas. It generates fully implemented tRPC routers with Zod input validation, middleware support, and optional tRPC Shield integration.

## Development Commands

### Building and Testing
- `npm run generate` - Compile TypeScript and run Prisma generate (for testing the generator itself)
- `tsc` - Compile TypeScript source code to JavaScript in `/lib` directory
- `npx prisma generate` - Test the generator against the example schema in `/prisma`

### Publishing
- `npm run package:publish` - Build and publish the package (runs `package.sh` script)
- `./package.sh` - Build script that compiles, creates package directory, and prepares for publishing

## Architecture

### Core Components

**Generator Entry Point (`src/prisma-generator.ts`)**
- Main generator function that processes Prisma schema and generates tRPC routers
- Integrates with prisma-zod-generator and prisma-trpc-shield-generator
- Creates router files in the specified output directory

**Configuration (`src/config.ts`)**
- Zod schema for validating generator options
- Supports options like `withZod`, `withMiddleware`, `withShield`, `contextPath`, etc.
- Default paths point to `../../../../src/` relative to generated files

**Code Generation (`src/helpers.ts`)**
- Functions for generating TypeScript code using ts-morph
- Handles router imports, procedure generation, and schema imports
- Creates different types of CRUD operations based on Prisma model operations

### Generated Output Structure
```
generated/
├── routers/
│   ├── index.ts          # Main app router that combines all model routers
│   ├── helpers/
│   │   └── createRouter.ts  # Base router factory with middleware/shield setup
│   └── [Model].router.ts    # Individual model routers (User.router.ts, Post.router.ts, etc.)
└── schemas/              # Zod validation schemas (if withZod: true)
```

### Key Dependencies Integration
- **prisma-zod-generator**: Generates Zod schemas for input validation
- **prisma-trpc-shield-generator**: Generates tRPC Shield for permissions
- **ts-morph**: Used for TypeScript code generation and manipulation
- **pluralize**: Converts model names to plural for router naming

### Configuration Options
Generator supports extensive customization through Prisma schema generator block:
- Context and middleware paths can be customized
- Individual CRUD operations can be enabled/disabled via `generateModelActions`
- Model visibility controlled by `/// @@Gen.model(hide: true)` comments
- Select/Include generation can be toggled

## Important Files to Understand
- `src/prisma-generator.ts:23-158` - Main generation logic
- `src/config.ts:20-35` - Configuration schema and defaults
- `src/helpers.ts` - Code generation utilities
- `prisma/schema.prisma` - Example schema for testing
- `package.sh` - Build and packaging script