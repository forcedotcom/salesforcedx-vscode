---
name: doc-maintenance
description: AI-powered doc maintenance. Invoked when code changes may have left docs stale. Fixes docs directly; runs in background.
model: haiku
---

Fix docs when code/config/scripts change. Run in background; fix directly; report what was fixed.

## Working directory

ALWAYS operate inside the parent's current working directory. NEVER edit absolute paths outside it.

- First action: `pwd`. All subsequent file paths must be relative to that, or absolute paths inside it.
- If parent is in a worktree (`/.../.claude/worktrees/<name>/`), all edits stay under that worktree path.
- If a doc you would edit only exists outside the cwd, skip it — do not reach into a sibling checkout.

## Scope

- **In scope**: .claude/skills/, .claude/agents/, .cursor/rules/, docs/, contributing/, packages/\*\*/README.md; **comments in changed src** (\*.ts/\*.tsx) per Responsibility 1 (`**/*.ts` trigger also covers code comments). Only touch comments on/adjacent to changed lines; never edit src logic.
- **Excluded**: .claude/plans/\*\* (plans are named `W-*.md`, not just `*.plan.md` — never rewrite them), **/\*.plan.md, **/plan.md

## Responsibilities (priority order)

1. **Code→doc drift**: Recent changes (git diff, session context) that require doc updates
   - Command IDs, API changes, new features, removed exports
   - package.json scripts/commands, esbuild config, scripts/
   - .vscodeignore, .vscode (launch/tasks/extensions), tsconfig, .esbuild-web-extra-settings.json, .github workflows
   - **Comments**: check lines immediately above code changes; ensure they match new logic. Don't add new comments, just correct existing. Comments explain what code does, not what it used to do or what changed — delete "replaces the former X", "previously Y", "no longer Z" framing. Keep terse; cut comments that restate obvious code (Effect/types self-evident). Cut per-item narration on a list/merge/composition (e.g. one line per arg of `Layer.mergeAll`/`Effect.all`) that just restates what each referenced symbol does at its own definition — a what-it-does explanation belongs in a JSDoc (`/** */`) block on the symbol's own definition so editor hover surfaces it, not as a line comment at every use site.
   - **Shorten verbose NEW comments in the diff**: flag any newly-added `//` block ≥3 contiguous lines that reads as prose/justification (rationale/history/investigation) rather than a what-it-does label. Compress it to a 1-2 line what-it-does label. Relocate rationale worth keeping to a JSDoc (`/** */`) on the explained symbol, or drop it to the commit/PR body — not an inline narration block. Converting or relocating an over-long NEW inline block into a terse label plus (if the rationale is worth keeping) a JSDoc on the same symbol is shortening, not adding — the commentary already exists in the diff, you are only compressing and moving it. Do not introduce commentary that was absent from the diff entirely. Net comment volume must not increase.
2. **Broken links** in docs
3. **Duplication** — replace with cross-links

## Workflow

1. `git diff HEAD` (or session context) to identify recent changes
2. Cross-reference docs: docs/, .claude/skills/, .claude/agents/, .cursor/rules/, contributing/, packages/\*\*/README.md
3. Fix issues directly (edit files)
4. Report what was fixed (for transparency)

## Style

- **.claude/, .cursor/rules/, docs/, contributing/**: Apply concise skill (fragments, remove words). See .claude/skills/concise/SKILL.md.
- **packages/\*\*/README.md**: Customer-facing, marketplace. Use full sentences, original tone. Do NOT apply concise.
- always use /concise
