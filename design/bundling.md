# Bundling

VSCode extensions should be bundled. For node/desktop, its an optimization. For web, it's mandatory.

Bundling here means (over-simplified): use a tool (ex: esbuild) to smash all the code from different folders and its dependencies from `node_modules` into one giant `index.js` file. For web extensions, it can involve polyfills for node APIs, filesystem, etc that don't exist in the browser.

## Prior work

The original round of bundling bundled most of the DXFoundation libraries (sfdx-core, SDR, STL, apex-node) and publishing them as separate packages (`core-bundle` instead of `core`) for use in the extensions.

## Current design

1. no libraries publish bundles
1. all bundling happens here in the extensions repo during build-time
1. non-extensions (ex: `*-utils`, LSs, debuggers, `faux-generator`) do not bundle
1. bundles are created from compiled js code (`out/src`), not from src [this is worth reconsidering. It's relatively cheap given `nx` cache, and can be useful for transformations and replacements].
1. bundles create the `dist` folder
1. everything the extension needs should be in `dist`. There can be multiple files.
1. [cross-package dependencies](#cross-package-dependencies) are bundled by the consumer's bundle step, not an intermediate bundle step
1. extensions say their `main` is the bundled `/dist/index.js` and not compiled code from `out`

## API sharing

`vscode-core` and `vscode-apex` extensions are used as `extensionDependencies` by other extensions. They export types for their API. To do that, they need to provide in their `package.json` a `types` property that points to their compiled `out/src/index.d.ts`. Most extensions don't need this.

## Cross-package dependencies

### example 1: ext with language server

an extension (`salesforcedx-vscode-visualforce`) has a language server (`salesforcedx-visualforce-language-server`) here in the monorepo.

- The LS compiles but does not bundle ([package.json](../packages/salesforcedx-visualforce-language-server/package.json))
- the extension [bundles](../packages/salesforcedx-vscode-visualforce/esbuild.config.mjs) the server into a separate file in its `dist` from its compile output
- the vf-markup-language-server package is used by the vf-language-server as a dependency, so it's automatically bundled into `dist/server`

[the 2 debuggers use the same pattern]

### example 2: ext with ui components and language server

(`salesforcedx-vscode-soql`) has 2 WebView packages (UIs for the builder and data views) and a language server, none of which live in this repo.

These UI components need to be inside `dist` and are already "bundled" (a single js file, plus the html/css stuff)

the `esbuild-plugin-copy` is used to [move files](../packages/salesforcedx-vscode-soql/esbuild.config.mjs) from node_modules packages, and the LS is bundled from compiled as a separate step like example 1.

## external modules

esbuild docs on [`external`](https://esbuild.github.io/api/#external)

if everything goes well, only `vscode` is `external` (that library is types-only but they represent the vscode API that the extensions use at runtime).

`vscode-lwc` has some **extra** `external` stuff because it has some dependencies that use dynamic imports/`require` that can't be statically known at bundle-time. Marking them "external" preserves those.

- `tern` used by the Aura-LS. That's some ancient code
- jsonpath, jsonc-parser [used in a lot ext]

## pino bundling

much of the complexity of the previous bundling solution was caused by the sfdx-core library's use of Pino for logging. For perf reasons, pino runs in a worker thread, with a path relative to the Logger (that path gets changed during bundling).

The simplest approach for extensions is to prevent that from being used at all. The esbuild `define` property lets you pass env vars at bundle time. They don't affect the runtime code, the change the calculation of "dead code" during bundle and prevent the worker thread code from being reached.
