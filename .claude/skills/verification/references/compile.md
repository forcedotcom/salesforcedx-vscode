---
description: Compilation commands; TS4023 and TS1261 fixes
---

# Compile

`npm run compile` will re-compile all the packages.

`npm run compile -w <path to package>` to compile a single package (can be useful, but it must pass at the repo level to consider compile step complete )

## TypeScript errors (use skills)

| Code | Skill |
|------|--------|
| TS1205 | No skill — use `export type` for type-only exports; or `isolatedModules: false` override for packages needing ambient const enums from external packages |
| TS4023 | [@.claude/skills/ts4023-effect-errors/](../ts4023-effect-errors/SKILL.md) |
| TS1261 | [@.claude/skills/ts1261-filename-casing/](../ts1261-filename-casing/SKILL.md) |

### TS1205

"Re-exporting a type when `--isolatedModules` is provided requires using `export type`." `tsconfig.common.json` sets `isolatedModules: true`. Fix: change `export { Foo }` → `export type { Foo }` (or inline `export { type Foo, Bar }`). Exception: packages accessing ambient `const enum` from external packages must override with `isolatedModules: false` in their local `tsconfig.json`.

### TS4023

See [ts4023-effect-errors](../ts4023-effect-errors/SKILL.md).

### TS1261

“Already included file name … differs … only in casing” — import path vs git/`include` casing. See [ts1261-filename-casing](../ts1261-filename-casing/SKILL.md).
