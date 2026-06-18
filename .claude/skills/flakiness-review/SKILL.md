---
name: flakiness-review
description: Periodic E2E flakiness audit. Scans N days of GHA CI runs, downloads artifacts, forms evidence-backed hypotheses, checks prior WI impact, creates GUS WIs for determinism improvements.
---

# Flakiness Review

Periodic E2E flakiness audit. Goal: data-driven root causes, not workarounds.

## Trigger

`/flakiness-review` — optional `days=N` (default 7). **Always invoke workflow `flakiness-review.js`.** Don't inline. Warn user before launch: takes 30–60 min.

## Constraints

- **No workarounds** — no `test.skip`, platform-gating, `waitForTimeout`, fallbacks, retry inflation; only determinism improvements
- **Evidence required** — every hypothesis must cite: CI run ID, artifact path (screenshot/frame/span), exact failure message
- **No re-proposing reverted approaches** — check EDE epic closed WIs + linked PR diffs first

## EDE Epic

All new WIs → epic `a3QEE000002AZ8D2AW` (IDE e2e improvements). Subject prefix: `[ai-auto]`. Follow [gus-cli safety rules](../gus-cli/SKILL.md) — draft before creating.

## Workflow phases

1. **Scan CI runs** — GHA Playwright E2E on `develop`, last N days
2. **Collect metrics** — workflow rerun rates + per-test retry rates from Playwright `results.json`
3. **Cluster failures** — by test name + error pattern; include retry-masked (passed after retries)
4. **Filter resolved** — drop clusters whose last failure predates window midpoint and whose recent runs are clean (e.g. playwright/vscode bump fallout already fixed)
5. **Download artifacts** — top clusters: screenshots, video frames (ffmpeg), span JSONL
6. **Assess prior WIs** — EDE epic closed WIs → linked merged PRs → diffs → still flaky?
7. **Hypothesize** — evidence-backed root-cause per cluster (cite artifact + run)
8. **Challenge** — one adversarial agent per hypothesis re-reads artifacts + source to refute; drop refuted
9. **Draft WIs** — one WI per surviving hypothesis
10. **Write report** — markdown at `.e2e-artifacts/flakiness-reports/flakiness-review-<ts>.md`: linked artifacts, code refs, prior WI links, metrics tables, proposed WI table

## Output

Report: `.e2e-artifacts/flakiness-reports/flakiness-review-<ts>.md`
- screenshot/video-frame links inline
- code file:line refs per finding
- prior WI links (GitHub PR + GUS WI name)
- proposed WI table at bottom — confirm "create all" or "create 1,3" to create

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
