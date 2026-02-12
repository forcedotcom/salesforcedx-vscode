# Analyze E2E Tests

Monitor running e2e playwright tests for current branch, download artifacts on failure, provide analysis tools.

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status` succeeds)
- Git repo with branch checked out

## Workflow

First, use the `../../../agents/playwright-e2e-monitor.md` agent to efficiently retrieve artifacts. You can look at its doc to see where they get stored.

1. **Offer Analysis** (if artifacts downloaded)
   - Search HTML reports: `playwright-report/index.html` or `**/playwright-report/index.html`
   - Search test results: `test-results/` directory
   - Reference: `.claude/skills/playwright-e2e/references/coding-playwright-tests.md`, `.claude/skills/playwright-e2e/references/iterating-playwright-tests.md`
   - Offer: open HTML report, show test results, open workflow (`gh run view <run-id> --web`)

Organized by branch and run ID.

## GitHub CLI Commands

- `gh run list -b <branch> --limit 50 --json databaseId,status,conclusion,workflowName,createdAt,headBranch` - List runs
- `gh run watch <run-id>` - Monitor until completion
- `gh run download <run-id> -D <directory>` - Download artifacts
- `gh run view <run-id> --web` - Open in browser

## Workflow Detection

Filter `gh run list` JSON for `workflowName` containing "(Playwright)". Examples: "Metadata E2E (Playwright)" (`metadataE2E.yml`), "Services E2E (Playwright)" (`servicesE2E.yml`), "OrgBrowser E2E (Playwright)" (`orgBrowserE2E.yml`).

## Finding video

the video names are hard. You can often trust the test failures to be the longest (largest file size) videos because waiting for test timeout
