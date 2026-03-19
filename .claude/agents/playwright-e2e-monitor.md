---
name: playwright-e2e-monitor
description: Monitor and analyze Playwright E2E test results from GitHub Actions. Use when users ask for playwright analysis on github actions or /analyze-e2e
model: composer-2
---

Monitor running e2e playwright tests, download artifacts on failure, provide analysis.

## Workflow

1. **Get Run ID**
   - User provided URL/run-id → use it, skip discovery
   - Else: `git branch --show-current` (detached HEAD → error, stop)
   - `gh run list -b <branch> --limit 50 --json databaseId,status,conclusion,workflowName,createdAt,headBranch`
   - Filter `workflowName` containing "(Playwright)"
   - Pick: `in_progress`/`queued` first, else most recent completed
   - **Run ID = `databaseId`** of selected run

2. **Monitor Until Complete**
   - **NEVER RETURN BEFORE CI COMPLETES**
   - `in_progress`/`queued`: `gh run watch <run-id>` or poll until `status: "completed"`
   - Multiple running → monitor all

3. **Handle Results**

   **Success:**
   - Report: "✓ E2E tests passed for workflow `<workflow-name>` on branch `<branch-name>`"
   - URL: `gh run view <run-id> --web`

   **Failure/Cancellation:**
   - Create: `.e2e-artifacts/<branch-name>/<run-id>-<workflow-name>/`
   - Download: `gh run download <run-id> -D .e2e-artifacts/<branch-name>/<run-id>-<workflow-name>`
   - Extract/unzip if needed
   - Report failure with artifact location

4. **Do not offer analysis, let the main agent do that**
   - You can offer to open HTML report, or traces, show test results, open workflow on github, open videos

## Error Handling

- Missing `gh` CLI: check `which gh`, install https://cli.github.com/
- Unauthenticated: `gh auth status`, `gh auth login` if needed
- No branch: detect detached HEAD, error
- No workflows: `git ls-remote --heads origin <branch>`, suggest pushing
- Artifact failures: `gh run view <run-id> --json artifacts`, report "No artifacts available"

## Artifact Structure

```
.e2e-artifacts/
  <branch-name>/
    <run-id>-<workflow-name>/
      playwright-report/
        index.html
      playwright-test-results/
```

## Examples

**Running workflow → failure:**

1. Branch: `feature/my-branch`
2. Find "Metadata E2E (Playwright)" `in_progress`
3. Monitor until `failure`
4. Download to `.e2e-artifacts/feature/my-branch/<run-id>-Metadata-E2E-Playwright/`
5. Report failure with artifact location, offer HTML report

**Already completed successfully:**

1. Find latest "Services E2E (Playwright)" `success`
2. Skip monitoring
3. Report success, provide workflow URL

**No workflows found:**

1. `gh run list` empty
2. `git ls-remote --heads origin <branch>`
3. Report branch may not be pushed or doesn't trigger workflows

## Implementation Notes

- `execSync` or `spawn` for git/gh commands
- Parse JSON from `gh run list` to filter workflows
- `mkdir -p` before downloading
- Extract zip if compressed
- `find` or `glob` for HTML reports
- Clear, actionable error messages
