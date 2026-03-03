# Analyze E2E Tests

Monitor running e2e playwright tests for current branch, download artifacts on failure, provide analysis tools.

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status` succeeds)
- Git repo with branch checked out

## Workflow

**Delegate to** `../../../agents/playwright-e2e-monitor.md` subagent. If user provides a run URL (`.../actions/runs/12345`), include run-id `12345` in the subagent prompt.

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

## Run ID

- From `gh run list`: run ID = `databaseId` of selected run
- From URL: `.../actions/runs/<run-id>` or `.../actions/runs/<run-id>/job/...`

## Workflow Detection

Filter `workflowName` containing "(Playwright)". Examples: Metadata E2E, Services E2E, OrgBrowser E2E.

## Finding video

the video names are hard. You can often trust the test failures to be the longest (largest file size) videos because waiting for test timeout

Video → screenshot to look at filenames in the test and see which test the video goes with

## Video → screenshots

Extract frames from failing test `.webm` to step through a moment:

- **Prereq:** `brew install ffmpeg` if missing
- **Cmd** (e.g. 1:29–1:36 → -ss 89 -to 96):

```bash
mkdir -p .e2e-artifacts/frames && ffmpeg -i <path>/<video>.webm -ss 89 -to 96 -vf "fps=6" -q:v 2 .e2e-artifacts/frames/frame_%04d.png
```

- `fps=6` ≈ 6 frames/sec; output `frame_0001.png`+
