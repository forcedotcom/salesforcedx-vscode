<!-- fbe93b48-81d1-444c-a77d-baeffe114083 f514cdb1-3f8d-4f50-ae4f-329a43c9a1d1 -->

# Simplify VSIX Packaging for salesforcedx-vscode-org

## Current vs Target State

**Current (org):**

- Bundles from `./src/index.ts` → `./dist/index.js`
- `main: ./out/src` in package.json
- Has `packaging` section defining assets/updates
- `vscode:package` runs complex `vsce-bundled-extension.ts` script
- .vscodeignore has outdated rxjs/jsforce patterns

**Target (like org-browser):**

- Bundles from `./out/src/index.js` → `./dist/index.js`
- `main: ./dist/index.js` in package.json
- No `packaging` section
- `vscode:package` runs simple `vsce package`
- .vscodeignore has clean modern pattern

## Changes Required

### 1. Update esbuild.config.mjs

Change entry point from TypeScript source to compiled JavaScript:

- `entryPoints: ['./src/index.ts']` → `entryPoints: ['./out/src/index.js']`

### 2. Update package.json

- Change `main: ./out/src` → `main: ./dist/index.js`
- Remove entire `packaging` section (lines 57-73)
- Change `vscode:package: ts-node ../../scripts/vsce-bundled-extension.ts` → `vscode:package: vsce package`

### 3. Update .vscodeignore

Replace outdated file (has rxjs/jsforce-specific ignores from old bundling) with org-browser pattern:

```
.vscode/**
.vscode-test/**
out/**
test/**
src/**
**/*.map
.gitignore
tscon
fig.json

jest.config.js
esbuild.config.mjs
junit*
node_modules
coverage

../../**
../**
```

Note: Excludes org-browser-specific items (.vscode-web, dist/_-metafile.json, playwright_.ts, design, context)

### 4. Verify build chain

Workflow: compile → bundle:extension → vscode:package

- `npm run compile` produces `out/src/index.js`
- `npm run bundle:extension` bundles to `dist/index.js`
- `npm run vscode:package` packages with vsce using `dist/` as entrypoint

### To-dos

- [ ] Change esbuild entry point from ./src/index.ts to ./out/src/index.js
- [ ] Update package.json: change main to ./dist/index.js, remove packaging section, simplify vscode:package script
- [ ] Replace .vscodeignore with org-browser pattern (excluding org-browser-specific items)
- [ ] Run compile, bundle:extension, and test the simplified packaging workflow
