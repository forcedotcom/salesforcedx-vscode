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
   - Search span traces: `test-results/spans/*.jsonl`
   - Reference: `.claude/skills/playwright-e2e/references/coding-playwright-tests.md`, `.claude/skills/playwright-e2e/references/iterating-playwright-tests.md`
   - Offer: open HTML report, show test results, open workflow (`gh run view <run-id> --web`)

Organized by branch and run ID.

## GitHub CLI Commands

- `gh run list -b <branch> --limit 50 --json databaseId,status,conclusion,workflowName,createdAt,headBranch` - List runs
- `gh run watch <run-id>` - Monitor until completion
- `gh run download <run-id> -D <directory>` - Download artifacts
- `gh run view <run-id> --web` - Open in browser

## Artifact location (mandatory)

**Always use `.e2e-artifacts/` as the root** — gitignored. Never use a variant name (e.g. `.e2e-artifacts-win/`).

Structure (matches playwright-e2e-monitor agent):
```
.e2e-artifacts/<branch-name>/<run-id>-<workflow-name>/
  playwright-report/
  playwright-test-results-soql-desktop-windows-latest/   ← platform encoded in artifact name
  playwright-test-results-soql-desktop-macos-latest/
  playwright-test-results-soql-web/
```

Download command:
```bash
gh run download <run-id> -D .e2e-artifacts/<branch-name>/<run-id>-<workflow-name>
```

Platform artifacts are distinguished by name suffix (`windows-latest`, `macos-latest`, `web`) — no extra platform subdirectory needed.

## Span files from CI artifacts

- Location: `.e2e-artifacts/<branch>/<run>/playwright-test-results-*/spans/*.jsonl`
- Format: JSONL (one span per line, parse with `JSON.parse`)
- Fields: `name`, `traceId`, `spanId`, `parentSpanId`, `durationMs`, `status`, `startTime`, `attributes`

Quick inspect:

```bash
ls -lt .e2e-artifacts/*/*/playwright-test-results-*/spans/*.jsonl
```

Read spans compact JSON:

```bash
python3 - <<'PY'
import glob, json
for path in glob.glob('.e2e-artifacts/*/*/playwright-test-results-*/spans/*.jsonl'):
    print(f'### {path}')
    with open(path, encoding='utf-8') as f:
        for line in f:
            print(json.dumps(json.loads(line), separators=(',', ':')))
PY
```

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
mkdir -p .e2e-artifacts/frames && ffmpeg -i .e2e-artifacts/<branch>/<run>/playwright-test-results-*/<video>.webm -ss 89 -to 96 -vf "fps=6" -q:v 2 .e2e-artifacts/frames/frame_%04d.png
```

- `fps=6` ≈ 6 frames/sec; output `frame_0001.png`+
