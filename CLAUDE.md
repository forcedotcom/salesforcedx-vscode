# Project Instructions

## After code changes

1. **Doc maintenance** — after making code changes, spawn the `doc-maintenance` agent (`.claude/agents/doc-maintenance.md`) in background. It fixes stale docs in `.claude/skills/`, `.claude/agents/`, `.cursor/rules/`, `docs/`, `contributing/`, `packages/**/README.md`.

2. **Verification** — the Stop hook (`verify-stop.sh`) runs compile, lint, effect LS, test, vscode:bundle, and knip automatically. For additional checks see `.claude/skills/verification/SKILL.md`.

## Wireit

When working with wireit — answering questions, authoring scripts, or editing `package.json` — read `.claude/skills/wireit/SKILL.md` first.

If you see "Unknown error thrown: Error: Did not expect..." or "Internal error!" from wireit — another process was running the same scripts. Re-run the command to confirm it passes. Do NOT clear `.wireit` to solve this.
