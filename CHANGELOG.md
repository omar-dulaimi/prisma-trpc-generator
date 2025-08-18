## [2.3.0](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v2.2.1...v2.3.0) (2025-08-18)

### 🚀 Features

* auth presets, config wiring, and README restructure\n\n- add docs/usage/auth.md\n- add prisma/trpc.config.json\n- update prisma context and schema (requestId/tenancy hooks)\n- extend config and generator for new options\n- restructure README (clickable ToC, collapsible sections) ([0508436](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/05084368dff2a9053a05d5b826a8dbd827028768))
* **postman:** skeleton example payloads in Postman collection with configurable examples flag (postman.examples/postmanExamples) ([994f7c6](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/994f7c69af732d46061ff917286fae5a0f2057e5))
* **request-id:** add optional requestId middleware + logging (gated by config); add example ([9af267f](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/9af267f122a91ce4918cfb404aeedc5a8e80b153))
* **services:** add tenancy + soft-delete codegen and examples ([e09abe9](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/e09abe9091037dadd01b90ba1c753505b7c62744))

### 🐛 Bug Fixes

* **lint:** remove no-useless-escape violations and stabilize scaffold regex escaping in prisma-generator; generation now passes lint ([d940e20](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/d940e20c3f5df0c892afe18ade40f8bcde04d1a8))

## [2.2.1](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v2.2.0...v2.2.1) (2025-08-18)

### 🐛 Bug Fixes

* upgrade prisma-zod-generator to 1.12.4 and align groupBy _count typing; ensure AndReturn schemas strict; wire count schemas ([89206e9](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/89206e905d1a5c9aa715c18e4fa54ad0449d7e07))

## [2.2.0](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v2.1.2...v2.2.0) (2025-08-18)

### 🚀 Features

* **generator:** boolean-like config, new actions (create/updateManyAndReturn, count), schema import base and procedure mapping ([7a95b4b](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/7a95b4bf0553514f39c83fb966d12060b88379df))
* **generator:** write Zod schemas to outputDir/schemas; provider-aware extra ops; shield default notice; output path resolution ([e0384cc](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/e0384cc093edec44cc3163912b56adeb4110a17c))

## [2.1.2](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v2.1.1...v2.1.2) (2025-08-07)

### 🐛 Bug Fixes

* enhance test schema with Bytes field and expose Book model ([c81500d](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/c81500d48a619be76ea19f0d1c6026e099f37152))
* update prisma-zod-generator to v1.2.0 ([5882db0](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/5882db06af4f3a2e63bf42f8e8eb3e3c616c09cf))

### 📚 Documentation

* restructure and improve README content ([9630e42](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/9630e42bec6bf6ce4f4ecf9fc96b5542f69aaf05))

### ♻️ Code Refactoring

* improve context types and imports ([288d963](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/288d963c6b208ced221247cfdc4406d5cf4a6a72))

## [2.1.1](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v2.1.0...v2.1.1) (2025-07-26)

### 📚 Documentation

* add Prisma Client generator preview features section ([79af40f](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/79af40fe2f10df3143d8285bb366ba5db104d263))

## [2.1.0](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v2.0.5...v2.1.0) (2025-07-26)

### 🚀 Features

* add support for prisma-client generator preview feature ([0994468](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/0994468010ca7142ae5c66d4e148069f081a1735))

### 🐛 Bug Fixes

* remove unused variable in prisma-client-preview test ([3308958](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/33089583cc062f76c28c960629bb8b464def3ade))

## [2.0.5](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v2.0.4...v2.0.5) (2025-07-25)

### 🐛 Bug Fixes

* update prisma-zod-generator to 1.0.7 ([2fea61b](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/2fea61b7c65e74b52f95f910c9d2000745581560))

## [2.0.4](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v2.0.3...v2.0.4) (2025-07-25)

### 🐛 Bug Fixes

* update prisma-zod-generator to 1.0.6 ([aa6c272](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/aa6c2725326a573129ffda0ed1212faa0ea4338f))

## [2.0.3](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v2.0.2...v2.0.3) (2025-07-25)

### 📚 Documentation

* remove hardcoded version references from README ([713fc84](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/713fc842e510471acafa546be3db350b3cdd37f3))

## [2.0.1](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v2.0.0...v2.0.1) (2025-07-23)

### 🐛 Bug Fixes

* update version to 2.0.0 for stable release ([1a6d251](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/1a6d2515fc1a89821cb982c1c7dbb4d1ab3c1019))

## [1.1.1](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v1.1.0...v1.1.1) (2025-07-23)

### 🐛 Bug Fixes

* package.json repo ([c770336](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/c770336aa25909164395d57a13d7c89c68d7603a))

## [1.1.0](https://github.com/omar-dulaimi/prisma-trpc-generator/compare/v1.0.0...v1.1.0) (2025-07-23)

### 🚀 Features

* enhance documentation with improved error handling info ([eff11e6](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/eff11e6edf92ef50da20a4dcae5332637c8e5796))

## 1.0.0 (2025-07-23)

### 🚀 Features

* allow optional usage of input validation ([5eb38af](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/5eb38af7f41fab2b4bce9f4e3a989acbb0ecf146)), closes [#70](https://github.com/omar-dulaimi/prisma-trpc-generator/issues/70)
* implement semantic release workflow with specified dependency versions ([58d30de](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/58d30de4f3a8fbf89ee3709ed02433512c5f54da))
* optional generateModelActions ([84e1aa6](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/84e1aa65df7be49a41fa6a67109574d1de77108d))
* **shield:** withShield optional string path ([209ced7](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/209ced73e6c6f4f83352dd641548ecfa14873583))

### 🐛 Bug Fixes

* add GitHub Actions permissions for semantic release ([ea667af](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/ea667af6859ae9636fa7405881b349ffa1c57322))
* include tests directory in tsconfig.json ([7ac7ed2](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/7ac7ed28f8c0f82273065dc12f05da5fd00ccefd))
* resolve linting errors and test failures ([620d315](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/620d315e9590319af385b4cf0e2f4f9229c99d3a))
* separate TypeScript configs for build and linting ([6cdceb7](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/6cdceb74f8288587c38f044b65f6e2c2176c1e23))
* **shield:** only generate shield when config true ([2a7d22e](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/2a7d22ee899f94146df58bf62e6df524cc63b256))
* update package-lock.json for semantic-release dependencies ([0640083](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/064008364cc761eaf6525a0e649a86ea6bfb19d9))
* update release workflow to use basic tests ([83462c3](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/83462c333f577b114ab2683994526eaaa32f99eb))

### 📚 Documentation

* enhance README with comprehensive modern design and add commit guidelines ([7bf5326](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/7bf5326d99c3ca4f27fa580ed6c2310e454a079d))
* enhance README with modern stylish design ([4f8dcc8](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/4f8dcc8e7e7660183c4c95f705ba8984db791140))
* modernize README and emphasize beta version ([23fd3f9](https://github.com/omar-dulaimi/prisma-trpc-generator/commit/23fd3f9c1f27d4cdf477c8cb3ca7a3de74289362))
