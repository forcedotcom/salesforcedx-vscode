export const meta = {
  name: 'flakiness-review',
  description: 'Periodic E2E flakiness review: scan CI runs, download artifacts, form evidence-backed hypotheses, assess prior WI impact, draft GUS WIs.',
  whenToUse: 'Run via /flakiness-review. Pass args.days (default 7) to control lookback window.',
  phases: [
    { title: 'Scan CI runs' },
    { title: 'Collect metrics' },
    { title: 'Cluster failures' },
    { title: 'Filter resolved' },
    { title: 'Download artifacts' },
    { title: 'Assess prior WIs' },
    { title: 'Hypothesize' },
    { title: 'Challenge' },
    { title: 'Draft WIs' },
    { title: 'Write report' },
  ],
}

// Periodic E2E flakiness audit. Goal: data-driven root causes, not workarounds.
// No workarounds — no test.skip, platform-gating, waitForTimeout, fallbacks, retry
//   inflation; only determinism improvements (enforced in Hypothesize/Draft prompts).
// Evidence required — every hypothesis cites runId + artifact path + exact error.
// Prior-art guard — never re-propose a reverted approach; Assess-prior-WIs phase checks
//   EDE epic closed WIs + linked PR diffs first.
// WIs → EDE epic a3QEE000002AZ8D2AW, subject prefix [ai-auto]. Draft only; never create
//   without user confirm ("create all" / "create 1,3"). See gus-cli skill safety rules.
// See also skills: analyze-e2e, span-file-export, playwright-e2e.

// =====================================================================
// CONSTANTS
// =====================================================================

log('Flakiness review started — expect 30–60 minutes. Use /workflows to watch progress.')

const DAYS = (args && args.days) || 7
const EDE_EPIC_ID = 'a3QEE000002AZ8D2AW'
const REPO = 'forcedotcom/salesforcedx-vscode'
const ARTIFACTS_ROOT = '.e2e-artifacts'
// Max test clusters to download artifacts for (cost guard)
const MAX_ARTIFACT_CLUSTERS = 5
// Min failure appearances across runs to be worth investigating
const MIN_FAILURE_COUNT = 2
// Per-test retry rate at/above which a test is its own cluster (retry-masked flake)
const RETRY_RATE_THRESHOLD = 0.5
// Min runs a test needs before its retryRate is trusted
const RETRY_MIN_RUNS = 4

// =====================================================================
// SCHEMAS
// =====================================================================

const RUNS_SCHEMA = {
  type: 'object',
  required: ['runs'],
  properties: {
    runs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['runId', 'workflowName', 'conclusion', 'createdAt', 'hadRetries'],
        properties: {
          runId: { type: 'string' },
          workflowName: { type: 'string' },
          conclusion: { type: 'string' },
          createdAt: { type: 'string' },
          hadRetries: { type: 'boolean' },
        },
      },
    },
  },
}

const CLUSTERS_SCHEMA = {
  type: 'object',
  required: ['clusters'],
  properties: {
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['testName', 'errorPattern', 'runIds', 'count', 'retryMasked', 'source', 'retryRate'],
        properties: {
          testName: { type: 'string' },
          errorPattern: { type: 'string' },
          runIds: { type: 'array', items: { type: 'string' } },
          count: { type: 'number' },
          retryMasked: { type: 'boolean' },
          source: { type: 'string', enum: ['failure', 'retryRate'] },
          retryRate: { type: 'number' },
        },
      },
    },
  },
}

const PRIOR_WIS_SCHEMA = {
  type: 'object',
  required: ['priorAttempts'],
  properties: {
    priorAttempts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['wiName', 'subject', 'prNumber', 'approach', 'stillFlaky'],
        properties: {
          wiName: { type: 'string' },
          subject: { type: 'string' },
          prNumber: { type: 'number' },
          approach: { type: 'string' },
          stillFlaky: { type: 'boolean' },
        },
      },
    },
  },
}

