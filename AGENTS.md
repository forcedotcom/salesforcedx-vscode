# Engineering working agreements

- Never bypass Git hooks or use `--no-verify`.
- Do not set environment variables intended to skip quality gates.
- When committing, allow the repository's configured pre-commit workflow to run normally.
- Treat repository-owned scripts, linters, type checking, tests, and diagnostics as authoritative.
- Do not weaken or disable quality rules merely to make checks pass.
- Use narrowly justified suppressions only where the underlying API boundary genuinely requires one.
- Preserve unrelated user changes.
- Do not commit unless explicitly requested.
- When needing to fetch records from GUS use sf CLI and run outside the sandbox.

When adding or removing a VS Code extension package, changing `.vscode/launch.json`, or adding a subset launch group, read [`.agents/skills/vscode-extension-launch/SKILL.md`](.agents/skills/vscode-extension-launch/SKILL.md) before editing.
