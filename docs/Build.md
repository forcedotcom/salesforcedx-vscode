# Build

## Open Source

You should plan to publish your extension in a public, OSS repo. Remember `.vsix` format is basically a zip file and people can inspect your code (and un-minify it) whether it's in a public repo or not, so no secrets are possible.

## Conventions

follow the code structure of this repo

- /src (.ts)
- /out (compiled source, .js and .d.ts)
- /dist (bundled source)

Pipeline: src → out (tsc) → dist (esbuild). Shared configs: [scripts/bundling/](../scripts/bundling/).

## Monorepo Management

This repo uses npm workspaces with wireit for task orchestration. You don't have to use the same setup if it's not necessary for your project

## Versioning

This repo has a consistent version across all extensions and packages. You don't need to do that, we probably stop doing that eventually.

## Bundling

VSCode strongly recommends bundling your code (taking tons of js files and node_modules and outputting a single minified file). This repo uses [esbuild](https://esbuild.github.io/) and you probably should too.

Bundle from compiled (`out/`), not source. Shared configs: [node.mjs](../scripts/bundling/node.mjs), [web.mjs](../scripts/bundling/web.mjs). Desktop: `dist/index.js`. **Web:** `dist/web/index.js`; use `commonConfigBrowser` from web.mjs.

When you add a dependency, run the bundling process to make sure that your dep is bundleable. If your extension is desktop-only, you **can** put unbundleable dependencies in `external` property of the esbuild config which tells esbuild to not bundle that (ship it "as is" in node_modules). This can make extensions really big, and **is not possible at all on the web.** If you want your extension to work on the web, you'll have to bundle all the dependencies.

**Web only:** `external: ['vscode']` — no other externals; web cannot ship unbundled node_modules.

**Web:** [esbuild-plugin-copy](https://www.npmjs.com/package/esbuild-plugin-copy) for static assets; `globbyOptions: { dot: true }` when copying templates with dot files.

**Web:** Manifest for extension assets — `vscode.workspace.fs.readDirectory` not supported on HTTPS extension URIs. Build-time manifest (e.g. services `generateTemplatesManifest`) + runtime `readFile` per path. Services template hydration runs once (`Effect.once`); templates root is memoized (`Effect.cached`). See [templateService.ts](../packages/salesforcedx-vscode-services/src/core/templateService.ts).

**ESBUILD_PLATFORM:** Bundle-time define (web.mjs injects `'web'` or `'node'`). Not a runtime check — value baked in at bundle; dead branches tree-shaken. Examples: [connectionService](../packages/salesforcedx-vscode-services/src/core/connectionService.ts), [templateService](../packages/salesforcedx-vscode-services/src/core/templateService.ts), [soql LSP client](../packages/salesforcedx-vscode-soql/src/lspClient/client.ts).

You can do this in libraries, too, to have their bundled version add or drop web-specific code. Example: [sfdx-core fs.ts](https://github.com/forcedotcom/sfdx-core/blob/main/src/fs/fs.ts) (web vs node branching), [scripts/build.mjs](https://github.com/forcedotcom/sfdx-core/blob/main/scripts/build.mjs) (bundle-time `define`).

**Polyfills:** [web.mjs](../scripts/bundling/web.mjs) provides process, buffer, fs, path, crypto, etc. Prefer existing polyfills. If new deps need polyfills, add in your esbuild config.

## package.json

**Entry points**

- `main`: desktop, `dist/index.js`
- `browser`: **web only**, `dist/web/index.js` — VSCode web host uses this instead of main. See [VSCode web extensions](https://code.visualstudio.com/api/extension-guides/web-extensions).
- `types`: when another package/extension has this as a devDependency and imports its API, point to `out/src/index.d.ts` so TypeScript can resolve types

**activationEvents**

Prefer specific over greedy (`*`). **Web/virtual FS:** `workspaceContains:sfdx-project.json` does not trigger for memfs workspaces even after fs init. Add `onFileSystem:memfs` for web. Example: metadata uses both.

**run:web script**

Invokes `vscode-test-web` with `extensionDevelopmentPath` and `extensionPath`. Both load from built `dist/` (not vsix). Use --watch for hot reload (will restart server).

- `extensionDevelopmentPath`: the one extension you're developing — gets debug.
- `extensionPath`: extension dependencies — loaded as installed extensions. Only one dev extension; the rest go here.
- Each package's run:web differs by which extension is dev vs path (e.g. org-browser: dev=self, path=services,metadata).
- `vscode:bundle:local` (used by run:web): injects settings/org credentials. See [QA](./QA.md).

**Adding run:web to a package**

1. Add `"run:web": "wireit"` to scripts.
2. Add wireit config. Example (org-browser developing self, services + metadata as deps):

```json
"run:web": {
  "command": "npx vscode-test-web --browserType=chromium --browserOption=--disable-web-security --browserOption=--remote-debugging-port=9222 --extensionDevelopmentPath . --extensionPath ../salesforcedx-vscode-services --extensionPath ../salesforcedx-vscode-metadata --open-devtools --port 3001 --quality stable --verbose --printServerLog",
  "service": true,
  "dependencies": [
    "vscode:bundle:local",
    "../salesforcedx-vscode-services:vscode:bundle:local",
    "../salesforcedx-vscode-metadata:vscode:bundle:local"
  ],
  "files": []
}
```

- `extensionDevelopmentPath .` = this package (dev). Paths relative to package dir.
- `--extensionPath ../pkg-name` — repeat for each extension dependency. Order can matter for activation.
- Wireit deps: `vscode:bundle:local` for self + each extension in extensionPath (enables settings/org injection).

**commonConfigBrowser usage**

Import and spread in esbuild config. Override entryPoints, outdir, plugins as needed:

```javascript
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';

const browserBuild = await build({
  ...commonConfigBrowser,
  external: ['vscode'],
  entryPoints: ['./out/src/index.js'],
  outdir: './dist/web',
  metafile: true // hand this file to https://esbuild.github.io/analyze/ to check your bundling
});
```

Examples: [org-browser](../packages/salesforcedx-vscode-org-browser/esbuild.config.mjs), [services](../packages/salesforcedx-vscode-services/esbuild.config.mjs).

## Package

You'll need a `.vscodeignore` file (to keep unwanted code out of the package).

**.vscodeignore:** exclude out/, src/, test/, node_modules, **/\*.map, build configs, `../../**`, `../\*\*`. Examples: [services](../packages/salesforcedx-vscode-services/.vscodeignore), [soql](../packages/salesforcedx-vscode-soql/.vscodeignore).

**Resources (principle):** Anchor all runtime resource resolution at the extension root (where package.json lives). Use `extensionContext.extensionUri` + `Utils.joinPath` — never `__dirname` or paths relative to the entry file. That way it doesn't matter whether the entry is `dist/index.js` or `dist/web/index.js`; the extension root is the same. `asAbsolutePath` for Node-only paths (e.g. LSP server module) — **desktop only.**

**Webview resources:** HTML in webviews must use `webview.asWebviewUri()` for script/style/img; CSP meta with `webview.cspSource`. Other dist assets (Worker, workspace.fs) don't need this.

**vscode:package**

**Good:** `vsce package --allow-package-all-secrets`; Wireit deps run in parallel. No `packaging` stanza — package.json is not mutated at package time. Example: [soql](../packages/salesforcedx-vscode-soql/package.json).

- downside: managing that ignore file. An alternative might be to ignore `*` and the unignore

**Legacy:** `ts-node scripts/vsce-bundled-extension.ts`; uses `packaging` stanza to mutate package.json (main, dependencies, devDependencies) at package time. Runs sequentially (`WIREIT_PARALLEL=1`) due to chdir usage. Example: [core](../packages/salesforcedx-vscode-core/package.json).

Prefer the modern approach: parallel execution, no package-time mutation, simplicity.

This will generate vsix. Use those for manual QA and for your end-to-end tests to prevent "works on my machine" but some bundling/packaging configuration messes it up.

## Publish

To publish, you'll need a publish token shared with your repo. At a minimum, you'll want to publish your extension to Microsoft's vscode marketplace. We also publish extensions to the [openVsx](https://open-vsx.org/) registry.

## See Also

- [Testing](./Testing.md) - use vsix packages for e2e tests
- [contributing/publishing.md](../contributing/publishing.md) - detailed publishing process for this repo
