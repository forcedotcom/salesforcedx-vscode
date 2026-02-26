---
name: playwright-e2e
description: writing, running, and debugging Playwright tests. working with their output from github actions
---

# Playwright E2E Tests

Guidelines for writing and iterating on Playwright tests for VS Code extensions.

## Required Reading

**Read ALL before responding:**

- `references/coding-playwright-tests.md` - Writing tests
- `references/iterating-playwright-tests.md` - Iterating on tests (lines 34-37: "Things to ignore")
- `references/analyze-e2e.md` - Analyzing E2E test results from CI

# Use playwright-vscode-ext

Shared code (helpers, locators, configuration) for tests.

## Span files (when debugging traces)

Local only — span export disabled in CI/GHA.

- Output: `~/.sf/vscode-spans/` — `web-*.jsonl` (test:web), `node-*.jsonl` (test:desktop)
- Auto-enabled when !CI (no manual enable needed)
- Latest: `ls -lt ~/.sf/vscode-spans/`
- Clear before run for fresh output: `rm -rf ~/.sf/vscode-spans/`
- Format: JSONL; parse each line with `JSON.parse`
- Fields: `name`, `traceId`, `spanId`, `parentSpanId`, `durationMs`, `status`, `startTime`, `attributes`

See `.claude/skills/span-file-export/SKILL.md` for enable/OTLP vs file.

## References

- https://playwright.dev/docs - Playwright docs
