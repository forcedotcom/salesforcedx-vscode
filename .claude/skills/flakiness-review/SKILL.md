---
name: flakiness-review
description: Periodic E2E flakiness audit. Scans N days of GHA CI runs, downloads artifacts, forms evidence-backed hypotheses, checks prior WI impact, creates GUS WIs for determinism improvements.
---

# Flakiness Review

Periodic audit of E2E test flakiness. Goal: data-driven root causes, not workarounds.

## Trigger

`/flakiness-review` — optional `days=N` (default: 7). **Always invoke workflow `flakiness-review.js`.** Do not inline.

## Constraints

- **No workarounds** — no `test.skip`, platform-gating, `waitForTimeout`, fallbacks, retry inflation; only determinism improvements
- **Evidence required** — every hypothesis must cite: CI run ID, artifact path (screenshot/frame/span), exact failure message
- **No re-proposing reverted approaches** — check EDE epic closed WIs + linked PR diffs first

## EDE Epic

All new WIs → epic `a3QEE000002AZ8D2AW` (IDE e2e improvements). Subject prefix: `[ai-auto]`. Follow [gus-cli safety rules](../gus-cli/SKILL.md) — draft before creating.

## Workflow phases

1. **Scan** — GHA Playwright E2E runs on `develop`, last N days
2. **Cluster** — group failures by test name + error pattern; include retry-masked (passed after retries)
3. **Filter resolved** — drop clusters whose last occurrence predates the midpoint of the window and whose recent runs are clean (e.g. playwright/vscode bump fallout already fixed)
4. **Download artifacts** — top clusters: screenshots, video frames (ffmpeg), span JSONL
5. **Assess prior WIs** — EDE epic closed WIs → linked merged PRs → diffs → still flaky?
6. **Hypothesize** — evidence-backed root-cause per cluster (cite artifact + run)
7. **Draft WIs** — one WI per hypothesis
8. **Write report** — concise markdown at `.e2e-artifacts/flakiness-reports/flakiness-review-<ts>.md` with linked artifacts, code references, prior WI links, and proposed WI table

## Output

Report: `.e2e-artifacts/flakiness-reports/flakiness-review-<ts>.md`
- Links to screenshots/video frames inline
- Code file:line references for each finding
- Prior WI links (GitHub PR + GUS WI name)
- Proposed WI table at bottom — confirm "create all" or "create 1,3" to create

## Reference commands

```bash
# List E2E runs
gh run list --repo forcedotcom/salesforcedx-vscode --branch develop --limit 200 \
  --json databaseId,workflowName,conclusion,createdAt,attempt \
  --jq '[.[] | select(.workflowName | test("Playwright|E2E|e2e"; "i"))]'

# Download artifacts
gh run download <run-id> -D .e2e-artifacts/develop/<run-id>

# ERROR spans across all artifacts
python3 -c "
import glob, json, collections
c = collections.Counter()
for p in glob.glob('.e2e-artifacts/**/*.jsonl', recursive=True):
  for line in open(p):
    s = json.loads(line)
    if s.get('status', {}).get('code') == 2: c[s['name']] += 1
[print(n, k) for k, n in c.most_common(20)]
"

# Video frames (ss=start_sec, to=end_sec)
ffmpeg -i <video.webm> -ss <ss> -to <to> -vf "fps=4" -q:v 2 .e2e-artifacts/frames/frame_%04d.png
```

See [analyze-e2e](../playwright-e2e/references/analyze-e2e.md) and [span-file-export](../span-file-export/SKILL.md).