const HYPOTHESES_SCHEMA = {
  type: 'object',
  required: ['hypotheses'],
  properties: {
    hypotheses: {
      type: 'array',
      items: {
        type: 'object',
        required: ['testName', 'rootCause', 'evidence', 'proposedFix', 'priorAttemptWiNames'],
        properties: {
          testName: { type: 'string' },
          rootCause: { type: 'string' },
          evidence: {
            type: 'object',
            required: ['runId', 'artifactPath', 'failureMessage'],
            properties: {
              runId: { type: 'string' },
              artifactPath: { type: 'string' },
              failureMessage: { type: 'string' },
            },
          },
          proposedFix: { type: 'string' },
          priorAttemptWiNames: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const METRICS_SCHEMA = {
  type: 'object',
  required: ['workflowMetrics', 'testMetrics'],
  properties: {
    workflowMetrics: {
      type: 'array',
      items: {
        type: 'object',
        required: ['workflowName', 'totalRuns', 'rerunCount', 'rerunRate', 'failureCount'],
        properties: {
          workflowName: { type: 'string' },
          totalRuns: { type: 'number' },
          rerunCount: { type: 'number' },
          rerunRate: { type: 'number' },
          failureCount: { type: 'number' },
        },
      },
    },
    testMetrics: {
      type: 'array',
      items: {
        type: 'object',
        required: ['testName', 'totalRuns', 'failCount', 'retryCount', 'retryRate', 'workflowName'],
        properties: {
          testName: { type: 'string' },
          totalRuns: { type: 'number' },
          failCount: { type: 'number' },
          retryCount: { type: 'number' },
          retryRate: { type: 'number' },
          workflowName: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reason', 'unsupportedClaims', 'survivingClaim'],
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
    unsupportedClaims: { type: 'array', items: { type: 'string' } },
    survivingClaim: { type: 'string' },
  },
}

const WI_DRAFTS_SCHEMA = {
  type: 'object',
  required: ['drafts'],
  properties: {
    drafts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['subject', 'details'],
        properties: {
          subject: { type: 'string' },
          details: { type: 'string' },
        },
      },
    },
  },
}

// =====================================================================
// PHASE 1: SCAN CI RUNS
// =====================================================================

phase('Scan CI runs')

const runsResult = await agent(
  `Scan GitHub Actions for Playwright E2E CI runs on the \`develop\` branch of ${REPO} in the last ${DAYS} days.

Run this command and parse the output:
\`\`\`bash
gh run list --repo ${REPO} --branch develop --limit 200 \\
  --json databaseId,workflowName,conclusion,createdAt,attempt \\
  --jq '[.[] | select(.workflowName | test("Playwright|E2E|e2e"; "i"))]'
\`\`\`

For each run, also check if it was re-attempted (attempt > 1) — that's a strong signal of flakiness even if the final conclusion is "success".

Return all runs from the last ${DAYS} days (filter by createdAt). Include runs with conclusion: success/failure/cancelled. Mark hadRetries=true if attempt > 1 OR if conclusion=="failure" and a later run of the same workflow on the same day succeeded.`,
  { label: 'scan:runs', phase: 'Scan CI runs', schema: RUNS_SCHEMA }
)

if (!runsResult || !runsResult.runs.length) {
  log('No Playwright E2E runs found in the last ' + DAYS + ' days — nothing to analyze.')
  return { hypotheses: [], wis: [] }
}

log(`Found ${runsResult.runs.length} E2E runs. Collecting metrics...`)

// =====================================================================
// PHASE 2: COLLECT METRICS
// =====================================================================
// Workflow-level: rerun rate from gh run list (attempt > 1).
// Test-level: retry counts from Playwright JSON artifacts (results.json has
//   per-test retry arrays). GitHub Actions has no native per-test API —
//   the source of truth is the artifact reports we download.

phase('Collect metrics')

const metricsResult = await agent(
  `Collect flakiness metrics for E2E CI runs in ${REPO} over the last ${DAYS} days.

## Runs to analyze
${JSON.stringify(runsResult.runs, null, 2)}

## Part 1 — Workflow-level metrics (from runs data above, no new gh calls needed)

Group runs by workflowName. For each workflow compute:
- totalRuns: count of runs in the window
- rerunCount: runs where attempt > 1 (were manually or automatically re-triggered)
- rerunRate: rerunCount / totalRuns (as 0–1 float, round to 2dp)
- failureCount: runs with conclusion == "failure"

## Part 2 — Test-level metrics (requires downloading artifacts)

For each run with conclusion=="failure" OR hadRetries==true, download the playwright-report artifacts and extract per-test retry data:

\`\`\`bash
# Download report for a run (skip if already present)
gh run download <run-id> --repo ${REPO} -D ${ARTIFACTS_ROOT}/develop/<run-id> --pattern "playwright-report*" 2>/dev/null || true

# Find Playwright JSON results (contains per-test retry arrays)
find ${ARTIFACTS_ROOT}/develop/<run-id> -name "*.json" -path "*/test-results/*" | head -5
find ${ARTIFACTS_ROOT}/develop/<run-id> -name "results.json" | head -5
\`\`\`

Parse each results JSON. Playwright result format has tests with a \`results\` array — each element is one attempt. Length > 1 means retries occurred. A test that eventually passed (last result status=="passed") but had retries is retry-masked flakiness.

\`\`\`bash
python3 - <<'PY'
import glob, json, collections
retry_counts = collections.Counter()
fail_counts = collections.Counter()
run_counts = collections.Counter()
for path in glob.glob('${ARTIFACTS_ROOT}/develop/**/results.json', recursive=True):
    try:
        data = json.load(open(path))
        # Playwright JSON: data.suites -> nested -> specs -> tests -> results[]
        def walk(node):
            for suite in node.get('suites', []):
                walk(suite)
            for spec in node.get('specs', []):
                for test in spec.get('tests', []):
                    title = spec.get('title', 'unknown')
                    results = test.get('results', [])
                    run_counts[title] += 1
                    if len(results) > 1:
                        retry_counts[title] += len(results) - 1
                    if results and results[-1].get('status') not in ('passed', 'skipped'):
                        fail_counts[title] += 1
        walk(data)
    except Exception as e:
        pass
all_tests = set(list(retry_counts.keys()) + list(fail_counts.keys()))
for t in sorted(all_tests, key=lambda x: -(retry_counts[x] + fail_counts[x]))[:30]:
    print(json.dumps({'test': t, 'retries': retry_counts[t], 'fails': fail_counts[t], 'runs': run_counts[t]}))
PY
\`\`\`

Collect test metrics for any test with retryCount > 0 or failCount > 0. Compute retryRate = retryCount / totalRuns (0–1 float).

Return both workflowMetrics and testMetrics sorted by rerunRate/retryRate descending.`,
  { label: 'collect:metrics', phase: 'Collect metrics', schema: METRICS_SCHEMA }
)

const metricsData = metricsResult || { workflowMetrics: [], testMetrics: [] }
log(`Metrics: ${metricsData.workflowMetrics.length} workflows, ${metricsData.testMetrics.length} tests with retries/failures`)

// =====================================================================
// PHASE 3: CLUSTER FAILURES
// =====================================================================

phase('Cluster failures')

const runIds = runsResult.runs.map(r => r.runId)

const clustersResult = await agent(
  `Analyze GitHub Actions runs for test-level failures and retry patterns in ${REPO}.

Run IDs to check: ${JSON.stringify(runIds.slice(0, 30))}

For each run, use:
\`\`\`bash
gh run view <run-id> --repo ${REPO} --json jobs \\
  --jq '.jobs[] | {name: .name, conclusion: .conclusion, steps: [.steps[] | {name: .name, conclusion: .conclusion, number: .number}]}'
\`\`\`

Also check for Playwright retry patterns by looking at job names that include attempt numbers (e.g., "run-1", "run-2") or jobs that were re-run.

Then for failed or retried runs, download the playwright-report artifact summary if available:
\`\`\`bash
gh run download <run-id> --repo ${REPO} -D ${ARTIFACTS_ROOT}/develop/<run-id> --pattern "playwright-report*" 2>/dev/null || true
# Then look for failed tests:
find ${ARTIFACTS_ROOT}/develop/<run-id> -name "*.json" | xargs grep -l '"status":"failed"' 2>/dev/null | head -5
\`\`\`

Group failures by: test name + error message pattern (first 120 chars of the error). A test that appears with the same error pattern across ${MIN_FAILURE_COUNT}+ runs is a cluster. Also flag any test that only passes after retries (retryMasked=true).

## Per-test retry metrics
${JSON.stringify(metricsData.testMetrics, null, 2)}

For EVERY cluster you emit:
- Set \`retryRate\` by looking up the cluster's \`testName\` in the testMetrics array above (match on \`testName\`); if absent, \`retryRate: 0\`.
- Set \`source\`: \`'failure'\` for run-level-failure clusters, \`'retryRate'\` for retry-threshold clusters (below).

Also emit a cluster for ANY testMetrics entry with \`retryRate >= ${RETRY_RATE_THRESHOLD}\` AND \`totalRuns >= ${RETRY_MIN_RUNS}\`, even with 0 hard failures — retries mask a green run-level result. For such clusters: \`source: 'retryRate'\`, \`retryMasked: true\`, \`count\` = that entry's \`retryCount\`, \`runIds\` = best-available run ids for the test (empty array if none), \`errorPattern\` = brief note that this is retry-masked flake.

Sort clusters by count descending. Return top clusters.`,
  { label: 'cluster:failures', phase: 'Cluster failures', schema: CLUSTERS_SCHEMA }
)

if (!clustersResult || !clustersResult.clusters.length) {
  log('No repeated failure clusters found — tests look stable.')
  return { hypotheses: [], wis: [] }
}

log(`Found ${clustersResult.clusters.length} failure clusters. Top: ${clustersResult.clusters[0].testName}`)

// =====================================================================
// PHASE 3: FILTER TRENDING-RESOLVED CLUSTERS
// =====================================================================
// A cluster is "trending resolved" if:
//   - Its most recent occurrence is older than half the lookback window, AND
//   - The most recent N runs of that workflow all succeeded without retries
// These were likely fixed by a recent code/dep change — don't propose new WIs.

phase('Filter resolved')

const RESOLVED_SCHEMA = {
  type: 'object',
  required: ['activeClusterIndices', 'resolvedSummary'],
  properties: {
    activeClusterIndices: { type: 'array', items: { type: 'number' } },
    resolvedSummary: { type: 'string' },
  },
}

const resolvedResult = await agent(
  `Determine which failure clusters are "trending resolved" — likely fixed by a recent code or dependency change — and should be excluded from further investigation.

## Clusters to evaluate
${JSON.stringify(clustersResult.clusters, null, 2)}

## All runs (with dates and conclusions)
${JSON.stringify(runsResult.runs, null, 2)}

## Lookback window: ${DAYS} days

A cluster is trending-resolved if BOTH:
1. Its most recent failure (latest runId) is from the first half of the lookback window (older than ${Math.floor(DAYS / 2)} days ago), AND
2. The workflow runs in the second half of the window all show conclusion=="success" and attempt==1 (no reruns)

Also treat as resolved if the failure pattern is clearly tied to a known-fixed external cause:
- Playwright version bumps (test failures mentioning "locator" or "element" API changes that then disappear)
- VS Code version bumps (failures mentioning chromium, vscode api, extension activation that then disappear)
- Any cluster whose runIds are all older than 2 days and haven't recurred

For each cluster, check the run dates and recent workflow conclusions. Use the runs list above (don't make new gh calls for this phase — use what you already have).

Return:
- activeClusterIndices: indices (0-based) of clusters that are still active and need investigation
- resolvedSummary: brief description of what was filtered out and why (e.g. "2 clusters filtered: playwright bump fallout resolved after PR #7490, last seen 2026-06-14")`,
  { label: 'filter:resolved', phase: 'Filter resolved', schema: RESOLVED_SCHEMA }
)

const activeIndices = resolvedResult ? resolvedResult.activeClusterIndices : clustersResult.clusters.map((_, i) => i)
const activeClusters = activeIndices.map(i => clustersResult.clusters[i]).filter(Boolean)

if (resolvedResult && resolvedResult.resolvedSummary) {
  log(`Filtered: ${resolvedResult.resolvedSummary}`)
}

if (!activeClusters.length) {
  log('All failure clusters appear to be trending resolved — no active flakiness to investigate.')
  return { hypotheses: [], wis: [], resolvedSummary: resolvedResult && resolvedResult.resolvedSummary }
}

log(`${activeClusters.length} active cluster(s) after filtering resolved issues.`)

const topClusters = activeClusters.slice(0, MAX_ARTIFACT_CLUSTERS)

// =====================================================================
// PHASE 4: DOWNLOAD ARTIFACTS + PHASE 5: ASSESS PRIOR WIs (parallel)
// =====================================================================

phase('Download artifacts')

const [artifactFindings, priorWisResult] = await parallel([
  // Download and analyze artifacts for top clusters
  () => pipeline(
    topClusters,
    async (cluster, _orig, i) => {
      const runId = cluster.runIds[0]
      return agent(
        `Download and analyze CI artifacts for a flaky test cluster in ${REPO}.

Test: "${cluster.testName}"
Error pattern: "${cluster.errorPattern}"
Primary run ID: ${runId}
Retry-masked (passed after retries): ${cluster.retryMasked}

Steps:
1. Download artifacts:
\`\`\`bash
gh run download ${runId} --repo ${REPO} -D ${ARTIFACTS_ROOT}/develop/${runId} 2>/dev/null || echo "already downloaded"
\`\`\`

2. Find relevant files:
\`\`\`bash
# Screenshots
find ${ARTIFACTS_ROOT}/develop/${runId} -name "*.png" | head -10
# Videos (webm)
find ${ARTIFACTS_ROOT}/develop/${runId} -name "*.webm" | head -5
# Span files
find ${ARTIFACTS_ROOT}/develop/${runId} -name "*.jsonl" | head -5
# Test result JSON
find ${ARTIFACTS_ROOT}/develop/${runId} -name "results.json" -o -name "test-results.json" | head -3
\`\`\`

3. Read failure detail from test results JSON if found. Look for: error message, stack trace, timeout value, what assertion failed.

4. If span files exist, find ERROR-status spans related to this test:
\`\`\`bash
python3 - <<'PY'
import glob, json
for path in glob.glob('${ARTIFACTS_ROOT}/develop/${runId}/**/*.jsonl', recursive=True):
    with open(path) as f:
        for line in f:
            try:
                s = json.loads(line)
                if s.get('status', {}).get('code') == 2:
                    print(json.dumps({'name': s.get('name'), 'durationMs': s.get('durationMs'), 'msg': s.get('status', {}).get('message', '')[:200]}))
            except: pass
PY
\`\`\`

5. If a video exists and the test has a known failure timestamp from the results JSON, extract frames:
\`\`\`bash
mkdir -p ${ARTIFACTS_ROOT}/frames/${runId}
ffmpeg -i <video.webm> -ss <start_sec> -to <end_sec> -vf "fps=4" -q:v 2 ${ARTIFACTS_ROOT}/frames/${runId}/frame_%04d.png 2>/dev/null
# Then read the frames to see what was on screen
\`\`\`

Return a summary: what artifact evidence you found, what the failure message said, what spans showed, what the video frames revealed. Be specific — quote actual error messages and span names. If no artifacts, say so explicitly.`,
        { label: `artifacts:${i}:${cluster.testName.slice(0, 30)}`, phase: 'Download artifacts' }
      )
    }
  ),

  // Assess prior WIs in EDE epic
  () => agent(
    `Assess which prior work items in the IDE e2e improvements GUS epic have already attempted to fix E2E flakiness, and whether those fixes are still effective.

1. Query closed WIs in the epic:
\`\`\`bash
sf data query --query "SELECT Id, Name, Subject__c, Status__c FROM ADM_Work__c WHERE Epic__c = '${EDE_EPIC_ID}' AND Status__c IN ('Closed', 'Completed') ORDER BY LastModifiedDate DESC LIMIT 40" -o gus --result-format json 2>/dev/null
\`\`\`

2. For WIs whose Subject__c mentions: flak, retry, waitFor, timeout, tolerate, deterministic, race, stable, deflake — find their linked merged PR by searching:
\`\`\`bash
gh pr list --repo ${REPO} --state merged --limit 100 \\
  --json number,title,mergedAt --jq '.[] | select(.title | test("W-NNNNN"))'
\`\`\`
(Replace W-NNNNN with the WI Name, e.g. W-22972995)

3. For each matched PR, read the diff summary:
\`\`\`bash
gh pr diff <number> --repo ${REPO} | head -200
\`\`\`

4. Determine: what approach did it take? Is the problem it targeted still appearing in recent CI runs (from the last 7 days)? Mark stillFlaky=true if the same test/pattern still shows up.

Return a list of prior attempts with their approach and whether the problem persists.`,
    { label: 'assess:prior-wis', phase: 'Assess prior WIs', schema: PRIOR_WIS_SCHEMA }
  )
])

// =====================================================================
// PHASE 5: HYPOTHESIZE
// =====================================================================

phase('Hypothesize')

const artifactSummaries = (artifactFindings || []).filter(Boolean)
const priorAttempts = priorWisResult ? priorWisResult.priorAttempts : []

const hypothesesResult = await agent(
  `Form evidence-backed root-cause hypotheses for E2E test flakiness.

## Failure clusters
${JSON.stringify(topClusters, null, 2)}

## Artifact findings (per cluster)
${artifactSummaries.map((s, i) => `### Cluster ${i}: ${topClusters[i]?.testName}\n${s}`).join('\n\n')}

## Prior WI attempts and their effectiveness
${JSON.stringify(priorAttempts, null, 2)}

## Rules
- Every hypothesis MUST cite: runId, artifactPath (or span name), and the exact failure message/error
- Do NOT propose: test skipping, platform-gating, waitForTimeout increases, retry inflation, or multi-layer fallbacks
- Do NOT re-propose approaches that prior WIs already tried if stillFlaky=false (they worked)
- If a prior WI tried something and stillFlaky=true, you MAY propose going further or trying a different angle
- Focus on: deterministic waits, polling on observable state, better assertions, fixing race conditions, removing timing dependencies, improving test setup/teardown isolation

For each valid hypothesis, propose a concrete fix approach (e.g., "replace waitForTimeout(2000) with polling on file existence", "assert on notification text not just visibility", "use page.waitForSelector with state:'attached' instead of state:'visible'").

Return only hypotheses with solid artifact evidence. If a cluster has no artifact evidence, omit it.`,
  { label: 'hypothesize', phase: 'Hypothesize', schema: HYPOTHESES_SCHEMA }
)

if (!hypothesesResult || !hypothesesResult.hypotheses.length) {
  log('No evidence-backed hypotheses formed — all failures may be infrastructure noise or already addressed.')
  return { hypotheses: [], wis: [] }
}

log(`Formed ${hypothesesResult.hypotheses.length} hypotheses. Challenging each...`)

// =====================================================================
// PHASE 6: CHALLENGE
// =====================================================================
// One adversarial agent per hypothesis. Its job is to REFUTE the claim
// by going back to the artifact files and the repo source. Rules:
//   - Every retained claim must be cited to a file:line or artifact path
//   - No reasoning from "likely", "probably", or VS Code internals unless
//     the source code is publicly readable and the agent can verify it
//   - If the screenshot/artifact does NOT show what the hypothesis claims,
//     refuted=true
//   - If the proposed fix addresses a different failure mode than what the
//     artifact actually shows, refuted=true
//   - unsupportedClaims: list every sentence in the hypothesis that is
//     asserted without a citable source in this repo or the downloaded artifact

phase('Challenge')

const verdicts = await parallel(
  hypothesesResult.hypotheses.map((h, i) => () => agent(
    `You are an adversarial reviewer. Your job is to REFUTE this flakiness hypothesis if you can.
Default to refuted=true if you are uncertain.

## Hypothesis
Test: ${h.testName}
Root cause: ${h.rootCause}
Evidence cited: run ${h.evidence.runId}, artifact ${h.evidence.artifactPath}, error: "${h.evidence.failureMessage}"
Proposed fix: ${h.proposedFix}

## Your task

1. Open the cited artifact and read it:
\`\`\`bash
cat "${h.evidence.artifactPath}" 2>/dev/null || echo "FILE NOT FOUND"
# Also look for screenshots in the same directory:
ls $(dirname "${h.evidence.artifactPath}")/*.png 2>/dev/null | head -5
\`\`\`

2. Read the cited source file(s) if a file:line is mentioned in rootCause or proposedFix:
\`\`\`bash
# e.g. grep -n "relevant term" packages/.../spec.ts | head -20
\`\`\`

3. For every causal claim in rootCause, ask:
   - Is this directly visible in the artifact/screenshot? If not, is it in a file in this repo?
   - If neither, it is unsupported — list it.

4. Ask: does the proposed fix actually address what the artifact shows went wrong?
   - If the artifact shows failure mode X but the fix targets failure mode Y, refuted=true.

5. Ask: does the hypothesis conflate two separate failure modes into one root cause?
   - If yes, note it in reason and set refuted=true.

Rules:
- Do NOT cite VS Code internals, browser behavior, or CSS unless you can point to a public VS Code source file URL or a file in this repo that documents it
- "The screenshot shows..." is a valid citation if you actually read the screenshot
- "VS Code probably does X" is not a valid citation — mark it unsupported
- survivingClaim: the minimum claim that IS supported by artifacts/repo files (may be empty string if nothing survives)`,
    { label: `challenge:${i}:${h.testName.slice(0, 25)}`, phase: 'Challenge', schema: VERDICT_SCHEMA }
  ))
)

const confirmedHypotheses = hypothesesResult.hypotheses
  .map((h, i) => ({ h, verdict: verdicts[i] }))
  .filter(({ verdict }) => verdict && !verdict.refuted)
  .map(({ h, verdict }) => ({ ...h, survivingClaim: verdict.survivingClaim }))

const refutedSummary = hypothesesResult.hypotheses
  .map((h, i) => ({ h, verdict: verdicts[i] }))
  .filter(({ verdict }) => verdict && verdict.refuted)
  .map(({ h, verdict }) => `- **${h.testName}**: ${verdict.reason}`)
  .join('\n')

if (refutedSummary) log(`Refuted:\n${refutedSummary}`)
log(`${confirmedHypotheses.length} of ${hypothesesResult.hypotheses.length} hypotheses survived challenge.`)

if (!confirmedHypotheses.length) {
  log('No hypotheses survived adversarial review — nothing to draft.')
  return { hypotheses: [], refuted: refutedSummary, wis: [] }
}

// =====================================================================
// PHASE 7: DRAFT WIs
// =====================================================================

phase('Draft WIs')

const wiDraftsResult = await agent(
  `Draft GUS work items for E2E flakiness fixes.

## Hypotheses (adversarially verified — unsupported claims stripped)
${JSON.stringify(confirmedHypotheses, null, 2)}

## Prior WI attempts (for context — don't duplicate)
${JSON.stringify(priorAttempts, null, 2)}

For each hypothesis, draft a work item:
- Subject: \`[ai-auto] e2e: <concise fix description>\` (max 80 chars)
- Details (plain text, min 20 chars):
  - What the test does and what's flaky
  - Root cause (cite the exact evidence: run ID, error message, span/artifact)
  - Proposed fix approach (concrete — name the file/function/assertion to change)
  - Prior attempts if any (what was tried, why it's not enough)
  - What "done" looks like (test passes without retries, no waitForTimeout)

Do NOT propose: skipping tests, platform restrictions, waitForTimeout, retry increases, fallbacks.
Each Details__c must be plain text (no HTML), ≥ 20 chars.

Return the draft list.`,
  { label: 'draft:wis', phase: 'Draft WIs', schema: WI_DRAFTS_SCHEMA }
)

if (!wiDraftsResult || !wiDraftsResult.drafts.length) {
  log('No WI drafts produced.')
  return { hypotheses: confirmedHypotheses, refuted: refutedSummary, wis: [] }
}

// =====================================================================
// PHASE 7: WRITE REPORT
// =====================================================================

phase('Write report')

// Report lives next to artifacts, named by date so multiple runs don't collide.
// Use a fixed timestamp passed via args so the filename is deterministic on resume.
const reportTs = (args && args.reportTs) || 'latest'
const reportDir = `${ARTIFACTS_ROOT}/flakiness-reports`
const reportPath = `${reportDir}/flakiness-review-${reportTs}.md`

const reportResult = await agent(
  `Write a human-reviewable flakiness review report as a concise markdown file.

## Context
- Lookback: ${DAYS} days
- Filtered/resolved clusters: ${resolvedResult ? resolvedResult.resolvedSummary : 'none'}
- Active clusters analyzed: ${topClusters.length}
- Repo: https://github.com/${REPO}
- Artifacts root: ${ARTIFACTS_ROOT}/develop/

## Metrics
${JSON.stringify(metricsData, null, 2)}

## Confirmed hypotheses (survived adversarial challenge)
${JSON.stringify(confirmedHypotheses, null, 2)}

## Refuted hypotheses
${refutedSummary || 'none'}

## Artifact findings (per cluster)
${artifactSummaries.map((s, i) => `### Cluster ${i}: ${topClusters[i]?.testName}\n${s}`).join('\n\n')}

## Prior WI attempts
${JSON.stringify(priorAttempts, null, 2)}

## Draft WIs
${JSON.stringify(wiDraftsResult.drafts, null, 2)}

---

Write the report to \`${reportPath}\`. Create \`${reportDir}\` if needed.

Report format — apply /concise style (fragments, not full sentences; cut redundancy):

\`\`\`
# Flakiness Review — <DAYS>-day lookback

> Generated <date>. Review findings below; run \`/flakiness-review create-wis\` to create approved items.

## Metrics

### Workflow rerun rates
| Workflow | Runs | Reruns | Rerun rate | Failures |
|----------|------|--------|-----------|----------|
| ...      |      |        |           |          |

### Test retry rates (top flaky tests)
| Test | Runs | Retries | Retry rate | Failures |
|------|------|---------|-----------|----------|
| ...  |      |         |           |          |

_Retry rate = retries / runs. A test with retry rate > 0 is flaky even if it never fully failed._

## Resolved / filtered
_Brief bullet per filtered cluster — what it was, why dismissed_

## Refuted findings
_Brief bullet per hypothesis that failed adversarial challenge — what claim couldn't be cited, what the artifact actually showed_

## Active findings

### 1. <Test name> — <root cause in ≤8 words>
**Seen:** N times across runs <runId1>, <runId2>
**Retry-masked:** yes/no
**Error:** \`<exact error message, truncated at 120 chars>\`
**Evidence:** [screenshot](<relative path>) · [video frame](<relative path>) · [span: <span name>]
**Prior attempts:** W-XXXXX (<what it did>, <still flaky?>)
**Code:** \`<file>:<line>\` — <what's wrong>
**Proposed fix:** <concrete 1-2 sentence description — name the function/assertion/helper to change>

---
_repeat per finding_

## Proposed WIs
| # | Subject | Points |
|---|---------|--------|
| 1 | [ai-auto] e2e: ... | — |
| 2 | ... | — |

_To create: confirm with "create all" or "create 1,3" after reviewing findings above._
\`\`\`

Rules:
- All artifact links must be relative paths from the repo root (e.g. \`.e2e-artifacts/develop/12345/playwright-report/index.html\`)
- Link to the HTML playwright report if present: \`.e2e-artifacts/develop/<runId>/playwright-report/index.html\`
- Link to screenshots/frames using relative markdown image syntax: \`![desc](.e2e-artifacts/...)\`
- Code references: use \`packages/<pkg>/test/playwright/specs/<file>.ts:<line>\` format if you can identify it from the error stack
- If a prior WI's PR is known, link it: [W-XXXXX](https://github.com/${REPO}/pull/<pr>)
- Skip sections with nothing to say (no prior attempts → omit that row)
- Use a horizontal rule between findings
- Keep the whole report under ~150 lines

After writing the file, return the report path and a one-sentence summary of findings.`,
  { label: 'write:report', phase: 'Write report' }
)

log(`Report written: ${reportPath}`)
log(`To create WIs: review ${reportPath} then confirm "create all" or "create N,M"`)

return {
  hypotheses: confirmedHypotheses,
  refuted: refutedSummary,
  drafts: wiDraftsResult.drafts,
  epicId: EDE_EPIC_ID,
  reportPath,
}
