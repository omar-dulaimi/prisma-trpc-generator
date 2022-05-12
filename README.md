[![npm version](https://badge.fury.io/js/prisma-trpc-generator.svg)](https://badge.fury.io/js/prisma-trpc-generator)
[![npm](https://img.shields.io/npm/dt/prisma-trpc-generator.svg)](https://www.npmjs.com/package/prisma-trpc-generator)
[![HitCount](https://hits.dwyl.com/omar-dulaimi/prisma-trpc-generator.svg?style=flat)](http://hits.dwyl.com/omar-dulaimi/prisma-trpc-generator)
[![npm](https://img.shields.io/npm/l/prisma-trpc-generator.svg)](LICENSE)

<p align="center">
  <a href="https://github.com/omar-dulaimi/prisma-trpc-generator">
    <img src="https://raw.githubusercontent.com/omar-dulaimi/prisma-trpc-generator/master/logo.png" alt="Logo" width="200" height="200">
  </a>
  <h3 align="center">Prisma tRPC Generator</h3>
  <p align="center">
    A Prisma generator that automates creating your tRPC routers from your Prisma schema.
    <br />
    <a href="https://github.com/omar-dulaimi/prisma-trpc-generator#additional-options"><strong>Explore the options »</strong></a>
    <br />
    <br />
    <a href="https://github.com/omar-dulaimi/prisma-trpc-generator/issues/new?template=bug_report.yml">Report Bug</a>
    ·
    <a href="https://github.com/omar-dulaimi/prisma-trpc-generator/issues/new?template=feature_request.md">Request Feature</a>
  </p>
</p>

## Table of Contents

- [About The Project](#about-the-project)
- [Installation](#installation)
- [Usage](#usage)
- [Additional Options](#additional-options)
- [Community](#community)

# About The Project

Automatically generate fully implemented tRPC routers from your [Prisma](https://github.com/prisma/prisma) Schema. This includes routers, app router and of course all input schemas using [Zod](https://github.com/colinhacks/zod). Updates every time `npx prisma generate` runs.

# Installation

Using npm:

```bash
 npm install prisma-trpc-generator
```

Using yarn:

```bash
 yarn add prisma-trpc-generator
```

# Usage

1- Star this repo 😉

2- Add the generator to your Prisma schema

```prisma
generator trpc {
  provider       = "prisma-trpc-generator"
  withMiddleware = false
}
```

3- Enable strict mode in `tsconfig` as it is required by Zod, and considered a Typescript best practice

```ts
{
  "compilerOptions": {
    "strict": true
  }
}

```

4- Running `npx prisma generate` for the following schema.prisma

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

will generate

![tRPC Routers](https://raw.githubusercontent.com/omar-dulaimi/prisma-trpc-generator/master/trpcRouters.png)

5- Don't forget to supply your `createContext` function inside `./routers/helpers/createRouter.ts`. You should check the official [tRPC docs](https://trpc.io/docs/context) for reference.

# Additional Options

| Option           |  Description                                                 | Type     |  Default      |
| ---------------- | ------------------------------------------------------------ | -------- | ------------- |
| `output`         | Output directory for the generated routers and zod schemas   | `string` | `./generated` |
| `withMiddleware` | Attaches a global middleware that runs before all procedures | `string` | `true`        |

Use additional options in the `schema.prisma`

```prisma
generator trpc {
  provider       = "prisma-trpc-generator"
  output         = "./trpc"
  withMiddleware = false
}
```
# Community
[![Stargazers repo roster for @omar-dulaimi/prisma-trpc-generator](https://reporoster.com/stars/omar-dulaimi/prisma-trpc-generator)](https://github.com/omar-dulaimi/prisma-trpc-generator/stargazers)
