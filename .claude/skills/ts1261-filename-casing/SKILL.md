---
name: ts1261-filename-casing
description: Fix TS1261 when TypeScript reports two paths that differ only in casing (import vs include vs git index). Use when compile shows error 1261 or "Already included file name ... differs from file name ... only in casing".
---

# TS1261 (filename casing)

## Problem

Diagnostic 1261 in `typescript` (`Already_included_file_name_0_differs_from_file_name_1_only_in_casing`): one path comes from an import, another from `include` / program — same file on a case-insensitive disk, different casing in the string.

Typical cause: git tracks `fooBar.ts` but imports `./FooBar`; or a case-only rename left the index with old casing.

## Fix

Canonical name = what imports use (and consistent Pascal/camel across repo).

**Case-insensitive FS (macOS default, Windows):** case-only renames need a **temporary** middle name so git and the filesystem both update.

```bash
cd path/to/dir
git mv WrongCaseName.ts _tmp_rename.ts
git mv _tmp_rename.ts RightCaseName.ts
```

Then `npm run compile` (or package `tsc --build`).

## Why not a single `git mv`?

`git mv a.ts A.ts` often no-ops or fails when `a` and `A` resolve to the same path — the two-step move is the reliable fix.

## `git rm` / index

Goal is an index entry whose path **string** matches imports. `git rm --cached <wrong-cased-path>` removes that index entry; you still must put content on disk under the **right** cased name (again: use intermediate `mv` on case-insensitive FS). Two-step `git mv` updates index + working tree in one workflow without a detached delete step.

## Verify

- `npm run compile` (or affected package `tsc --build`)
- `git ls-files path/to/dir | grep -i <basename>` shows one line, casing matches imports

## Checklist

- [ ] Read TS1261 lines: identify both casing spellings
- [ ] Choose spelling that matches existing imports
- [ ] Two-step `git mv` if case-only change on case-insensitive FS
- [ ] Re-run compile
