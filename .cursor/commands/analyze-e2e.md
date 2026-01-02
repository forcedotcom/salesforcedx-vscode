# Analyze E2E Tests

Monitor running e2e playwright tests for the current branch, download artifacts on failure, and provide analysis tools.

## Overview

This command monitors e2e playwright test workflows running in GitHub Actions for the current branch. It watches for completion, downloads artifacts on failure, and offers tools to analyze test results.

## Prerequisites

Before using this command, ensure you have:

- `gh` CLI installed and authenticated (`gh auth status` should succeed)
- Current directory is a git repository with a branch checked out
- GitHub CLI has access to the repository

## Workflow

When a user requests to analyze e2e tests:

1. **Get Current Branch**
   - Run `git branch --show-current` to get the current branch name
   - If no branch is checked out (detached HEAD), report error and stop
   - Store branch name for artifact organization

2. **Find E2E Workflows**
   - Run `gh run list -b <branch> --limit 50 --json databaseId,status,conclusion,workflowName,createdAt,headBranch`
   - Filter for playwright e2e workflows by checking `workflowName` contains "(Playwright)":
     - "Metadata E2E (Playwright)" - from `metadataE2E.yml`
     - "Services E2E (Playwright)" - from `servicesE2E.yml`
     - "OrgBrowser E2E (Playwright)" - from `orgBrowserE2E.yml`
     - Any other workflow with "(Playwright)" in the name
   - If multiple playwright workflows found:
     - Group by status: prioritize `in_progress` or `queued` workflows first
     - Then recently completed (`success`, `failure`, `cancelled`) ordered by `createdAt` descending
     - If multiple running workflows: monitor all of them
     - If only completed workflows: use the most recent one

3. **Monitor Workflow Status**
   - If multiple playwright workflows are running:
     - Monitor all of them: `gh run watch <run-id-1> <run-id-2> ...` (if supported)
     - Or monitor each sequentially, showing which workflow is being watched
   - If workflow is `in_progress` or `queued`:
     - Use `gh run watch <run-id>` to monitor until completion
     - Show status updates: "Monitoring workflow: <workflow-name>...", "Waiting for completion..."
   - If workflow is already completed:
     - Skip monitoring, proceed to result handling

4. **Handle Results**

   **On Success:**
   - Report: "✓ E2E tests passed for workflow `<workflow-name>` on branch `<branch-name>`"
   - Provide workflow run URL: `gh run view <run-id> --web`
   - No artifact download needed
   - If multiple workflows monitored: report status for each

   **On Failure or Cancellation:**
   - Create artifact directory: `.e2e-artifacts/<branch-name>/<run-id>-<workflow-name>/`
     - Sanitize workflow name for filesystem (replace spaces/special chars with dashes)
   - Download all artifacts: `gh run download <run-id> -D .e2e-artifacts/<branch-name>/<run-id>-<workflow-name>`
   - Extract/unzip artifacts if needed (GitHub artifacts are typically zipped)
   - Report: "✗ E2E tests failed for workflow `<workflow-name>` on branch `<branch-name>`"
   - Show artifact location: `.e2e-artifacts/<branch-name>/<run-id>-<workflow-name>/`
   - If multiple workflows failed: download artifacts for each and report all locations

5. **Offer Analysis**

   If artifacts were downloaded:
   - Search for HTML reports: `playwright-report/index.html` or `**/playwright-report/index.html`
   - Search for test results: `test-results/` directory
   - List available artifacts
   - Offer to:
     - Open HTML report in browser: `open .e2e-artifacts/<branch-name>/<run-id>/<path-to-index.html>`
     - Show test results directory
     - Open workflow run in browser: `gh run view <run-id> --web`

## Artifact Storage Structure

Artifacts are organized by branch and run ID:

```
.e2e-artifacts/
  <branch-name>/
    <run-id>/
      playwright-report/
        index.html
        ...
      playwright-test-results/
        ...
      (other artifacts from workflow)
```

This structure allows:
- Multiple runs per branch to be stored separately
- Easy navigation to specific test run artifacts
- Clean organization for analysis

## GitHub CLI Commands Used

- `gh run list -b <branch> --limit 50 --json databaseId,status,conclusion,workflowName,createdAt,headBranch`
  - Lists workflow runs for a branch with key metadata
  - Use `--limit 50` to ensure we see enough recent runs

- `gh run watch <run-id>`
  - Monitors a running workflow until completion
  - Shows real-time status updates

