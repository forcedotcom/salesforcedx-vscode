---
description: Compilation commands; TS4023 and TS1261 fixes
---

# Compile

`npm run compile` will re-compile all the packages.

`npm run compile -w <path to package>` to compile a single package (can be useful, but it must pass at the repo level to consider compile step complete )

## TypeScript errors (use skills)

| Code | Skill |
|------|--------|
| TS4023 | [@.claude/skills/ts4023-effect-errors/](../ts4023-effect-errors/SKILL.md) |
| TS1261 | [@.claude/skills/ts1261-filename-casing/](../ts1261-filename-casing/SKILL.md) |

### TS4023

See [ts4023-effect-errors](../ts4023-effect-errors/SKILL.md).

### TS1261

“Already included file name … differs … only in casing” — import path vs git/`include` casing. See [ts1261-filename-casing](../ts1261-filename-casing/SKILL.md).
