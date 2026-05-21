---
description: Trigger doc-maintenance workflow after code and config edits that can cause docs drift.
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/package.json"
  - "**/esbuild.config.*"
  - "scripts/**"
  - "**/.vscodeignore"
  - "**/.vscode/**"
  - "**/tsconfig*.json"
  - ".esbuild-web-extra-settings.json"
  - ".github/**"
---

When edits touch files matching these paths, automatically run the doc-maintenance subagent.

Execution requirements:
- Run after code edits are complete and before the final response.
- Run in the background when available.
- Do not ask the user for confirmation.
- Let the subagent apply documentation updates directly.
