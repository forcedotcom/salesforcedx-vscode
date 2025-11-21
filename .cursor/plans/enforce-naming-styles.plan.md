<!-- c92f3e91-eaf1-49ac-9aac-25da00a1a5c6 f9dd4a0f-57e5-44f0-ace9-69753b9c68d7 -->
# Enable Naming Convention ESLint Rules

## Context

The codebase has naming conventions documented in `contributing/coding-guidelines.md` but `@typescript-eslint/naming-convention` is currently disabled (line 198 in `eslint.config.mjs`). Based on grep analysis:

- **2 lowercase type exports** need fixing
- **17 enums** exist (15 files) - need to check member naming
- Minimal UPPER_CASE enum usage detected (15 matches in 6 files)
- The Typescript.md docs note enums are anti-patterns; prefer string unions

## Strategy

Enable rules incrementally, fix violations **manually** (no `--fix`), run lint after each to verify, following workspace rules (compile → lint → test → knip → bundle).

be sure to run `npm run lint` at the top-level of the repo, not in any package...the linter rules much pass for ALL packages.

**Important**: Do NOT use `npm run lint:fix` or eslint `--fix`. Examine each error individually and fix manually to ensure quality.

## Implementation Steps

### 1. Enable PascalCase for Types

- Add naming-convention rule for `typeLike` selector with PascalCase format
- Fix 2 violations in:
- `packages/salesforcedx-vscode-services/src/virtualFsProvider/fsTypes.ts`
- `packages/salesforcedx-vscode-apex-oas/src/oasUtils.ts`
- Run full validation (compile, lint, test, knip, bundle)

### 2. Enable camelCase for Functions/Methods

- Add naming-convention rule for `function` and `method` selectors
- Fix any violations discovered
- Run full validation

### 3. Enable camelCase for Properties/Variables

- Add naming-convention rule for `property` and `variable` selectors
- Allow UPPER_CASE for const variables (constants)
- Fix any violations discovered
- Run full validation

## Files to Modify

- `eslint.config.mjs` (lines 197-205) - enable and configure naming-convention rule

### To-dos

- [x] Enable PascalCase naming for types and fix 2 violations
- [x] Enable camelCase naming for functions/methods and fix violations
- [x] Enable camelCase naming for properties/variables (allow UPPER_CASE constants) and fix violations
- [ ] Enable UPPER_CASE naming for enum members and fix/convert 17 enum files