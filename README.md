# ⚡ Prisma tRPC Generator

Automatically generate fully implemented, type-safe tRPC routers from your Prisma schema.

<p>
  <a href="https://www.npmjs.com/package/prisma-trpc-generator">
    <img src="https://img.shields.io/npm/v/prisma-trpc-generator.svg?style=for-the-badge&logo=npm&color=blue" alt="Latest Version">
  </a>
  <a href="https://www.npmjs.com/package/prisma-trpc-generator">
    <img src="https://img.shields.io/npm/dt/prisma-trpc-generator.svg?style=for-the-badge&logo=npm&color=green" alt="Downloads">
  </a>
  <a href="https://github.com/omar-dulaimi/prisma-trpc-generator/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/omar-dulaimi/prisma-trpc-generator/ci.yml?style=for-the-badge&logo=github" alt="CI Status">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/npm/l/prisma-trpc-generator.svg?style=for-the-badge&color=purple" alt="License">
  </a>
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A5%2020.19.0%20(min)%20%E2%80%A2%2022.x%20(rec)-026e00?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js >= 20.19.0 (min) · 22.x (rec)">
  <img src="https://img.shields.io/badge/Prisma-%E2%89%A5%207.0.0%20(min)%20%E2%80%A2%20Latest%207.x%20(rec)-0c344b?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma >= 7.0.0 (min) · Latest 7.x (rec)">
  <img src="https://img.shields.io/badge/TypeScript-%E2%89%A5%205.4.0%20(min)%20%E2%80%A2%205.9.x%20(rec)-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript >= 5.4.0 (min) · 5.9.x (rec)">
</p>

> 🎯 Zero‑config • 🛡️ Type‑safe • ⚡ Fast • 🔧 Customizable

<p align="center"><em>Transforms your Prisma schema into production‑ready tRPC APIs with Zod validation, middleware, and optional tRPC Shield.</em></p>

<p align="center">
  <a href="https://github.com/sponsors/omar-dulaimi">
    <img src="https://img.shields.io/badge/💝_Sponsor_on_GitHub-ea4aaa?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Sponsors" height="36">
  </a>
</p>

## ✨ Key features

- 🚀 Zero configuration defaults
- 🔄 Always in sync with your Prisma schema
- 🛡️ 100% TypeScript type-safety
- 🎯 Complete CRUD coverage for all Prisma operations
- ⚙️ Highly configurable: paths, middleware, shield, options
- 📦 Lightweight and fast generation
- 🔗 Integrates with Zod, tRPC Shield, and custom middleware

---

## 📚 Table of contents

