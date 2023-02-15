[![npm version](https://badge.fury.io/js/prisma-trpc-generator.svg)](https://badge.fury.io/js/prisma-trpc-generator)
[![npm](https://img.shields.io/npm/dt/prisma-trpc-generator.svg)](https://www.npmjs.com/package/prisma-trpc-generator)
[![HitCount](https://hits.dwyl.com/omar-dulaimi/prisma-trpc-generator.svg?style=flat)](http://hits.dwyl.com/omar-dulaimi/prisma-trpc-generator)
[![npm](https://img.shields.io/npm/l/prisma-trpc-generator.svg)](LICENSE)

<p align="center">
  <a href="https://github.com/omar-dulaimi/prisma-trpc-generator">
    <img src="https://raw.githubusercontent.com/omar-dulaimi/prisma-trpc-generator/master/logo.png" alt="Logo" width="200" height="200"/>
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

<p align="center">
  <a href="https://www.buymeacoffee.com/omardulaimi">
    <img src="https://cdn.buymeacoffee.com/buttons/default-black.png" alt="Buy Me A Coffee" height="41" width="174"/>
  </a>
</p>

## Table of Contents

- [About The Project](#about-the-project)
- [Supported Prisma Versions](#supported-prisma-versions)
    - [Prisma 4](#prisma-4)
    - [Prisma 2/3](#prisma-23)
- [Supported tRPC Versions](#supported-trpc-versions)
    - [tRPC 10](#trpc-10)
    - [tRPC 9](#trpc-9)
- [Installation](#installation)
- [Usage](#usage)
- [Customizations](#customizations)
  - [Skipping entire models](#skipping-entire-models)
- [Additional Options](#additional-options)

# About The Project

Automatically generate fully implemented tRPC routers from your [Prisma](https://github.com/prisma/prisma) Schema. This includes routers, app router and of course all input schemas using [Zod](https://github.com/colinhacks/zod). Updates every time `npx prisma generate` runs.

# Supported Prisma Versions

### Prisma 4

- 0.2.0 and higher

### Prisma 2/3

- 0.1.12 and lower

# Supported tRPC Versions

### tRPC 10

- 0.8.0 and higher

### tRPC 9

- 0.7.2 and lower

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
  withShield     = false
  shieldPath     = "../src/shield"
  contextPath       = "../src/context"
  trpcOptionsPath   = "../src/trpcOptions"
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

5- Make sure you have a valid `Context` file, as specified in `contextPath` option. The official [Context](https://trpc.io/docs/context) for reference.

6- Optionally, you can specify a `trpcOptionsPath` to set various tRPC options (like transformer, error formatter, etc). Find about all possible options [here](https://trpc.io/docs/router#advanced-usage).

```ts
import { ZodError } from 'zod';

export default {
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

# Customizations

## Skipping entire models

```prisma
/// @@Gen.model(hide: true)
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}
```

# Additional Options

| Option              | Description                                                                | Type      | Default                       |
| ------------------- | -------------------------------------------------------------------------- | --------- | ----------------------------- |
| `output`            | Output directory for the generated routers and zod schemas                 | `string`  | `./generated`                 |
| `withMiddleware`    | Attaches a global middleware that runs before all procedures               | `boolean` | `true`                        |
| `withShield`        | Generates a tRPC Shield to use as a permissions layer                      | `boolean` | `true`                        |
| `shieldPath`        | Uses your existing tRPC Shield as a permissions layer                      | `string`  |                               |
| `contextPath`       | Sets the context path used in your routers                                 | `string`  | `../../../../src/context`     |
| `trpcOptionsPath`   | Sets the tRPC instance options                                             | `string`  | `../../../../src/trpcOptions` |
| `isGenerateSelect`  | Enables the generation of Select related schemas and the select property   | `boolean` | `false`                       |
| `isGenerateInclude` | Enables the generation of Include related schemas and the include property | `boolean` | `false`                       |

Use additional options in the `schema.prisma`

```prisma
generator trpc {
  provider           = "prisma-trpc-generator"
  output             = "./trpc"
  withMiddleware     = false
  withShield         = false
  shieldPath        = "../shield"
  contextPath        = "../context"
  trpcOptionsPath        = "../trpcOptions"
  isGenerateSelect   = true
  isGenerateInclude  = true
}
```