- `gh run download <run-id> -D <directory>`
  - Downloads all artifacts from a workflow run
  - Stores them in the specified directory

- `gh run view <run-id> --web`
  - Opens the workflow run in the browser
  - Useful for detailed inspection

## Workflow Detection

The command identifies playwright e2e workflows by:

1. **Workflow run names** containing "(Playwright)":
   - "Metadata E2E (Playwright)" - from `.github/workflows/metadataE2E.yml`
   - "Services E2E (Playwright)" - from `.github/workflows/servicesE2E.yml`
   - "OrgBrowser E2E (Playwright)" - from `.github/workflows/orgBrowserE2E.yml`
   - Any workflow with "(Playwright)" in the `workflowName` field from `gh run list`

2. **Filtering logic**:
   - Parse JSON output from `gh run list`
   - Check if `workflowName` includes "(Playwright)"
   - This ensures we only monitor actual playwright test workflows, not other e2e workflows

## Error Handling

- **Missing `gh` CLI**:
  - Check with `which gh` or `gh --version`
  - Provide installation instructions: "Install GitHub CLI: https://cli.github.com/"

- **Unauthenticated GitHub CLI**:
  - Run `gh auth status` to check
  - If not authenticated: `gh auth login`
  - Report error and stop if authentication fails

- **No branch checked out**:
  - Detect detached HEAD or no git repo
  - Report: "No branch checked out. Please checkout a branch first."
  - Stop execution

- **No workflows found for branch**:
  - Check if branch exists remotely: `git ls-remote --heads origin <branch>`
  - Report: "No e2e workflows found for branch `<branch-name>`. The branch may not have triggered workflows yet."
  - Suggest: "Push commits to trigger workflows, or check if workflows run on this branch."

- **Artifact download failures**:
  - Check if artifacts exist: `gh run view <run-id> --json artifacts`
  - If no artifacts: "No artifacts available for this workflow run."
  - If download fails: Report error and suggest manual download: `gh run download <run-id>`

- **Missing branch context**:
  - If `git branch --show-current` fails, check if in git repo
  - Report appropriate error message

## Examples

**User**: "analyze e2e"

**Agent**:

1. Gets current branch: `git branch --show-current` → `feature/my-branch`
2. Finds workflows: `gh run list -b feature/my-branch --limit 50 --json ...`
3. Filters for workflows with "(Playwright)" in name
4. Finds "Metadata E2E (Playwright)" workflow with status `in_progress`
5. Monitors: `gh run watch <run-id>`
6. Workflow completes with `failure`
7. Downloads artifacts: `gh run download <run-id> -D .e2e-artifacts/feature/my-branch/<run-id>-Metadata-E2E-Playwright`
8. Finds `playwright-report/index.html` in artifacts
9. Reports: "✗ E2E tests failed for workflow `Metadata E2E (Playwright)` on branch `feature/my-branch`. Artifacts downloaded to `.e2e-artifacts/feature/my-branch/<run-id>-Metadata-E2E-Playwright/`"
10. Offers: "Would you like me to open the HTML report? Found at: `.e2e-artifacts/feature/my-branch/<run-id>-Metadata-E2E-Playwright/playwright-report/index.html`"

**User**: "analyze e2e" (workflow already completed successfully)

**Agent**:

1. Gets current branch: `feature/my-branch`
2. Finds workflows: Filters for "(Playwright)" workflows
3. Finds latest "Services E2E (Playwright)" with status `success`
4. Skips monitoring (already completed)
5. Reports: "✓ E2E tests passed for workflow `Services E2E (Playwright)` on branch `feature/my-branch`"
6. Provides link: "View workflow: `gh run view <run-id> --web`"

**User**: "analyze e2e" (no workflows found)

**Agent**:

1. Gets current branch: `local-branch`
2. Finds workflows: `gh run list -b local-branch` returns empty
3. Checks if branch exists remotely: `git ls-remote --heads origin local-branch`
4. Reports: "No e2e workflows found for branch `local-branch`. This branch may not have been pushed or may not trigger e2e workflows."
5. Suggests: "Push your commits to trigger workflows, or check the workflow configuration."

## Implementation Notes

- Use `execSync` or `spawn` to run git and gh commands
- Parse JSON output from `gh run list` to filter workflows
- Handle both running and completed workflows gracefully
- Create artifact directories with `mkdir -p` before downloading
- Extract zip files if GitHub artifacts are compressed
- Use `find` or `glob` to locate HTML reports in downloaded artifacts
- Provide clear, actionable error messages at each step
