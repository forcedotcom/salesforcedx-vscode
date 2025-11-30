<!-- f9771a9f-91c1-4c29-a2aa-7ca1efaee510 9b9864e5-0399-4f46-b8ec-467d8964a101 -->
# Migrate from nx/Lerna to Wireit

## Summary

Remove Lerna and nx. Use wireit for caching with cross-package deps. Internal deps become `*`. Root scripts use wireit to orchestrate packages.

## Wireit Recipes

Following [wireit recipes](https://github.com/google/wireit?tab=readme-ov-file#recipes):

**TypeScript:**

```json
"compile": {
  "command": "tsc --build --pretty",
  "clean": "if-file-deleted",
  "files": ["src/**/*.ts", "tsconfig.json"],
  "output": ["out/**", ".tsbuildinfo"]
}
```

- `--build` for incremental, `clean: "if-file-deleted"` for fast rebuilds
- Include `.tsbuildinfo` in output for caching

**ESLint:**

```json
"lint": {
  "command": "eslint --color --cache --cache-location .eslintcache .",
  "files": ["src/**/*.ts", "eslint.config.mjs"],
  "output": []
}
```

- `--cache` so only changed files linted

---

## Phase 1: Base Packages (no internal deps)

- `eslint-local-rules`, `salesforcedx-utils`, `salesforcedx-vscode-i18n`
```json
{
  "scripts": { "compile": "wireit", "test": "wireit", "lint": "wireit" },
  "wireit": {
    "compile": {
      "command": "tsc --build --pretty",
      "clean": "if-file-deleted",
      "files": ["src/**/*.ts", "tsconfig.json"],
      "output": ["out/**", ".tsbuildinfo"]
    },
    "test": {
      "command": "jest --coverage",
      "dependencies": ["compile"],
      "files": ["src/**/*.ts", "test/**/*.ts"],
      "output": ["coverage"]
    },
    "lint": {
      "command": "eslint --color --cache --cache-location .eslintcache .",
      "files": ["src/**/*.ts", "eslint.config.mjs"],
      "output": []
    }
  }
}
```


## Phase 2: Middle-Tier Packages

- `salesforcedx-utils-vscode`, `salesforcedx-sobjects-faux-generator`, debuggers, visualforce servers

Cross-package deps:

```json
"compile": {
  "command": "tsc --build --pretty",
  "clean": "if-file-deleted",
  "dependencies": ["../salesforcedx-utils:compile"],
  "files": ["src/**/*.ts", "tsconfig.json"],
  "output": ["out/**", ".tsbuildinfo"]
}
```

## Phase 3: Extension Packages

All `salesforcedx-vscode-*`. Add `bundle:extension` and `copy:files` where needed.

**copy:files example** (`salesforcedx-vscode-apex`):

```json
"copy:files": {
  "command": "shx mkdir -p grammars && shx cp ../../node_modules/@salesforce/apex-tmlanguage/grammars/*.tmLanguage ./grammars/",
  "files": [],
  "output": ["grammars/*.tmLanguage"]
},
"bundle:extension": {
  "command": "node ./esbuild.config.mjs",
  "dependencies": ["compile", "copy:files"],
  "files": ["esbuild.config.mjs", "out/**"],
  "output": ["dist"]
}
```

**Cross-package bundle** (`salesforcedx-vscode-apex-debugger`):

```json
"bundle:extension": {
  "dependencies": ["bundle:extension:build", "../salesforcedx-apex-debugger:bundle:debugger"],
  "command": "cp ../salesforcedx-apex-debugger/dist/apexDebug.js ./dist/",
  "output": ["dist/apexDebug.js"]
}
```

## Phase 4: Internal Deps to `*`

```diff
- "@salesforce/salesforcedx-utils": "65.6.0"
+ "@salesforce/salesforcedx-utils": "*"
```

## Phase 5: Root package.json

```json
{
  "scripts": { "compile": "wireit", "test": "wireit", "lint": "wireit" },
  "wireit": {
    "compile": {
      "dependencies": ["./packages/salesforcedx-utils:compile", "...all packages"]
    }
  }
}
```

Remove `postcompile`, `lerna` devDep. Add `wireit` devDep.

## Phase 6: Delete lerna.json, nx.json

Update `create-release-branch.js` to remove `lerna version` call.

## Phase 7: GitHub Actions

**Add caching** to `unitTestsLinux.yml`, `unitTestsWindows.yml`, `buildAll.yml`:

```yaml
- uses: google/wireit@setup-github-actions-caching/v2
- run: npm run compile
  env:
    WIREIT_CACHE: github
```

**Remove lerna** from `createReleaseBranch.yml`, `publishBetaRelease.yml`.

**E2E workflows** - replace `npx lerna run --scope` with `npm run -w`:

```diff
- npx lerna run bundle:extension --scope salesforcedx-vscode-metadata
+ npm run bundle:extension -w salesforcedx-vscode-metadata
```

## Phase 8: Cleanup

- Remove `--skip-nx-cache` refs
- Update contributing docs
- Regenerate package-lock.json

### To-dos

- [ ] Add wireit config to base packages (utils, i18n, eslint-local-rules)
- [ ] Add wireit to middle-tier packages (utils-vscode, sobjects-faux-generator, debuggers)
- [ ] Add wireit to all vscode-* extension packages
- [ ] Convert internal workspace dependencies to *
- [ ] Update root package.json scripts from lerna run to npm -ws
- [ ] Delete lerna.json, nx.json, remove lerna from devDeps
- [ ] Remove lerna version from create-release-branch.js
- [ ] Add wireit caching to GitHub Actions workflows
- [ ] Verify compile/test/lint work with caching