- [🚀 Quick start](#quick-start)
- [⚙️ Configuration](#configuration)
- [🔎 Feature guide](#feature-guide)
  - [Zod validation](#1-zod-validation-inputs)
  - [Middleware & Shield](#2-middleware--shield)
  - [Auth](#3-auth-session--jwt--custom)
  - [Request ID + logging](#4-request-id--logging)
  - [tRPC Metadata Support](#5-trpc-metadata-support)
  - [OpenAPI (MVP)](#6-openapi-mvp)
  - [Postman collection](#7-postman-collection)
  - [DDD services (optional)](#8-ddd-services-optional)
  - [Migration from inline config](#migration-from-inline-config)
- [📋 Generated output](#generated-output)
- [🛠️ Advanced usage](#advanced-usage)
- [🧪 Troubleshooting, performance, FAQ](#troubleshooting-performance-faq)
- [🤝 Contributing](#contributing)
- [📄 License](#license)
- [🔗 Related projects](#related-projects)
- [🙏 Acknowledgments](#acknowledgments)

---

## 🚀 Quick start

### Requirements

| Component  | Minimum | Recommended |
| ---------- | ------- | ----------- |
| Node.js    | 20.19.0 | 22.x        |
| Prisma     | 7.0.0   | Latest 7.x  |
| TypeScript | 5.4.0   | 5.9.x       |

### Install

```bash
# npm
npm install prisma-trpc-generator

# yarn
yarn add prisma-trpc-generator

# pnpm
pnpm add prisma-trpc-generator
```

### Configure Prisma 7

1. Create `prisma.config.ts` at the repo root:

   ```ts
   import 'dotenv/config';
   import { defineConfig, env } from 'prisma/config';

   export default defineConfig({
     schema: 'prisma/schema.prisma',
     migrations: {
       path: 'prisma/migrations',
       seed: 'tsx prisma/seed.ts',
     },
     datasource: {
       url: env('DATABASE_URL'),
     },
   });
   ```

2. Update your `generator client` block:

   ```prisma
   generator client {
     provider = "prisma-client"
     output   = "../node_modules/.prisma/client"
   }
   ```

3. Set `DATABASE_URL` (e.g., `file:./prisma/dev.db`) in `.env` and instantiate `PrismaClient` with the adapter that matches your database (SQLite → `@prisma/adapter-better-sqlite3`, Postgres → `@prisma/adapter-pg`, etc.).

### Minimal setup

Add the generator to your Prisma schema and point to your JSON config file:

```prisma
generator trpc {
  provider = "node ./lib/generator.js"
  output   = "./prisma/generated"
  config   = "./prisma/trpc.config.json"
}
```

Create `prisma/trpc.config.json` (see Feature guide for options), enable `"strict": true` in `tsconfig.json`, then generate:

```bash
npx prisma generate
```

---

## ⚙️ Configuration

As of v2.x, configuration is unified via a single JSON file. Your Prisma generator block should only specify `output` and `config`.

Example `prisma/trpc.config.json`:

```
{
  "withZod": true,
  "withMiddleware": true,
  "withShield": "./shield",
  "contextPath": "./context",
  "trpcOptionsPath": "./trpcOptions",
  "dateTimeStrategy": "date",
  "withMeta": false,
  "postman": true,
  "postmanExamples": "skeleton",
  "openapi": true,
  "withRequestId": false,
  "withLogging": false,
  "withServices": false
}
```

Notes

- The config path is resolved relative to the Prisma schema file.
- Aliases `configPath` and `configFile` are also accepted.
- If a config file is provided, any inline options in the generator block are ignored with a warning.
- Inline options without a config file still work for now but are deprecated and will be removed in a future major release.

---

## 🔎 Feature guide

Each feature is opt‑in via the JSON config. Below are concise how‑tos and the exact keys to set.

### 1) Zod validation (inputs)

- Key: `withZod: true`
- Emits `schemas/` with Zod types for procedure inputs; routers wire `.input()` automatically.
- **Date handling**: Set `dateTimeStrategy` to control DateTime field validation:
  - `"date"` (default): `z.date()` - accepts only Date objects
  - `"coerce"`: `z.coerce.date()` - accepts both Date objects and ISO strings
  - `"isoString"`: ISO string validation with transformation

#### Extending Zod schemas with Prisma comments

You can add additional Zod validation constraints using special comments in your Prisma schema:

```prisma
model User {
  id    Int     @id @default(autoincrement()) /// @zod.number.int()
  email String  @unique /// @zod.string.email()
  name  String? /// @zod.string.min(1).max(100)
  age   Int?    /// @zod.number.int().min(0).max(120)

  posts Post[]
}

model Post {
  id        Int      @id @default(autoincrement()) /// @zod.number.int()
  title     String   /// @zod.string.min(1).max(255, { message: "Title must be shorter than 256 characters" })
  content   String?  /// @zod.string.max(10000)
  published Boolean  @default(false)

  author   User? @relation(fields: [authorId], references: [id])
  authorId Int?
}
```

This generates Zod schemas with the specified validations:

```typescript
export const UserCreateInput = z.object({
  id: z.number().int(),
  email: z.string().email(),
  name: z.string().min(1).max(100).nullish(),
  age: z.number().int().min(0).max(120).nullish(),
  // ...
});
```

For more advanced Zod validation options and syntax, see the [prisma-zod-generator documentation](https://github.com/omar-dulaimi/prisma-zod-generator).

### 2) Middleware & Shield

- Keys: `withMiddleware: boolean | string`, `withShield: boolean | string`
- When `withMiddleware: true`, a basic middleware scaffold is included; or point to your own path string.
- When `withShield` is truthy, the generator imports your `permissions` and exposes `shieldedProcedure` in `createRouter.ts`.

### 3) Auth (session / JWT / custom)

- Key: `auth: boolean | { strategy?: 'session'|'jwt'|'custom'; rolesField?: string; jwt?: {...}; session?: {...}; custom?: {...} }`
- When enabled, generator emits:
  - `routers/helpers/auth-strategy.ts` (stubs + default HS256 JWT verifier)
  - `routers/helpers/auth.ts` with `ensureAuth` and `ensureRole`
  - `createRouter.ts` wires `authMiddleware`, `publicProcedure`, `protectedProcedure`, `roleProcedure(roles)`
- See `docs/usage/auth.md` for strategy hooks and examples.

### 4) Request ID + logging

- Keys: `withRequestId: boolean`, `withLogging: boolean`
- Adds a small requestId middleware and optional structured log line around every procedure.
- To propagate requestId into errors, return it in your `trpcOptions.errorFormatter`.

### 5) tRPC Metadata Support

- Key: `withMeta: boolean | { openapi?: boolean; auth?: boolean; description?: boolean; defaultMeta?: object }`
- When enabled, adds `.meta()` calls to generated procedures with:
  - OpenAPI-compatible metadata (HTTP methods, paths, tags, descriptions)
  - Authentication metadata for middleware integration
  - Custom metadata via `defaultMeta` configuration
- Perfect for OpenAPI documentation, conditional auth, and enhanced middleware

### 6) OpenAPI (MVP)

- Key: `openapi: boolean | { enabled?: boolean; title?: string; version?: string; baseUrl?: string; pathPrefix?: string; pathStyle?: 'slash'|'dot'; includeExamples?: boolean }`
- Emits `openapi/openapi.json` and `routers/adapters/openapi.ts` with a tagged document.
- Paths map to tRPC endpoints (POST) with a `{ input: {} }` request body schema and optional skeleton examples.

### 7) Postman collection

- Key: `postman: boolean | { endpoint?: string; envName?: string; fromOpenApi?: boolean; examples?: 'none'|'skeleton' }`
- Emits `postman/collection.json`. When `fromOpenApi: true`, the collection is derived from OpenAPI.
- Set `examples: 'skeleton'` to include sample bodies for common operations.

### 8) DDD services (optional)

- Keys: `withServices`, `serviceStyle`, `serviceDir`, `withListMethod`, `serviceImports`
- Emits a BaseService and per‑model service stubs; routers can delegate to services when enabled.
- Tenancy/soft‑delete helpers are included in the service layer if you choose to use it.

### Migration from inline config

1. Create `prisma/trpc.config.json` and move all previous inline keys into it.
2. Replace keys in `generator trpc` so it only contains `output` and `config`.
3. Run generation. If you still have inline keys, the generator will ignore them and warn.

---

## 📋 Generated output

<details>
<summary>Show generated layout</summary>

For the following schema:

```prisma
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  title     String
  content   String?
  published Boolean  @default(false)
  viewCount Int      @default(0)
  author    User?    @relation(fields: [authorId], references: [id])
  authorId  Int?
}
```

The generator creates:

![tRPC Routers](https://raw.githubusercontent.com/omar-dulaimi/prisma-trpc-generator/master/trpcRouters.png)

```
generated/
├── routers/
│   ├── index.ts              # Main app router combining all model routers
│   ├── helpers/
│   │   └── createRouter.ts   # Base router factory with middleware/shield setup
│   ├── User.router.ts        # User CRUD operations
│   └── Post.router.ts        # Post CRUD operations
└── schemas/                  # Zod validation schemas (if withZod: true)
    ├── objects/              # Input type schemas
    ├── findManyUser.schema.ts
    ├── createOneUser.schema.ts
    └── index.ts              # Barrel exports
```

</details>

---

## 🛠️ Advanced usage

<details>
<summary>Show advanced usage examples</summary>

### Custom middleware

```ts
// src/middleware.ts
import { TRPCError } from '@trpc/server';
import { t } from './trpc';

export const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const loggingMiddleware = t.middleware(async ({ path, type, next }) => {
  console.log(`tRPC ${type} ${path}`);
  return next();
});
```

### Integration with tRPC Shield

```ts
// src/permissions.ts
import { shield, rule, and } from 'trpc-shield';

const isAuthenticated = rule()(async (_parent, _args, ctx) => !!ctx.user);

const isOwner = rule()(async (_parent, args, ctx) => {
  if (!args.where?.id) return false;
  const post = await ctx.prisma.post.findUnique({
    where: { id: args.where.id },
    select: { authorId: true },
  });
  return post?.authorId === ctx.user?.id;
});

export const permissions = shield({
  query: {
    findManyPost: true, // Public
    findUniqueUser: isAuthenticated,
  },
  mutation: {
    createOnePost: isAuthenticated,
    updateOnePost: and(isAuthenticated, isOwner),
    deleteOnePost: and(isAuthenticated, isOwner),
  },
});
```

### Custom tRPC options

```ts
// src/trpcOptions.ts
import { ZodError } from 'zod';
import superjson from 'superjson';

export default {
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
};
```

### 🎨 Customizations

#### Skipping models

```prisma
/// @@Gen.model(hide: true)
model InternalLog {
  id        Int      @id @default(autoincrement())
  message   String
  createdAt DateTime @default(now())
}
```

#### Custom context

```ts
// src/context.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL as ':memory:' | (string & {}),
});
const prisma = new PrismaClient({ adapter });

export interface Context {
  prisma: PrismaClient;
  user?: { id: string; email: string; role: string };
}

export const createContext = async ({ req }): Promise<Context> => {
  const user = await getUserFromRequest(req);
  return { prisma, user };
};
```

### 📚 Examples

#### Basic CRUD with authentication

```ts
// src/server/routers/posts.ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const postsRouter = createTRPCRouter({
  getAll: publicProcedure.query(({ ctx }) =>
    ctx.prisma.post.findMany({
      where: { published: true },
      include: { author: { select: { name: true } } },
    }),
  ),

  create: protectedProcedure
    .input(
      z.object({ title: z.string().min(1), content: z.string().optional() }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.post.create({ data: { ...input, authorId: ctx.user.id } }),
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const post = await ctx.prisma.post.findFirst({
        where: { id, authorId: ctx.user.id },
      });
      if (!post) throw new TRPCError({ code: 'FORBIDDEN' });
      return ctx.prisma.post.update({ where: { id }, data });
    }),
});
```

#### Next.js App Router integration

```ts
// src/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/api/root';
import { createContext } from '@/server/api/context';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

#### Client-side usage

```ts
// src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/api/root';

export const trpc = createTRPCReact<AppRouter>();

const PostList = () => {
  const { data: posts, isLoading } = trpc.post.findMany.useQuery();
  const createPost = trpc.post.createOne.useMutation();
  if (isLoading) return <div>Loading...</div>;
  return (
    <div>
      {posts?.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
};
```

</details>

---

## 🔍 Troubleshooting, performance, FAQ

<details>
<summary>Show troubleshooting, performance tips, and FAQ</summary>

### Common issues

**Error: Cannot find module '../context'**

- Ensure your `contextPath` is correct relative to the output directory.
- Check that your context file exports a `Context` type.

**TypeScript errors in generated routers**

- Ensure dependencies are installed and up to date.
- Verify your tRPC context is properly typed.
- Ensure `strict: true` is enabled in `tsconfig.json`.

**Generated routers not updating**

- Run `npx prisma generate` after modifying your schema.
- Check that the generator is properly configured in `schema.prisma`.
- Clear your build cache and regenerate.

**Zod validation errors**

- Ensure Zod 4.0+ is installed.
- Check that input schemas match your Prisma model types.
- For DateTime validation errors with JSON APIs, set `dateTimeStrategy: "coerce"` to accept date strings.

### Performance considerations

For large schemas (50+ models):

- Use selective generation with model hiding.
- Split routers into multiple files.
- Consider lazy loading routers.

Build times:

- Add generated files to `.gitignore`.
- Use parallel builds where possible.
- Cache dependencies in CI.

### FAQ

Q: Can I customize the generated router validation rules?
A: Routers are generated based on your Prisma schema constraints; change your Prisma model definitions to affect validation.

Q: Does this work with Prisma Edge Runtime?
A: Yes.

Q: What databases are supported?
A: All Prisma‑compatible databases.

Q: How are enums handled?
A: Enums are converted to Zod enums and included in validation.

Q: Can I exclude fields from validation?
A: Use Prisma's `@ignore` or `@@Gen.model(hide: true)`.

### Getting help

- 🐛 Bug reports: https://github.com/omar-dulaimi/prisma-trpc-generator/issues/new
- 💡 Feature requests: https://github.com/omar-dulaimi/prisma-trpc-generator/issues/new
- 💬 Discussions: https://github.com/omar-dulaimi/prisma-trpc-generator/discussions

</details>

---

## 🤝 Contributing

<details>
<summary>Show contributing guide</summary>

### Development setup

1. Fork and clone the repository

```bash
git clone https://github.com/your-username/prisma-trpc-generator.git
cd prisma-trpc-generator
```

2. Install dependencies (requires Node.js 20.19.0+; 22.x recommended, this repo uses pnpm)

```bash
pnpm install
```

3. Build/generate

```bash
pnpm run generate
```

4. Run tests

```bash
pnpm test
```

### Testing

- Unit tests: core transformation logic
- Integration tests: end‑to‑end router generation
- Multi‑provider tests: all database providers
- Performance tests: large schema handling

Run specific test suites

```bash
pnpm test --silent
pnpm run test:integration
pnpm run test:coverage
pnpm run test:comprehensive
```

### Contribution guidelines

1. Create an issue for bugs or feature requests.
2. Follow the existing code style (ESLint + Prettier).
3. Add tests for new functionality.
4. Update documentation as needed.
5. Submit a PR with a clear description.

### Code style

```bash
pnpm run lint
pnpm run format
```

### Release process

Semantic versioning

- Patch: bug fixes and small improvements
- Minor: new features and enhancements
- Major: breaking changes

</details>

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 🔗 Related projects

- [prisma-zod-generator](https://github.com/omar-dulaimi/prisma-zod-generator) — Generate Zod schemas from Prisma schema
- [prisma-trpc-shield-generator](https://github.com/omar-dulaimi/prisma-trpc-shield-generator) — Generate tRPC Shield permissions from Prisma schema
- [tRPC Shield](https://github.com/omar-dulaimi/trpc-shield) — Permission system for tRPC
- [Prisma](https://github.com/prisma/prisma) — Database toolkit and ORM
- [tRPC](https://trpc.io) — End‑to‑end typesafe APIs made easy

## 🙏 Acknowledgments

- [Prisma](https://github.com/prisma/prisma) — Modern database toolkit
- [tRPC](https://trpc.io) — End‑to‑end typesafe APIs
- [Zod](https://github.com/colinhacks/zod) — TypeScript‑first schema validation
- All [contributors](https://github.com/omar-dulaimi/prisma-trpc-generator/graphs/contributors)

---

<p align="center">
  <strong>Made with ❤️ by</strong>
  <a href="https://github.com/omar-dulaimi">Omar Dulaimi</a>
  <br />
  <em>⚡ Accelerating tRPC development, one schema at a time</em>
</p>
