export const meta = {
  name: 'flakiness-review',
  description: 'Periodic E2E flakiness review: scan CI runs, download artifacts, form evidence-backed hypotheses, assess prior WI impact, draft GUS WIs.',
  whenToUse: 'Run via /flakiness-review. Pass args.days (default 7) to control lookback window.',
  phases: [
    { title: 'Scan CI runs' },
    { title: 'Cluster failures' },
    { title: 'Filter resolved' },
    { title: 'Download artifacts' },
    { title: 'Assess prior WIs' },
    { title: 'Hypothesize' },
    { title: 'Draft WIs' },
  ],
}

// =====================================================================
// CONSTANTS
// =====================================================================

const DAYS = (args && args.days) || 7
const EDE_EPIC_ID = 'a3QEE000002AZ8D2AW'
const REPO = 'forcedotcom/salesforcedx-vscode'
const ARTIFACTS_ROOT = '.e2e-artifacts'
// Max test clusters to download artifacts for (cost guard)
const MAX_ARTIFACT_CLUSTERS = 5
// Min failure appearances across runs to be worth investigating
const MIN_FAILURE_COUNT = 2

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
        required: ['testName', 'errorPattern', 'runIds', 'count', 'retryMasked'],
        properties: {
          testName: { type: 'string' },
          errorPattern: { type: 'string' },
          runIds: { type: 'array', items: { type: 'string' } },
          count: { type: 'number' },
          retryMasked: { type: 'boolean' },
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

log(`Found ${runsResult.runs.length} E2E runs. Checking for failures and retries...`)

// =====================================================================
// PHASE 2: CLUSTER FAILURES
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

log(`Formed ${hypothesesResult.hypotheses.length} hypotheses. Drafting WIs...`)

// =====================================================================
// PHASE 6: DRAFT WIs
// =====================================================================

phase('Draft WIs')

const wiDraftsResult = await agent(
  `Draft GUS work items for E2E flakiness fixes.

## Hypotheses
${JSON.stringify(hypothesesResult.hypotheses, null, 2)}

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
  return { hypotheses: hypothesesResult.hypotheses, wis: [] }
}

// Present to user for confirmation before creating
log(`\n${'='.repeat(60)}\nFLAKINESS REVIEW COMPLETE\n${'='.repeat(60)}\n`)
log(`Proposed ${wiDraftsResult.drafts.length} WI(s) in epic IDE e2e improvements (${EDE_EPIC_ID}):\n`)

wiDraftsResult.drafts.forEach((d, i) => {
  log(`\n--- WI ${i + 1} ---`)
  log(`Subject: ${d.subject}`)
  log(`Details:\n${d.details}`)
})

log(`\nReview the drafts above. To create them, confirm via the gus-cli skill (safety rule: write only after explicit confirmation).`)

return {
  hypotheses: hypothesesResult.hypotheses,
  drafts: wiDraftsResult.drafts,
  epicId: EDE_EPIC_ID,
}
