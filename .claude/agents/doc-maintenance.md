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
   - **Comments**: check lines adjacent to code changes; match new logic. Never write a new comment — correct, shorten, or delete only; comments added *in this diff* included. Say what code does, not what changed — cut "replaces the former X", "previously Y", "no longer Z" framing. Keep terse; cut comments restating the code, new or old (Effect/types self-evident). Cut per-item narration on a list/merge/composition (e.g. 1 line per arg of `Layer.mergeAll`/`Effect.all`) that just restates what each referenced symbol does at its own definition — a what-it-does explanation belongs in a JSDoc (`/** */`) block on the symbol's own definition so editor hover surfaces it, not as a line comment at every use site.
   - **New comments**: restates code → delete, any length. Prose/rationale (history, investigation) ≥2 lines → compress to a 1-2 line label; rationale → JSDoc (as above) or commit/PR body. Delete/compress/relocate ≠ add; never introduce commentary absent from the diff; net volume must not increase.
2. **Broken links** in docs
3. **Duplication** — replace with cross-links

## Workflow

1. `git diff HEAD` (or session context) to identify recent changes
2. Comment audit: for each changed \*.ts/\*.tsx hunk, re-read the comment lines on/adjacent to it; fix stale ones per Responsibility 1
3. Cross-reference docs: docs/, .claude/skills/, .claude/agents/, .cursor/rules/, contributing/, packages/\*\*/README.md
4. Fix issues directly (edit files)
5. Report what was fixed, AND explicitly state comment-audit result even if clean (e.g. "comments checked, none stale") — do not report doc status only

## Style

- **.claude/, .cursor/rules/, docs/, contributing/**: Apply concise skill (fragments, remove words). See .claude/skills/concise/SKILL.md.
- **packages/\*\*/README.md**: Customer-facing, marketplace. Use full sentences, original tone. Do NOT apply concise.
- always use /concise
