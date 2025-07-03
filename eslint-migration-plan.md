# Project Plan: Migrating to `eslint-config-salesforce-typescript`

## 1. Research & Comparison

### 1.1. Understand the Upstream Config

- The [eslint-config-salesforce-typescript](https://github.com/forcedotcom/eslint-config-salesforce-typescript/blob/main/index.js) package is a shareable ESLint config for Salesforce TypeScript projects.
- **Plugins/Dependencies Used:**
  - `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-import`, `eslint-plugin-jsdoc`, `eslint-plugin-jest`, `eslint-plugin-prefer-arrow`, `eslint-plugin-unicorn`, `eslint-config-prettier`, `eslint-plugin-header`, `eslint-plugin-jest-formatting`, `@stylistic/eslint-plugin-ts`
- **Rule Coverage:**
  - Enforces strong TypeScript, stylistic, import, unicorn, and Prettier rules.
  - Handles test file overrides and copyright/license header.
  - Integrates Prettier for formatting.
  - Includes Salesforce-specific customizations.

### 1.2. Compare with Our Current Config

- **Our config** (`eslint.config.mjs`):
  - Uses a flat config array with blocks for ignores, TypeScript, test overrides, and Prettier.
  - Sets up the same plugins as the shared config.
  - Adds a custom local rule: `no-duplicate-i18n-values`.
  - Has a detailed header/license block and unique file ignore patterns.
  - More granular test file overrides (e.g., `varsIgnorePattern` for test mocks).
  - Some rules are set to `off` or downgraded for tests, or differ in strictness from the shared config.

---

## 2. What Would Be Eliminated?

- **Redundant plugin imports and setup**
- **Rules that match the shared config** (TypeScript, stylistic, import, unicorn, Prettier)
- **Most test-specific overrides**
- **Header/license block enforcement** (unless your pattern differs)

---

## 3. What Would Remain?

- **Custom local rules**: e.g., `no-duplicate-i18n-values` (not present upstream)
- **Header/license block**: If your pattern differs from the shared config
- **Rules you want to relax/disable**: If the shared config is stricter
- **File ignore patterns**: If you have ignores not present in the shared config
- **Project-specific rules**: e.g., i18n, custom test patterns
- **Special test file handling**: If you have unique test file patterns or rules not covered upstream

---

## 4. Detailed Rule-by-Rule Comparison

### 4.1. Rules Present in Both (Would Be Eliminated)

- All major TypeScript, stylistic, import, unicorn, and Prettier rules are present in both configs and can be removed from your local config. Test file overrides and header/license block enforcement are also present in both (pattern may differ).

### 4.2. Rules Unique to Your Config (Would Remain)

- `local/no-duplicate-i18n-values` (custom local rule)
- Test file overrides (e.g., `varsIgnorePattern` for mocks, disables for test files)
- Unique file ignore patterns
- Header/license block (if your pattern is different)
- Rule relaxations (e.g., `no-console: 'off'`, `no-empty-function: 'off'`, etc.)

### 4.3. Rules in Upstream but Overridden/Undone in Yours

- If you want to relax or disable a rule that is stricter in the shared config, you’ll need to explicitly override it after extending the shared config (e.g., `no-console: 'off'`, `@typescript-eslint/no-explicit-any: 'off'`).
- If you have more relaxed rules for tests than upstream, keep those overrides.

### 4.4. Rules in Upstream but Not Present in Yours (New Rules You’d Get)

The following rules are present in `eslint-config-salesforce-typescript` but **not** in your current config. If you switch, these will be newly enforced unless you explicitly override them:

- `unicorn/prefer-node-protocol`
- `unicorn/prefer-object-from-entries`
- `import/no-self-import`
- `import/no-empty-named-blocks`

Most other rules in the shared config are already present in your config, or would only differ if you have them set to `off` or a different value. Prettier integration and test file handling are already present in both configs, though the shared config may have slightly different settings.

---

## 5. Summary Table

| Rule/Section                        | In Upstream? | In Our Config? | Action             |
| ----------------------------------- | :----------: | :------------: | ------------------ |
| TypeScript core rules               |      ✔️      |       ✔️       | Remove ours        |
| Plugin setup/imports                |      ✔️      |       ✔️       | Remove ours        |
| Prettier integration                |      ✔️      |       ✔️       | Remove ours        |
| Test file overrides                 |      ✔️      |       ✔️       | Remove/merge       |
| Custom local rules                  |      ❌      |       ✔️       | Keep ours          |
| Header/license block                |      ✔️      |       ✔️       | Override if needed |
| File ignore patterns                |      ✔️      |       ✔️       | Merge/override     |
| Project-specific rules              |      ❌      |       ✔️       | Keep ours          |
| Rule relaxations (e.g., no-console) |      ❌      |       ✔️       | Override as needed |

---

**References:**

- [eslint-config-salesforce-typescript/index.js](https://github.com/forcedotcom/eslint-config-salesforce-typescript/blob/main/index.js)
