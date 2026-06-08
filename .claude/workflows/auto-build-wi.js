export const meta = {
  name: 'auto-build-wi',
  description: 'Drain GUS work items tagged [ai-auto] end-to-end: claim → plan → build → review → draft PR. Stateless across ticks; pair with /loop.',
  whenToUse: 'Run on a schedule via /loop (e.g. /loop 10m /auto-build-wi). Each tick monitors in-flight WIs and may claim a new one.',
  phases: [
    { title: 'Resolve identity' },
    { title: 'Ensure daemons' },
    { title: 'Reap stranded worktrees' },
    { title: 'Monitor in-flight' },
    { title: 'Triage failures' },
    { title: 'Fix CI failures' },
    { title: 'Close merged WIs' },
    { title: 'Keep in-flight current' },
    { title: 'Open for review' },
    { title: 'Peer approve' },
    { title: 'Pick candidate' },
    { title: 'Claim + worktree' },
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Review' },
    { title: 'Verify findings' },
    { title: 'Fix review findings' },
    { title: 'Draft PR' },
  ],
}

// =====================================================================
// CONSTANTS
// =====================================================================

const MAX_IN_FLIGHT = (args && args.maxInFlight) || 5
const SMALL_DIFF_LINES = 20
const ALWAYS_APPLICABLE_SKILLS = ['typescript', 'concise', 'paths']
const SKILLS_DIR = '.claude/skills'
// Skills not relevant to code review of a diff — operational workflows or environmental setup.
const REVIEW_SKILL_DENYLIST = [
  'changelog',
  'feature-branch',
  'grill-me',
  'gus-cli',
  'merge-conflicts',
  'pr-draft',
  'release',
  'shipped-issues',
  'query-app-insights',
  'span-file-export',
]
const REVIEW_CHANNEL_ID = 'C054SJJAB24'
const PR_URL_RE = /https?:\/\/github\.com\/forcedotcom\/salesforcedx-vscode\/pull\/\d+/g

// =====================================================================
// SCHEMAS
// =====================================================================

const IDENTITY_SCHEMA = {
  type: 'object',
  required: ['userId', 'username', 'ownerPrefix', 'slackId', 'githubLogin', 'projectRoot'],
  properties: {
    userId: { type: 'string' },
    username: { type: 'string' },
    ownerPrefix: { type: 'string' },
    slackId: { type: 'string' },
    githubLogin: { type: 'string' },
    projectRoot: { type: 'string' },
    error: { type: 'string' },
  },
}

const PR_STATE_SCHEMA = {
  type: 'object',
  required: ['state'],
  properties: {
    state: { enum: ['green', 'failed', 'running', 'no-pr', 'merged', 'closed'] },
    prUrl: { type: ['string', 'null'] },
    prNumber: { type: ['number', 'null'] },
    isDraft: { type: ['boolean', 'null'] },
    mergeable: { type: ['string', 'null'] },
    failedJobs: { type: 'array', items: { type: 'string' } },
    failedLogsExcerpt: { type: ['string', 'null'] },
    maxRunAttempt: { type: ['number', 'null'] },
  },
}

const TRIAGE_SCHEMA = {
  type: 'object',
  required: ['route', 'summary'],
  properties: {
    route: { enum: ['flake-or-infra', 'e2e-test-issue', 'code-bug', 'unknown'] },
    summary: { type: 'string' },
  },
}

const PLAN_SCHEMA = {
  type: 'object',
  required: ['verdict'],
  properties: {
    verdict: { enum: ['plan', 'blocked'] },
    blocked: {
      type: 'object',
      properties: { questions: { type: 'array', items: { type: 'string' } } },
    },
    plan: {
      type: 'object',
      properties: {
        phases: {
          type: 'array',
          items: {
            type: 'object',
            required: ['title', 'commitMessage'],
            properties: {
              title: { type: 'string' },
              files: { type: 'array', items: { type: 'string' } },
              commitMessage: { type: 'string' },
              detail: { type: 'string' },
            },
          },
        },
        skills: { type: 'array', items: { type: 'string' } },
        verification: { type: 'array', items: { type: 'string' } },
      },
    },
  },
}

const PLAN_REVIEW_SCHEMA = {
  type: 'object',
  required: ['approved'],
  properties: {
    approved: { type: 'boolean' },
    revisions: { type: 'array', items: { type: 'string' } },
  },
}

const EFFECT_ADVOCATE_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    verdict: { enum: ['LGTM', 'minor', 'needs rework'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'suggestion'],
        properties: {
          severity: { enum: ['must', 'should', 'consider'] },
          file: { type: ['string', 'null'] },
          line: { type: ['number', 'null'] },
          suggestion: { type: 'string' },
          citation: { type: ['string', 'null'] },
        },
      },
    },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { enum: ['done', 'stuck'] },
    commits: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
  },
}

const SKILL_DETECT_SCHEMA = {
  type: 'object',
  required: ['applies', 'findings'],
  properties: {
    applies: { type: 'boolean' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'suggestion'],
        properties: {
          severity: { enum: ['critical', 'high', 'medium', 'low'] },
          file: { type: ['string', 'null'] },
          line: { type: ['number', 'null'] },
          suggestion: { type: 'string' },
        },
      },
    },
  },
}

const THERMO_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'claim'],
        properties: {
          severity: { enum: ['critical', 'high', 'medium', 'low'] },
          file: { type: ['string', 'null'] },
          line: { type: ['number', 'null'] },
          claim: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
  },
}

const PLAN_ADVERSARY_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    verdict: { enum: ['LGTM', 'concerns', 'blocking'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'claim'],
        properties: {
          severity: { enum: ['critical', 'high', 'medium', 'low'] },
          section: { type: ['string', 'null'] },
          claim: { type: 'string' },
          evidence: { type: ['string', 'null'] },
          suggestion: { type: ['string', 'null'] },
        },
      },
    },
  },
}

const FIXER_SCHEMA = {
  type: 'object',
  required: ['fixedCount', 'remaining'],
  properties: {
    fixedCount: { type: 'number' },
    remaining: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'note'],
        properties: {
          severity: { enum: ['critical', 'high', 'medium', 'low'] },
          note: { type: 'string' },
        },
      },
    },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['verdict', 'severity', 'rationale'],
  properties: {
    // confirmed: premise verified, keep as-is.
    // downgraded: real but lower severity than claimed.
    // dropped: premise false, or already-covered (e.g. CI runs it), or zero affected consumers.
    verdict: { enum: ['confirmed', 'downgraded', 'dropped'] },
    severity: { enum: ['critical', 'high', 'medium', 'low'] },
    rationale: { type: 'string' },
    evidence: { type: ['string', 'null'] },
  },
}

const PR_DRAFT_SCHEMA = {
  type: 'object',
  required: ['prUrl', 'prNumber'],
  properties: {
    prUrl: { type: 'string' },
    prNumber: { type: 'number' },
  },
}

const PICKER_SCHEMA = {
  type: 'object',
  required: ['wiId', 'reason'],
  properties: { wiId: { type: 'string' }, reason: { type: 'string' } },
}

const OK_SCHEMA = {
  type: 'object',
  required: ['ok'],
  properties: { ok: { type: 'boolean' }, detail: { type: ['string', 'null'] } },
}

const WI_RECORDS_SCHEMA = {
  type: 'object',
  required: ['records'],
  properties: {
    records: {
      type: 'array',
      items: {
        type: 'object',
        required: ['Id', 'Name'],
        properties: {
          Id: { type: 'string' },
          Name: { type: 'string' },
          Subject__c: { type: ['string', 'null'] },
          Details__c: { type: ['string', 'null'] },
          Status__c: { type: ['string', 'null'] },
          Story_Points__c: { type: ['number', 'null'] },
          CreatedDate: { type: ['string', 'null'] },
          Assignee__c: { type: ['string', 'null'] },
        },
      },
    },
  },
}

const WI_STATUS_RECORDS_SCHEMA = {
  type: 'object',
  required: ['records'],
  properties: {
    records: {
      type: 'array',
      items: {
        type: 'object',
        required: ['Name'],
        properties: {
          Name: { type: 'string' },
          Status__c: { type: ['string', 'null'] },
        },
      },
    },
  },
}

const SKILL_LIST_SCHEMA = {
  type: 'object',
  required: ['skills'],
  properties: { skills: { type: 'array', items: { type: 'string' } } },
}

const DIFF_RAW_SCHEMA = {
  type: 'object',
  required: ['shortstat', 'files'],
  properties: {
    shortstat: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
  },
}

const FILES_SCHEMA = {
  type: 'object',
  required: ['files'],
  properties: { files: { type: 'array', items: { type: 'string' } } },
}

// =====================================================================
// HELPERS
// =====================================================================

const slugify = s =>
  String(s)
    .toLowerCase()
    .replace(/\[ai-auto\]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')

const projectBasename = projectRoot => projectRoot.replace(/\/+$/, '').split('/').pop()

const worktreePath = (identity, wiName, subject) =>
  `${identity.projectRoot}/../${projectBasename(identity.projectRoot)}-wt/${identity.ownerPrefix}-${wiName}-${slugify(subject)}`

const branchName = (ownerPrefix, wiName, subject) =>
  `${ownerPrefix}/${wiName}-${slugify(subject)}`

const pathsFor = (identity, wi) => ({
  wt: worktreePath(identity, wi.name, wi.subject),
  branch: branchName(identity.ownerPrefix, wi.name, wi.subject),
})

const extractPrUrl = details => {
  // Only extract PR URLs appended by the workflow (<strong>PR:</strong> <a href="...">).
  // Avoids treating "Prior art" / reference links as the WI's own PR.
  const s = String(details || '')
  const prSection = s.match(/<strong>PR:<\/strong>[\s\S]*?(https?:\/\/github\.com\/forcedotcom\/salesforcedx-vscode\/pull\/\d+)/)
  if (prSection) return prSection[1]
  return null
}

// Only match PRs appended by the workflow — formatted as <strong>PR:</strong> <a href="...">
// This avoids false positives from "Prior art" / reference links in the WI body.
const hasPrUrl = details =>
  /<strong>PR:<\/strong>[\s\S]*?github\.com\/forcedotcom\/salesforcedx-vscode\/pull\/\d+/.test(
    String(details || '')
  )

// A blocker is "satisfied" only once its work has actually merged — i.e. the WI
// reached a terminal closed/completed status. 'Ready for Review' / 'Fixed' mean
// the PR exists but hasn't merged, so a dependency in those states is NOT met.
const isBlockerSatisfied = status =>
  status === 'Completed' || status.startsWith('Closed')

const stripHtml = s => String(s || '').replace(/<[^>]+>/g, ' ')

// Extract WI names this WI declares a hard dependency on. A blocking keyword
// ("blocked by", "depends on", "after", "requires", "prerequisite") opens a
// short window; every W-number inside that window is a blocker — captures
// chained refs ("blocked by W-1 and W-2"). HTML is stripped first; sentence
// boundaries close the window so unrelated later refs aren't swept in.
const BLOCKER_RE =
  /(?:blocked by|depends on|dependent on|prerequisite|requires?|\bafter\b|\bonce\b)([^.\n]{0,80})/gi
const extractBlockers = (subject, details) => {
  const text = `${subject || ''} ${stripHtml(details)}`
  const names = [...text.matchAll(BLOCKER_RE)].flatMap(m =>
    [...m[1].matchAll(/W-\d+/g)].map(w => w[0])
  )
  return [...new Set(names)]
}

const mapWiRecord = r => ({
  wiId: r.Id,
  name: r.Name,
  subject: r.Subject__c || '',
  details: r.Details__c || '',
  status: r.Status__c || '',
  storyPoints: typeof r.Story_Points__c === 'number' ? r.Story_Points__c : null,
  createdDate: r.CreatedDate || '',
  prUrl: extractPrUrl(r.Details__c),
})

const parseShortstatLines = shortstat => {
  // e.g. " 3 files changed, 12 insertions(+), 4 deletions(-)"
  const ins = (shortstat.match(/(\d+)\s+insertion/) || [0, 0])[1]
  const del = (shortstat.match(/(\d+)\s+deletion/) || [0, 0])[1]
  return Number(ins) + Number(del)
}

// Severity rank for sorting/threshold logic. effect 'must'/'should'/'consider'
// map to critical/high/medium upstream before reaching here.
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

// Flatten every review source (per-skill, thermo, effect-advocate) into one
// uniform {source, severity, file, line, claim} list the verifier can chew on.
const normalizeFindings = (skillFindings, skillsToCheck, thermo, effectDiffReview) => {
  const effectSeverity = s => (s === 'must' ? 'critical' : s === 'should' ? 'high' : 'medium')
  const skill = skillFindings
    .map((r, i) => ({ r, name: skillsToCheck[i] }))
    .filter(({ r }) => r && r.applies)
    .flatMap(({ r, name }) =>
      (r.findings || []).map(f => ({
        source: `skill:${name}`,
        severity: f.severity,
        file: f.file ?? null,
        line: f.line ?? null,
        claim: f.suggestion,
      }))
    )
  const thermoF = ((thermo && thermo.findings) || []).map(f => ({
    source: 'thermo',
    severity: f.severity,
    file: f.file ?? null,
    line: f.line ?? null,
    claim: `${f.claim}${f.evidence ? ` [${f.evidence}]` : ''}`,
  }))
  const effectF = ((effectDiffReview && effectDiffReview.findings) || []).map(f => ({
    source: 'effect',
    severity: effectSeverity(f.severity),
    file: f.file ?? null,
    line: f.line ?? null,
    claim: `${f.suggestion}${f.citation ? ` [${f.citation}]` : ''}`,
  }))
  return [...skill, ...thermoF, ...effectF]
}

const classifyMonitor = monitorOutcomes => ({
  toFinalize: monitorOutcomes.filter(r => r && r.decision === 'finalize'),
  toTriage: monitorOutcomes.filter(r => r && r.decision === 'triage'),
  toRestart: monitorOutcomes.filter(
    r => r && (r.decision === 'no-pr-restart' || r.action === 'no-pr-restart')
  ),
  toCloseWi: monitorOutcomes.filter(r => r && r.decision === 'close-wi'),
  toRefresh: monitorOutcomes.filter(
    r =>
      r &&
      r.wi.prUrl &&
      r.prState &&
      r.prState.mergeable === 'CONFLICTING' &&
      r.decision !== 'close-wi'
  ),
})

// =====================================================================
// PROMPTS
// =====================================================================

const identityPrompt = `Resolve runner identity per .claude/skills/gus-cli/SKILL.md → ## Runner identity.

Schema: {userId, username, ownerPrefix, slackId, githubLogin, projectRoot}.

1. Capture currentProjectRoot = 'pwd' (the workflow runs from the project root). Strip trailing slashes.
2. 'sf alias list --json' → /^gus$/i. Missing → {error: "no gus alias — run 'sf org login web -a gus'"}. Value = currentUsername.
3. Read $HOME/.claude/runner-identity.json. Cache hit requires: all 6 fields present, cached username == currentUsername, AND cached projectRoot exists as a directory ('test -d "<cached.projectRoot>"'). On hit, return cached. Stop.
4. Miss → resolve per skill: query userId, match team table for githubLogin/slackId/ownerPrefix. Sanity-check team row Id == userId; mismatch → {error: "team table Id != User query Id"}. Not in table → {error: "runner '<currentUsername>' not in gus-cli Team members"}. Set projectRoot = currentProjectRoot.
5. mkdir -p $HOME/.claude; write JSON (all 6 fields). Write failure non-fatal — still return object.

Structured result only.`

const ensureGhaRerunPrompt = `Ensure the gha-rerun daemon is running.

Read .claude/skills/gha-rerun/SKILL.md (and .claude/commands/gha-rerun.md if present) to learn the launcher and how to detect a running daemon (process name, lock file, or state file). Check current state:
- If running: return {ok: true, detail: "already-running"}.
- If not: invoke the launcher per the skill, verify it's running, and return {ok: true, detail: "started"}.
- If launch fails: return {ok: false, detail: "<reason>"}.

Do not configure or rerun anything else. The daemon owns rerun budget; this step just keeps it alive.`

const reapWorktreesPrompt = identity =>
  `Reap worktrees + branches for WIs whose PRs are already merged/closed (e.g. user merged manually and the WI dropped out of the in-flight query).

Run from ${identity.projectRoot}:

1. List worktrees: 'git worktree list --porcelain'. Parse into entries.
2. For each entry, find its branch (porcelain 'branch refs/heads/<name>' line). Skip:
   - The main worktree (path == ${identity.projectRoot})
   - Any worktree under '${identity.projectRoot}/.claude/worktrees/' (workflow-isolation worktrees, not WI worktrees)
   - Any worktree whose branch does NOT start with '${identity.ownerPrefix}/W-'
3. For each remaining (path, branch), find a PR: 'gh pr list --head <branch> --state all --json number,state,url --limit 1'.
   - No PR found → leave it alone (still being built).
   - PR state == 'MERGED' or 'CLOSED' → reap:
     a. 'git worktree remove <path> --force'  (ignore failure)
     b. 'git branch -D <branch>'              (ignore failure)
   - PR state == 'OPEN' → leave it alone.

Return {ok: true, detail: '<n reaped>: <comma-separated branch names>'} or {ok: true, detail: 'none'} when nothing to reap. Never error out — partial progress is fine.`

const inFlightQueryPrompt = identity =>
  `Run this SOQL and return the raw records array.

sf data query --query "SELECT Id, Name, Subject__c, Details__c, Status__c, Story_Points__c, CreatedDate FROM ADM_Work__c WHERE Assignee__c = '${identity.userId}' AND Status__c IN ('In Progress', 'Ready for Review', 'Fixed') AND Subject__c LIKE '%[ai-auto]%'" -o gus --result-format json

Return {records: <result.records as-is>}. No filtering, no transformation.`

const checkPrStatePrompt = wi =>
  `Check PR state for ${wi.prUrl}.

Run:
- gh pr view ${wi.prUrl} --json state,isDraft,number,mergeable,statusCheckRollup
- FIRST check the top-level .state field (PR lifecycle state, NOT to be confused with row .state):
  - "MERGED" → return state='merged' (no need to inspect statusCheckRollup)
  - "CLOSED" → return state='closed'
  - "OPEN" → continue to check evaluation below
- Capture .mergeable verbatim into the result's mergeable field (string: "MERGEABLE" / "CONFLICTING" / "UNKNOWN").
- Parse statusCheckRollup. Two row shapes exist:
  - CheckRun rows expose .conclusion (SUCCESS/FAILURE/NEUTRAL/SKIPPED/CANCELLED/TIMED_OUT) and .status (COMPLETED/IN_PROGRESS/QUEUED/PENDING)
  - StatusContext rows expose .state (SUCCESS/FAILURE/PENDING/EXPECTED/ERROR) only — no .conclusion
  Treat each row's effective outcome as: row.conclusion ?? row.state. A null on both = treat as PENDING.
- Determine overall state:
  - 'no-pr' if gh fails to find the PR
  - 'running' if ANY row is IN_PROGRESS / QUEUED / PENDING / EXPECTED (or has no resolved outcome)
  - 'green' if every row resolves to SUCCESS / NEUTRAL / SKIPPED
  - 'failed' otherwise (any FAILURE / CANCELLED / TIMED_OUT / ERROR, with NO running rows remaining)
- If state is 'failed', collect failed job names. Run 'gh run view --log-failed <runId>' for the most recent failed/cancelled run linked to the PR head SHA, capture last ~100 lines as failedLogsExcerpt. Also gather the maximum 'run_attempt' across the workflow runs for the PR head SHA (gh api repos/forcedotcom/salesforcedx-vscode/actions/runs?head_sha=<sha> → max .run_attempt). Return that as maxRunAttempt.

Return ONLY the structured result.`

const closeMergedPrompt = (r, identity) => {
  const { wt, branch } = pathsFor(identity, r.wi)
  return `WI ${r.wi.name} has its PR (${r.wi.prUrl}) ${r.prState.state} on GitHub. Close out.

Steps (idempotent):
1. If WI Status__c is not already a closed terminal value, update:
   sf data update record -s ADM_Work__c -i ${r.wi.wiId} -o gus -v "Status__c='Closed'"
2. Remove worktree if present: 'git worktree remove ${wt} --force'.
3. Delete local branch if present: from ${identity.projectRoot}, 'git branch -D ${branch}' (ignore failure if branch doesn't exist).

Return {ok: true, detail} summarizing changes.`
}

const triageCiPrompt = (r, identity) => {
  const { wt } = pathsFor(identity, r.wi)
  return `Triage CI failure on PR ${r.wi.prUrl} for WI ${r.wi.name}.

Failed jobs: ${(r.prState.failedJobs || []).join(', ')}
Log excerpt:
${r.prState.failedLogsExcerpt || '(none)'}

Worktree path: ${wt}

Tasks:
1. Reattach to the worktree (recreate via 'git worktree add <path> <branch>' if missing; run 'npm install' if package-lock.json differs).
2. Inspect the failure vs. the diff ('git diff origin/develop...HEAD').
3. Classify:
   - 'flake-or-infra' if the failure is unrelated to the diff (network, infra, transient)
   - 'e2e-test-issue' if the failure is in e2e test code itself (selector drift, race, etc.) and the fix is contained to e2e files
   - 'code-bug' if the failure indicates a real bug in the source under change (cross-OS path bug, runtime mismatch, logic bug, etc.)
   - 'unknown' if you cannot decide

Return ONLY the structured result.`
}

const dmCiFailurePrompt = (r, identity) =>
  `DM the runner about a CI failure that needs human attention.

Slack ID: ${identity.slackId}
Use mcp__slack__slack_send_message to send a DM with content:
"⚠️ ${r.wi.name} CI failed after rerun budget exhausted (route=${r.triage.route}): ${r.triage.summary}\nPR: ${r.wi.prUrl}"

Return {ok: true} on success.`

const e2eFixPrompt = (r, identity) => {
  const { wt } = pathsFor(identity, r.wi)
  return `Fix an e2e test failure in worktree ${wt} for WI ${r.wi.name}.

Use the analyze-e2e command and the playwright-e2e skill. Inspect failing job logs (gh run view --log-failed) and the e2e test code in the worktree. Make the fix, commit with message "fix(e2e): <brief> - ${r.wi.name}", and push.

Failed jobs: ${(r.prState.failedJobs || []).join(', ')}
Log excerpt:
${r.prState.failedLogsExcerpt || '(none)'}

Return {status: 'done', commits: [<sha>], reason?} on success or {status: 'stuck', reason} otherwise.`
}

const codeFixPrompt = (r, identity) => {
  const { wt } = pathsFor(identity, r.wi)
  return `Fix a code bug exposed by CI in worktree ${wt} for WI ${r.wi.name}.

Read the original plan at .claude/plans/${r.wi.name}.md. The failure indicates the code under change is wrong (cross-OS, cross-runtime, or logic bug).

Failed jobs: ${(r.prState.failedJobs || []).join(', ')}
Log excerpt:
${r.prState.failedLogsExcerpt || '(none)'}

Apply the appropriate skills (read frontmatter from .claude/skills/*/SKILL.md to pick relevant ones; always apply: typescript, paths). Repo hooks run on tool calls and will surface compile/lint/dead-code/LSP issues — use that signal to drive correctness; don't run your own retry loop. Commit each logical fix as a separate commit. Push when done.

Return {status: 'done', commits} or {status: 'stuck', reason}.`
}

const refreshBranchPrompt = (r, identity) => {
  const { wt, branch } = pathsFor(identity, r.wi)
  return `Keep WI ${r.wi.name}'s branch current with origin/develop.

Worktree: ${wt}
Branch: ${branch}
PR: ${r.wi.prUrl}

Steps (idempotent; skip work if already current):
1. Reattach worktree if missing: 'git worktree add <path> <branch>'.
2. cd worktree && git fetch origin develop
3. If 'git rev-list --count HEAD..origin/develop' is 0, return {ok: true, detail: "already current"}.
4. git merge origin/develop --no-edit
5. Conflicts → apply .claude/skills/merge-conflicts/SKILL.md best-effort. Unresolvable → 'git merge --abort' and DM ${identity.slackId} via mcp__slack__slack_send_message: "⚠️ ${r.wi.name} merge conflict with develop — manual intervention needed\\nWorktree: <path>\\nPR: ${r.wi.prUrl}". Return {ok: false, detail: "merge-conflict-unresolved"}.
6. If package-lock.json changed, run 'npm install'.
7. git push

Return {ok: true, detail: "<n> commits merged"} or {ok: false, detail}.`
}

const openReviewPrompt = (r, identity) => {
  const { wt } = pathsFor(identity, r.wi)
  return `Open WI ${r.wi.name} for review (CI is green; transition In Progress → Ready for Review).

PR: ${r.wi.prUrl}
Worktree: ${wt}
Runner userId: ${identity.userId}
Runner GitHub login: ${identity.githubLogin}
Runner Slack ID: ${identity.slackId}

Monitor only enters this phase when WI is 'In Progress' — no need to re-check status.

Steps (idempotent):
1. If PR is still draft: 'gh pr ready ${r.wi.prUrl}'.
2. Advance WI status:
   sf data update record -s ADM_Work__c -i ${r.wi.wiId} -o gus -v "Status__c='Ready for Review' QA_Engineer__c='${identity.userId}'"
3. Reviewer reassignment per pr-draft skill (read .claude/skills/pr-draft/SKILL.md):
   - gh pr view ${r.wi.prUrl} --json reviewRequests --jq '.reviewRequests[].login'
   - For each existing reviewer that isn't ${identity.githubLogin}: 'gh pr edit ${r.wi.prUrl} --remove-reviewer <login>'
   - 'gh pr edit ${r.wi.prUrl} --add-reviewer ${identity.githubLogin}' (if not already)
4. Slack post in #ide-exp-code-review (channel ${REVIEW_CHANNEL_ID}) tagging the runner:
   "<@${identity.slackId}> PR ready for review: <${r.wi.prUrl}|PR> (${r.wi.name})"
   Use mcp__slack__slack_send_message.
5. Remove the worktree: 'git worktree remove ${wt} --force' (if present).

Return {ok: true, detail} where detail summarizes what changed.`
}

const peerApproveQueryPrompt = identity =>
  `Run this SOQL and return the raw records array.

sf data query --query "SELECT Id, Name, Subject__c, Details__c, Assignee__c FROM ADM_Work__c WHERE Status__c = 'Ready for Review' AND Assignee__c != '${identity.userId}' AND Subject__c LIKE '%[ai-auto]%'" -o gus --result-format json

Return {records: <result.records as-is>}. No filtering, no transformation.`

const peerApprovePrompt = (c, identity) =>
  `Evaluate WI ${c.name} (PR ${c.prUrl}) for peer-approve. Owner userId: ${c.ownerUserId}. Runner: ${identity.username} (userId ${identity.userId}, GitHub ${identity.githubLogin}, Slack ${identity.slackId}).

Magic string: a PR comment matching line-anchored regex /^\\/ai-auto approve\\b/m authored by the PR owner, posted at-or-after the current head SHA's commit timestamp.

Steps (idempotent — every step skips if already done):

1. Resolve owner GitHub login from gus-cli team table (read .claude/skills/gus-cli/SKILL.md if needed):
   sf data query --query "SELECT Github_Username__c FROM ADM_Scrum_Team_Member__c WHERE Id = '${c.ownerUserId}'" -o gus --result-format json
   If the team row is missing or has no Github_Username__c, ABORT with {ok: false, detail: "owner not in team table"}.

2. Resolve PR head SHA + commit timestamp + author:
   gh pr view ${c.prUrl} --json headRefOid,author,isDraft,state,commits
   - If isDraft=true, state!='OPEN', or PR is closed/merged → skip: {ok: true, detail: "pr-not-eligible"}.
   - If author.login != owner GitHub login (mismatch between WI Assignee and PR author) → skip: {ok: true, detail: "owner/author mismatch"}.
   - Get head SHA's authoredDate from commits[].oid==headRefOid → committedDate (or use 'gh api repos/forcedotcom/salesforcedx-vscode/commits/<sha>' → .commit.committer.date).

3. Fetch issue comments:
   gh api repos/forcedotcom/salesforcedx-vscode/issues/<prNumber>/comments --paginate
   Filter to comments where:
   - user.login == owner GitHub login
   - body matches /^\\/ai-auto approve\\b/m (line-anchored, multiline)
   - created_at >= head SHA committed date
   If none → skip: {ok: true, detail: "no-magic-string"}.

4. Idempotency: check existing reviews:
   gh api repos/forcedotcom/salesforcedx-vscode/pulls/<prNumber>/reviews --paginate
   If runner (${identity.githubLogin}) already has an APPROVED review with commit_id == head SHA → skip: {ok: true, detail: "already-approved"}.

5. Submit approval:
   gh pr review ${c.prUrl} --approve --body "Peer-approved on behalf of @<ownerLogin> per /ai-auto approve"

6. Update WI Status__c to 'Fixed' — only if current is 'Ready for Review' (forward-only):
   sf data query --query "SELECT Status__c FROM ADM_Work__c WHERE Id = '${c.wiId}'" -o gus --result-format json
   If Status__c == 'Ready for Review':
     sf data update record -s ADM_Work__c -i ${c.wiId} -o gus -v "Status__c='Fixed'"

The owner gets GitHub's native approval notification — no Slack DM (it would look like a DM from the runner machine).

Return {ok: true, detail: "<approved | skip reason>"} or {ok: false, detail}.`

const candidatesQueryPrompt = identity =>
  `Run EXACTLY ONE SOQL query — the one below — and return its records.

sf data query --query "SELECT Id, Name, Subject__c, Details__c, Status__c, Assignee__c, Story_Points__c, CreatedDate FROM ADM_Work__c WHERE Assignee__c = '${identity.userId}' AND Status__c IN ('New','Ready','Triaged') AND Subject__c LIKE '%[ai-auto]%' ORDER BY CreatedDate ASC LIMIT 50" -o gus --result-format json

Return {records: <result.records, verbatim>}.

HARD RULES:
- Do NOT run any other queries. If this query returns zero records, return {records: []}. An empty result is a valid, expected outcome — not a problem to investigate.
- Do NOT modify the WHERE clause, drop filters, or broaden the search.
- Do NOT add, remove, or transform fields in the records.`

const blockerStatusQueryPrompt = wiNames =>
  `Run EXACTLY ONE SOQL query — the one below — and return its records.

sf data query --query "SELECT Name, Status__c FROM ADM_Work__c WHERE Name IN (${wiNames
    .map(n => `'${n}'`)
    .join(',')})" -o gus --result-format json

Return {records: <result.records, verbatim>}.

HARD RULES:
- Do NOT run any other queries. Zero records is valid — return {records: []}.
- Do NOT modify the WHERE clause or transform fields.`

const prFilesPrompt = url =>
  `Run 'gh pr diff ${url} --name-only' and return {files: [<one path per line>]}.`

const pickWiPrompt = (candidateList, inFlightFileList) =>
  `Pick the next WI to work on from these candidates.

Candidates (JSON):
${JSON.stringify(candidateList, null, 2)}

Files already touched by in-flight PRs (avoid overlap when possible):
${inFlightFileList.join(', ') || 'none'}

Candidates with unmet hard dependencies were already filtered out upstream — every WI here is unblocked.

Selection rules (in order):
1. If a candidate's likely files (inferred from Subject/Details) overlap heavily with in-flight files, defer it.
2. Prefer smaller Story_Points (null treated as 5).
3. Tie-break by oldest CreatedDate.

Return ONLY {wiId, reason}.`

const claimOrRestartPrompt = (chosen, identity, isRestart) => {
  const { wt, branch } = pathsFor(identity, chosen)
  if (isRestart) {
    return `Reattach the worktree for in-flight WI ${chosen.name} that has no PR yet (build crashed in a prior tick). WI is already 'In Progress' — do not change its Status.

Worktree: ${wt}
Branch: ${branch}

Steps (idempotent):
1. From ${identity.projectRoot}: 'git fetch origin develop'.
2. Ensure a worktree is checked out at ${wt} for ${branch}:
   - If ${wt} already exists, leave it alone (skip to step 3).
   - Else if branch exists locally ('git rev-parse --verify ${branch}'): 'git worktree add ${wt} ${branch}'.
   - Else if branch exists on origin ('git ls-remote --exit-code --heads origin ${branch}'): 'git worktree add ${wt} -b ${branch} origin/${branch}'.
   - Else (no branch anywhere): 'git worktree add -b ${branch} ${wt} origin/develop --no-track'.
3. cd ${wt} && npm install.

Return {ok: false, detail} on failure, else {ok: true, detail: "reattached"}.`
  }
  return `Claim WI ${chosen.name} (${chosen.wiId}) and set up the worktree.

Step 0 — concurrent-claim guard (run FIRST, before any writes):
  git ls-remote --exit-code --heads origin ${branch}
  If the branch EXISTS on origin:
    gh pr list --head ${branch} --state open --json number,url --limit 1 --repo forcedotcom/salesforcedx-vscode
    If an open PR is found → return {ok: false, detail: "concurrent-claim-detected: branch ${branch} already has open PR <url>"}.
    If no open PR → the branch exists but has no open PR (prior build crashed); continue with steps below treating it as a fresh start (do NOT create the branch again in step 2 — use 'git worktree add ${wt} -b ${branch} origin/${branch}' instead).

Steps:
1. Update WI:
   sf data update record -s ADM_Work__c -i ${chosen.wiId} -o gus -v "Status__c='In Progress'"
2. From ${identity.projectRoot}, run:
   git fetch origin develop
   If branch does NOT exist on origin: git worktree add -b ${branch} ${wt} origin/develop --no-track
   Else (branch exists on origin, no open PR): git worktree add ${wt} -b ${branch} origin/${branch}
3. cd ${wt} && npm install (deps may differ from origin/develop's lockfile and hooks need them).

If any step fails, return {ok: false, detail: "<reason>"}. On success {ok: true, detail: "claimed"}.`
}

const listSkillsPrompt = identity =>
  `Run 'ls -1 ${SKILLS_DIR}' from ${identity.projectRoot} and return {skills: [<one entry per line, no blanks>]}.`

const planPrompt = (chosen, identity, skillList) => {
  const { wt } = pathsFor(identity, chosen)
  return `Plan implementation for WI ${chosen.name} in worktree ${wt}.

WI Subject: ${chosen.subject}
WI Details:
${chosen.details || '(empty)'}

Available skills (read each .claude/skills/<name>/SKILL.md frontmatter as needed to choose relevant ones):
${skillList.join(', ')}

BEFORE doing anything else, Read ${wt}/.claude/skills/concise/SKILL.md and apply that style to every word you write in the plan file: fragments/bullets, not full sentences; remove words without altering meaning; cut repetition; shorter synonyms.

Restart-aware: this may be a re-run after a prior crash. First check whether ${wt}/.claude/plans/${chosen.name}.md already exists AND is tracked in git ('git ls-files --error-unmatch .claude/plans/${chosen.name}.md' from ${wt}). If it exists and is tracked, treat the plan as already authored — read it, return {verdict: 'plan', plan: {phases, skills, verification}} reflecting its contents, do NOT rewrite the file.

Otherwise:
1. Decide if the WI is implementable: can you name (a) what files/area to touch and (b) a definition of done? If either is genuinely unknowable, return {verdict: 'blocked', blocked: {questions: [...]}} with concrete questions.
2. Otherwise, write the plan to ${wt}/.claude/plans/${chosen.name}.md in the concise style you just read. Sections: Context, Phases (each phase = one commit; include commit message), Skills to apply, Verification (excluding things covered by e2e tests on the branch — note which are e2e-covered).
3. Return {verdict: 'plan', plan: {phases, skills, verification}}.

Do not commit yet.`
}

const bouncePlanPrompt = (chosen, planResult, identity) => {
  const { wt } = pathsFor(identity, chosen)
  return `Bounce WI ${chosen.name} to Waiting and DM the runner.

Steps:
1. Update WI:
   sf data update record -s ADM_Work__c -i ${chosen.wiId} -o gus -v "Status__c='Waiting'"
2. DM ${identity.slackId} via mcp__slack__slack_send_message:
   "🚧 ${chosen.name} bounced to Waiting (plan blocked): ${chosen.subject}\\nQuestions:\\n${(planResult.blocked && planResult.blocked.questions || []).map(q => `• ${q}`).join('\\n')}\\nRun /grill-me to refine."
3. Remove worktree: 'git worktree remove ${wt} --force'.
Return {ok: true}.`
}

const planReviewPrompt = (chosen, identity) => {
  const { wt } = pathsFor(identity, chosen)
  return `Review the plan at ${wt}/.claude/plans/${chosen.name}.md.

BEFORE judging, Read ${wt}/.claude/skills/concise/SKILL.md so 'concise style' is concrete to you.

Enforce:
- concise skill style (the rules you just read)
- Each phase has a clear commit message
- Verification section exists and notes which items are e2e-covered
- Skills list is non-empty and includes typescript

Return {approved: true} or {approved: false, revisions: [...]}.`
}

const planRevisePrompt = (chosen, identity, revisions) => {
  const { wt } = pathsFor(identity, chosen)
  return `Revise the plan at ${wt}/.claude/plans/${chosen.name}.md addressing:
${(revisions || []).map(r => `- ${r}`).join('\n')}

Return {verdict: 'plan'} when done.`
}

const effectPlanReviewPrompt = (chosen, identity) => {
  const { wt } = pathsFor(identity, chosen)
  return `Review the plan at ${wt}/.claude/plans/${chosen.name}.md (mode: plan review). Identify Effect-TS smells the plan would introduce — hand-rolled retry/timeout/cache, untyped errors, ad-hoc PubSub, services that already exist in salesforcedx-vscode-services, etc.

Return ONLY the structured result.`
}

const e2ePlanReviewPrompt = (chosen, identity) => {
  const { wt } = pathsFor(identity, chosen)
  return `Review the plan at ${wt}/.claude/plans/${chosen.name}.md for e2e test coverage adequacy.

WI Subject: ${chosen.subject}
WI Details:
${chosen.details || '(empty)'}

Return ONLY the structured result.`
}

const adversaryPlanReviewPrompt = (chosen, identity) => {
  const { wt } = pathsFor(identity, chosen)
  return `Adversarially review the plan at ${wt}/.claude/plans/${chosen.name}.md.

WI Subject: ${chosen.subject}
WI Details:
${chosen.details || '(empty)'}

Return ONLY the structured result.`
}

const planAdvocateRevisePrompt = (chosen, identity, advocateRevisions) => {
  const { wt } = pathsFor(identity, chosen)
  return `Revise the plan at ${wt}/.claude/plans/${chosen.name}.md to address these advocate findings before implementation. The plan must reflect the right approach (Effect idioms, e2e coverage, adversarial concerns), not work around them.

Findings:
${advocateRevisions.map(r => `- ${r}`).join('\n')}

Return {verdict: 'plan'} when done.`
}

const commitPlanPrompt = (chosen, identity) => {
  const { wt } = pathsFor(identity, chosen)
  return `Commit the plan file in ${wt} — only if there is something to commit.

Steps:
1. cd ${wt}
2. git add .claude/plans/${chosen.name}.md
3. If 'git diff --cached --quiet' returns 0 (nothing staged), skip the commit and return {ok: true, detail: "no-op (plan unchanged)"}.
4. Else commit with subject "chore: plan for ${chosen.name}". Use a HEREDOC so the Co-Authored-By trailer with YOUR actual model name is preserved (the same trailer you append on any normal commit). Return {ok: true, detail: "committed"}.`
}

const buildPrompt = (chosen, identity) => {
  const { wt } = pathsFor(identity, chosen)
  return `Build WI ${chosen.name} per the plan at ${wt}/.claude/plans/${chosen.name}.md.

Operate inside ${wt}. Execute each plan phase end-to-end and commit per the plan's commit-message boundaries (one commit per phase). Apply the skills listed in the plan.

Repo hooks run on tool calls and will surface compile / lint / dead-code / LSP / effect issues — use that feedback to drive correctness. Do NOT run your own retry counter. If you genuinely cannot make progress, return {status: 'stuck', reason}.

If 'package-lock.json' changes during build, re-run 'npm install'.

Return {status: 'done', commits: [<shas>]} on success.`
}

const bounceBuildPrompt = (chosen, buildResult, identity) => {
  const { wt, branch } = pathsFor(identity, chosen)
  return `Bounce WI ${chosen.name} to Waiting (build stuck) and DM the runner. Worktree stays for human takeover.

Steps:
1. Update WI: sf data update record -s ADM_Work__c -i ${chosen.wiId} -o gus -v "Status__c='Waiting'"
2. DM ${identity.slackId} via mcp__slack__slack_send_message:
   "⚠️ ${chosen.name} build stuck: ${(buildResult.reason || '').replace(/"/g, "'")}\\nWorktree: ${wt}\\nBranch: ${branch}"
Return {ok: true}.`
}

const diffPrompt = wt =>
  `From ${wt}, run both:
- git diff --shortstat origin/develop...HEAD
- git diff --name-only origin/develop...HEAD

Return {shortstat: "<raw stdout of --shortstat, may be empty>", files: [<one path per line of --name-only>]}.`

const skillDetectPrompt = (skill, wt) =>
  `Decide if skill '${skill}' applies to the current branch's diff in ${wt}.

Read .claude/skills/${skill}/SKILL.md.
Examine: git diff origin/develop...HEAD (run from ${wt}).

Answer:
- applies: true if the diff intersects this skill's domain
- findings: concrete code-level changes that would improve the code per this skill, severity-graded. If applies but no actionable findings, return findings: [].

Return ONLY the structured result.`

const thermoPrompt = wt =>
  `Run a thermonuclear code-quality review on the diff in ${wt}.

Read and apply .claude/skills/thermonuclear-code-quality-review/SKILL.md. Examine 'git diff origin/develop...HEAD'. Return severity-graded findings only — file:line evidence required.`

const effectDiffReviewPrompt = wt =>
  `Review the diff in ${wt} (mode: diff review). Examine 'git diff origin/develop...HEAD'.`

const verifyFindingPrompt = (wt, finding) =>
  `Adversarially verify ONE code-review finding against the diff in ${wt}. Default to skepticism: a finding survives only if its premise is demonstrably true AND acting on it adds value beyond what CI/automation already provides.

Finding (source: ${finding.source}):
${JSON.stringify({ severity: finding.severity, file: finding.file, line: finding.line, claim: finding.claim }, null, 2)}

Establish the premise with EVIDENCE, not assumption. Read the cited file:line and 'git diff origin/develop...HEAD' in ${wt}.

Verdict rules:
- **dropped** if ANY of:
  - The premise is false (cited code doesn't do what the finding claims).
  - It only asks to RUN tests/checks that CI already runs on the PR. CI runs Playwright e2e (with retries) and the stop-hook chain (compile/lint/knip/effect-LS/unit) as gating checks — re-running them by hand before merge is redundant. Inspect '.github/workflows/' in ${wt} to confirm what CI covers; a "run X before merge" finding where X is a gating CI job → dropped.
  - It claims a BREAKING API change / removed export / dead code. PROVE affected consumers exist before keeping it. Read .claude/skills/external-consumers/SKILL.md and run its gh searches across org:forcedotcom and org:salesforcecli for the exact removed symbol AND its public-export form (e.g. workspaceContextUtils.<name>). Discount false positives (unrelated same-named symbols, the ci-testing mirror repo, the export site itself, plan/doc files). Zero real consumers → dropped (note "removed unused export, no consumers" for the PR body instead).
- **downgraded** if the premise holds but the real severity is lower than claimed (e.g. theoretical edge, no user-facing impact).
- **confirmed** only if premise verified and the fix adds genuine value.

Return ONLY the structured result. 'severity' = the corrected severity (== claimed if confirmed). 'evidence' = file:line or gh-search summary that grounds the verdict.`

const fixerPrompt = (wt, verifiedFindings) =>
  `Apply review findings to the code in ${wt}.

Each finding was already adversarially verified — premise confirmed, severity corrected, false/redundant/no-consumer findings already removed. 'verifiedSeverity' is authoritative; 'rationale'/'evidence' explain why it survived.

Verified findings (JSON):
${JSON.stringify(verifiedFindings, null, 2)}

Rules:
- Auto-apply ALL critical and high severity findings.
- Auto-apply medium / low when the fix is cheap and clearly correct.
- Surface the rest in 'remaining' with note + severity for the PR body.
- A finding may carry a 'prBodyNote' (e.g. "removed unused export, no consumers") instead of a code change — pass those straight into 'remaining' so they land in the PR body, no edit needed.

Group commits logically: e.g. one commit "fix: critical/high review findings", one "refactor: medium/low review findings". If nothing to fix, return {fixedCount: 0, remaining: [...]}.

Return ONLY the structured result.`

const mergeDevelopPrompt = wt =>
  `Merge origin/develop into the branch in ${wt}.

Steps:
1. cd ${wt}
2. git fetch origin develop
3. git merge origin/develop --no-edit
4. If conflicts, apply .claude/skills/merge-conflicts/SKILL.md best-effort. If unresolvable: 'git merge --abort' and return {ok: false, detail: "merge-conflict-unresolved"}.
5. If package-lock.json changed in the merge, run 'npm install'.
6. If the merge ran cleanly with no conflicts, no commit needed beyond the merge commit git already made.
Return {ok: true} on success.`

const draftPrPrompt = (chosen, identity, fixerResult) => {
  const { wt, branch } = pathsFor(identity, chosen)
  return `Push the branch and open a draft PR for WI ${chosen.name}.

Worktree: ${wt}
Branch: ${branch}
WI Subject: ${chosen.subject}
Plan path (in repo): .claude/plans/${chosen.name}.md
Remaining review notes (medium/low not auto-fixed):
${JSON.stringify(fixerResult.remaining || [], null, 2)}

Steps:
1. cd ${wt}
2. git push -u origin ${branch}
3. Read .claude/skills/pr-draft/SKILL.md for title/body conventions. Title format: 'type(scope): description - ${chosen.name}'.
4. Compose body. Sections (markdown):
   - ## Summary — 1–3 bullets distilled from the plan
   - ## Plan — link to .claude/plans/${chosen.name}.md
   - ## Reviewer notes — list the remaining findings (skip if empty)
   - ## Test plan — items from the plan's verification section, EXCLUDING items covered by new/modified e2e tests on the branch (inspect 'git diff --name-only origin/develop...HEAD' for files matching '**/e2e/**' or '*.e2e.*' or 'packages/*-e2e/**' to determine coverage)
   - GUS reference per pr-draft skill
   - Footer: '🤖 Generated by auto-build pipeline. Original WI: <gus link>'
5. Before creating the PR, check for an existing open PR on this branch:
   gh pr list --head ${branch} --state open --json number,url --limit 1 --repo forcedotcom/salesforcedx-vscode
   If one exists → skip gh pr create. Use that existing PR's url/number as the result. Skip to step 7.
6. Create draft PR: gh pr create --draft --title "<title>" --body "<body>" --base develop
   Take the PR URL from gh's output.
7. Append a PR link to the WI Details__c. CRITICAL: do NOT replace Details__c — read it first, then APPEND.
   a. Fetch existing: \`sf data query --query "SELECT Details__c FROM ADM_Work__c WHERE Id = '${chosen.wiId}'" -o gus --result-format json\`. Parse \`result.records[0].Details__c\` (may be null/empty).
   b. If existing already contains this exact PR URL, skip the update (idempotent — return success).
   c. Compose new value: take the existing Details__c (or empty string if null), then concatenate this exact HTML snippet, with PR_URL replaced by the actual URL string from gh (e.g. https://github.com/forcedotcom/salesforcedx-vscode/pull/7382) and PR_NUMBER replaced by the integer:
        <p><strong>PR:</strong> <a href="PR_URL">#PR_NUMBER</a></p>
      VERIFY before writing: the substring 'href="https://github.com/forcedotcom/salesforcedx-vscode/pull/' must appear in your new value. If 'href=""' appears anywhere in the appended snippet, you have failed substitution — abort and return {prUrl, prNumber} only after fixing it. Do NOT preserve angle-bracket placeholders like <prUrl> or <prNumber> in the output.
   d. Write via --flags-dir to handle quotes safely:
      - mkdir -p /tmp/gus-flags-${chosen.name}
      - Write a SINGLE-LINE file at /tmp/gus-flags-${chosen.name}/values. Format: Details__c="<NEW_VALUE>" using double-quotes around the value. Inside the value, all HTML attribute quotes must remain as plain double-quotes (the file uses single-quote-shell-escaping at the sf CLI layer; per gus-cli skill, single-line values with double-quote outer + literal double-quote inner work). If the existing Details__c contains a literal " character that would break the value file, fall back to appending using the plain-text form: Details__c='<existing-stripped>\\nPR: <prUrl>' but log a warning that the original HTML was lossy.
      - sf data update record -s ADM_Work__c -i ${chosen.wiId} -o gus --flags-dir /tmp/gus-flags-${chosen.name}
   e. Verify: re-query Details__c and confirm BOTH (i) the new PR URL is present AND (ii) at least one original Goal/Done-when/Why marker from the prior content is still present. If either check fails, do NOT claim success — log the failure detail and return so the workflow retries next tick.

Return {prUrl, prNumber}.`
}

// =====================================================================
// PHASE FUNCTIONS
// =====================================================================

const resolveIdentity = async () => {
  phase('Resolve identity')
  return await agent(identityPrompt, {
    schema: IDENTITY_SCHEMA,
    label: 'resolve-identity',
    model: 'haiku',
  })
}

const ensureDaemons = async () => {
  phase('Ensure daemons')
  await agent(ensureGhaRerunPrompt, {
    schema: OK_SCHEMA,
    label: 'ensure-gha-rerun-daemon',
    phase: 'Ensure daemons',
    model: 'haiku',
  })
}

const reapStrandedWorktrees = async identity => {
  phase('Reap stranded worktrees')
  await agent(reapWorktreesPrompt(identity), {
    schema: OK_SCHEMA,
    label: 'reap-stranded-worktrees',
    phase: 'Reap stranded worktrees',
    model: 'haiku',
  })
}

const monitorInFlight = async identity => {
  phase('Monitor in-flight')

  const inFlightRaw = await agent(inFlightQueryPrompt(identity), {
    schema: WI_RECORDS_SCHEMA,
    label: 'query-in-flight',
    phase: 'Monitor in-flight',
    model: 'haiku',
  })

  // Include all in-flight WIs — with and without a PR URL. No-PR 'In Progress' WIs are active
  // builds that crashed before opening a PR; they need to count toward the cap and be restarted.
  const inFlightWis = (inFlightRaw.records || []).map(mapWiRecord)
  log(`in-flight: ${inFlightWis.length} WI(s) — ${inFlightWis.map(w => `${w.name}(${w.status})`).join(', ')}`)

  const monitorOutcomes = await pipeline(
    inFlightWis,
    async wi => {
      if (!wi.prUrl) {
        // WI is 'In Progress' but no PR opened yet — build crashed in a prior tick. Restart.
        return { wi, action: 'no-pr-restart' }
      }
      const prState = await agent(checkPrStatePrompt(wi), {
        schema: PR_STATE_SCHEMA,
        label: `check-pr-${wi.name}`,
        phase: 'Monitor in-flight',
        model: 'sonnet',
      })
      return { wi, prState, action: 'evaluate' }
    },
    async result => {
      if (!result || result.action === 'no-pr-restart') return result
      const { prState } = result
      if (prState.state === 'merged' || prState.state === 'closed') {
        return { ...result, decision: 'close-wi' }
      }
      // Only finalize a green PR whose WI is still 'In Progress'. WIs already advanced to
      // 'Ready for Review'/'Fixed' in a prior tick are done — re-finalizing them re-posts the
      // Slack "PR ready for review" message every tick (openReviewPrompt step 4 is not idempotent).
      if (prState.state === 'green') {
        return { ...result, decision: result.wi.status === 'In Progress' ? 'finalize' : 'wait' }
      }
      if (prState.state === 'running') return { ...result, decision: 'wait' }
      if (prState.state === 'no-pr') return { ...result, decision: 'no-pr-restart' }
      // state === 'failed': all checks settled, at least one not green.
      // The gha-rerun daemon owns the rerun budget (max 3 attempts per its skill).
      // If maxRunAttempt < 3, the daemon will rerun soon → wait.
      // If maxRunAttempt >= 3, reruns are exhausted → triage and iterate on the diff.
      const attempt = typeof prState.maxRunAttempt === 'number' ? prState.maxRunAttempt : 0
      return { ...result, decision: attempt >= 3 ? 'triage' : 'wait' }
    }
  )

  return { inFlightWis, monitorOutcomes }
}

const closeMergedWis = async (toCloseWi, identity) => {
  phase('Close merged WIs')
  await parallel(
    toCloseWi.map(r => () =>
      agent(closeMergedPrompt(r, identity), {
        schema: OK_SCHEMA,
        label: `close-${r.wi.name}`,
        phase: 'Close merged WIs',
        model: 'haiku',
      })
    )
  )
}

const triageAndFixCi = async (toTriage, identity) => {
  phase('Triage failures')
  const triaged = await parallel(
    toTriage.map(r => () =>
      agent(triageCiPrompt(r, identity), {
        schema: TRIAGE_SCHEMA,
        label: `triage-${r.wi.name}`,
        phase: 'Triage failures',
        model: 'opus',
      }).then(triage => ({ ...r, triage }))
    )
  )

  phase('Fix CI failures')
  await parallel(
    triaged.filter(Boolean).map(r => async () => {
      if (r.triage.route === 'flake-or-infra' || r.triage.route === 'unknown') {
        await agent(dmCiFailurePrompt(r, identity), {
          schema: OK_SCHEMA,
          label: `dm-${r.wi.name}`,
          phase: 'Fix CI failures',
          model: 'haiku',
        })
        return
      }
      if (r.triage.route === 'e2e-test-issue') {
        await agent(e2eFixPrompt(r, identity), {
          schema: BUILD_SCHEMA,
          label: `e2e-fix-${r.wi.name}`,
          phase: 'Fix CI failures',
          model: 'opus',
        })
        return
      }
      // code-bug → run builder with failure context
      await agent(codeFixPrompt(r, identity), {
        schema: BUILD_SCHEMA,
        label: `code-fix-${r.wi.name}`,
        phase: 'Fix CI failures',
        model: 'opus',
      })
    })
  )
}

const keepInFlightCurrent = async (toRefresh, identity) => {
  phase('Keep in-flight current')
  // Sequential, not parallel: merges may trigger compile/lint/test across many
  // worktrees concurrently and crash the machine.
  for (const r of toRefresh) {
    await agent(refreshBranchPrompt(r, identity), {
      schema: OK_SCHEMA,
      label: `refresh-${r.wi.name}`,
      phase: 'Keep in-flight current',
      model: 'opus',
    })
  }
}

const openForReview = async (toFinalize, identity) => {
  phase('Open for review')
  await parallel(
    toFinalize.map(r => () =>
      agent(openReviewPrompt(r, identity), {
        schema: OK_SCHEMA,
        label: `open-review-${r.wi.name}`,
        phase: 'Open for review',
        model: 'haiku',
      })
    )
  )
}

const peerApprove = async identity => {
  phase('Peer approve')

  const peerApproveRaw = await agent(peerApproveQueryPrompt(identity), {
    schema: WI_RECORDS_SCHEMA,
    label: 'peer-approve-query',
    phase: 'Peer approve',
    model: 'haiku',
  })

  const peerCandidates = (peerApproveRaw.records || [])
    .map(r => ({
      wiId: r.Id,
      name: r.Name,
      subject: r.Subject__c || '',
      prUrl: extractPrUrl(r.Details__c),
      ownerUserId: r.Assignee__c || '',
    }))
    .filter(c => c.prUrl && c.ownerUserId)
  log(`peer-approve candidates: ${peerCandidates.length}`)

  if (!peerCandidates.length) return

  await parallel(
    peerCandidates.map(c => () =>
      agent(peerApprovePrompt(c, identity), {
        schema: OK_SCHEMA,
        label: `peer-approve-${c.name}`,
        phase: 'Peer approve',
        model: 'sonnet',
      })
    )
  )
}

const pickCandidate = async (identity, inFlightWis) => {
  phase('Pick candidate')

  const candidatesRaw = await agent(candidatesQueryPrompt(identity), {
    schema: WI_RECORDS_SCHEMA,
    label: 'query-candidates',
    phase: 'Pick candidate',
    model: 'haiku',
  })

  const inFlightWiIds = new Set(inFlightWis.map(w => w.wiId))
  const validStatuses = new Set(['New', 'Ready', 'Triaged'])
  const rawRecords = candidatesRaw.records || []
  const offSpec = rawRecords.filter(
    r => r.Assignee__c !== identity.userId || !validStatuses.has(r.Status__c)
  )
  if (offSpec.length) {
    log(
      `query-candidates returned ${offSpec.length}/${rawRecords.length} record(s) outside the WHERE clause — agent went off-script. Dropping all results.`
    )
  }
  const filteredRecords = offSpec.length ? [] : rawRecords
  const preCandidates = filteredRecords.map(mapWiRecord).filter(c => {
    if (inFlightWiIds.has(c.wiId)) return false
    return true
  })
  // For WIs with a workflow-appended PR URL, verify the PR is still open (not closed
  // without merging). A closed PR means the WI needs a new attempt.
  const candidateList = (
    await Promise.all(
      preCandidates.map(async c => {
        const prUrl = extractPrUrl(c.details)
        if (!prUrl) return c
        const prNum = prUrl.split('/').pop()
        const stateRaw = await agent(
          `Run: gh pr view ${prNum} --json state,mergedAt --jq '{state: .state, mergedAt: .mergedAt}'\nReturn only the JSON object from stdout, nothing else.`,
          { schema: { type: 'object', properties: { state: { type: 'string' }, mergedAt: {} }, required: ['state'] }, label: `pr-state-${prNum}`, phase: 'Pick candidate', model: 'haiku' }
        )
        const prState = (stateRaw && stateRaw.state) || 'UNKNOWN'
        if (prState === 'OPEN') {
          log(`excluding ${c.name}: PR #${prNum} is open — already in progress`)
          return null
        }
        if (prState === 'MERGED' || stateRaw.mergedAt) {
          log(`excluding ${c.name}: PR #${prNum} already merged`)
          return null
        }
        // CLOSED without merge — PR was abandoned; re-queue the WI
        log(`re-queuing ${c.name}: PR #${prNum} was closed without merging`)
        return c
      })
    )
  ).filter(Boolean)

  if (!candidateList.length) return null

  // Deterministic blocked-WI gate: drop any candidate that declares a hard
  // dependency ("blocked by W-XXX", "depends on W-XXX", "after W-XXX merges")
  // on a WI that hasn't merged yet. Done in code, not left to the picker LLM,
  // and applied even when there's a single candidate (the picker is skipped
  // in that path). One batched status query covers every referenced blocker.
  const blockerMap = new Map(
    candidateList.map(c => [c.wiId, extractBlockers(c.subject, c.details)])
  )
  const allBlockerNames = [...new Set([...blockerMap.values()].flat())]
  if (allBlockerNames.length) {
    const blockerRaw = await agent(blockerStatusQueryPrompt(allBlockerNames), {
      schema: WI_STATUS_RECORDS_SCHEMA,
      label: 'query-blocker-status',
      phase: 'Pick candidate',
      model: 'haiku',
    })
    const statusByName = new Map(
      (blockerRaw.records || []).map(r => [r.Name, r.Status__c || ''])
    )
    const unblocked = candidateList.filter(c => {
      const blockers = blockerMap.get(c.wiId) || []
      // A blocker not present in query results doesn't exist (or is mistyped) —
      // treat an unresolvable reference as unsatisfied to stay safe.
      const unmet = blockers.filter(b => !isBlockerSatisfied(statusByName.get(b) || ''))
      if (unmet.length) {
        log(
          `excluding ${c.name}: blocked by unmerged ${unmet
            .map(b => `${b} (${statusByName.get(b) || 'not found'})`)
            .join(', ')}`
        )
        return false
      }
      return true
    })
    if (!unblocked.length) {
      log('all candidates blocked by unmerged dependencies — nothing to claim')
      return null
    }
    candidateList.length = 0
    candidateList.push(...unblocked)
  }

  if (candidateList.length === 1) {
    log(`single candidate: ${candidateList[0].name}`)
    return candidateList[0]
  }

  const inFlightUrls = inFlightWis.filter(w => w.prUrl).map(w => w.prUrl)
  const inFlightFiles = inFlightUrls.length
    ? await parallel(
        inFlightUrls.map(url => () =>
          agent(prFilesPrompt(url), {
            schema: FILES_SCHEMA,
            label: `pr-files-${url.split('/').pop()}`,
            phase: 'Pick candidate',
            model: 'haiku',
          })
        )
      )
    : []
  const inFlightFileList = [
    ...new Set((inFlightFiles || []).filter(Boolean).flatMap(d => d.files || [])),
  ]

  const pick = await agent(pickWiPrompt(candidateList, inFlightFileList), {
    schema: PICKER_SCHEMA,
    label: 'pick-wi',
    phase: 'Pick candidate',
    model: 'sonnet',
  })
  const chosen = candidateList.find(c => c.wiId === pick.wiId) || candidateList[0]
  log(`picked ${chosen.name}: ${pick.reason}`)
  return chosen
}

const claimOrRestart = async (chosen, identity, isRestart) => {
  phase('Claim + worktree')
  return await agent(claimOrRestartPrompt(chosen, identity, isRestart), {
    schema: OK_SCHEMA,
    label: `${isRestart ? 'restart' : 'claim'}-${chosen.name}`,
    phase: 'Claim + worktree',
    model: 'haiku',
  })
}

const runPlan = async (chosen, identity) => {
  phase('Plan')

  const skillNames = await agent(listSkillsPrompt(identity), {
    schema: SKILL_LIST_SCHEMA,
    label: 'list-skills',
    phase: 'Plan',
    model: 'haiku',
  })
  const skillList = (skillNames.skills || []).map(s => s.trim()).filter(Boolean)

  const planResult = await agent(planPrompt(chosen, identity, skillList), {
    schema: PLAN_SCHEMA,
    label: `plan-${chosen.name}`,
    phase: 'Plan',
    model: 'opus',
  })

  return { planResult, skillList }
}

const bounceBlockedPlan = async (chosen, planResult, identity) => {
  await agent(bouncePlanPrompt(chosen, planResult, identity), {
    schema: OK_SCHEMA,
    label: `bounce-${chosen.name}`,
    phase: 'Plan',
    model: 'haiku',
  })
}

const reviewAndCommitPlan = async (chosen, identity) => {
  const planReview = await agent(planReviewPrompt(chosen, identity), {
    schema: PLAN_REVIEW_SCHEMA,
    label: `plan-review-${chosen.name}`,
    phase: 'Plan',
    model: 'sonnet',
  })

  if (!planReview.approved) {
    await agent(planRevisePrompt(chosen, identity, planReview.revisions), {
      schema: PLAN_SCHEMA,
      label: `plan-revise-${chosen.name}`,
      phase: 'Plan',
      model: 'sonnet',
    })
  }

  const [effectPlanReview, e2ePlanReview, adversaryPlanReview] = await parallel([
    () =>
      agent(effectPlanReviewPrompt(chosen, identity), {
        schema: EFFECT_ADVOCATE_SCHEMA,
        label: `effect-plan-${chosen.name}`,
        phase: 'Plan',
        agentType: 'effect-advocate',
      }),
    () =>
      agent(e2ePlanReviewPrompt(chosen, identity), {
        schema: EFFECT_ADVOCATE_SCHEMA,
        label: `e2e-plan-${chosen.name}`,
        phase: 'Plan',
        agentType: 'e2e-advocate',
      }),
    () =>
      agent(adversaryPlanReviewPrompt(chosen, identity), {
        schema: PLAN_ADVERSARY_SCHEMA,
        label: `adversary-plan-${chosen.name}`,
        phase: 'Plan',
        agentType: 'plan-adversary',
      }),
  ])

  const effectMust = ((effectPlanReview && effectPlanReview.findings) || []).filter(
    f => f.severity === 'must'
  )
  const e2eMust = ((e2ePlanReview && e2ePlanReview.findings) || []).filter(
    f => f.severity === 'must'
  )
  const adversaryBlocking = ((adversaryPlanReview && adversaryPlanReview.findings) || []).filter(
    f => f.severity === 'critical' || f.severity === 'high'
  )

  const advocateRevisions = [
    ...effectMust.map(f => `[effect] ${f.suggestion}${f.citation ? ' [' + f.citation + ']' : ''}`),
    ...e2eMust.map(f => `[e2e] ${f.suggestion}${f.citation ? ' [' + f.citation + ']' : ''}`),
    ...adversaryBlocking.map(
      f =>
        `[adversary:${f.severity}] ${f.claim}${f.suggestion ? ' — ' + f.suggestion : ''}${f.evidence ? ' [' + f.evidence + ']' : ''}`
    ),
  ]

  if (advocateRevisions.length) {
    await agent(planAdvocateRevisePrompt(chosen, identity, advocateRevisions), {
      schema: PLAN_SCHEMA,
      label: `plan-advocate-revise-${chosen.name}`,
      phase: 'Plan',
      model: 'opus',
    })
  }

  await agent(commitPlanPrompt(chosen, identity), {
    schema: OK_SCHEMA,
    label: `commit-plan-${chosen.name}`,
    phase: 'Plan',
    model: 'haiku',
  })
}

const runBuild = async (chosen, identity) => {
  phase('Build')
  return await agent(buildPrompt(chosen, identity), {
    schema: BUILD_SCHEMA,
    label: `build-${chosen.name}`,
    phase: 'Build',
    model: 'opus',
  })
}

const bounceStuckBuild = async (chosen, buildResult, identity) => {
  await agent(bounceBuildPrompt(chosen, buildResult, identity), {
    schema: OK_SCHEMA,
    label: `bounce-build-${chosen.name}`,
    phase: 'Build',
    model: 'haiku',
  })
}

const runReview = async (chosen, identity, skillList) => {
  phase('Review')
  const { wt } = pathsFor(identity, chosen)

  const diffInfo = await agent(diffPrompt(wt), {
    schema: DIFF_RAW_SCHEMA,
    label: `diff-${chosen.name}`,
    phase: 'Review',
    model: 'haiku',
  })

  const lineCount = parseShortstatLines(diffInfo.shortstat || '')
  const skillsToCheck =
    lineCount < SMALL_DIFF_LINES
      ? skillList.filter(s => ALWAYS_APPLICABLE_SKILLS.includes(s))
      : skillList.filter(s => !REVIEW_SKILL_DENYLIST.includes(s))

  log(`diff: ${lineCount} lines; checking ${skillsToCheck.length} skills`)

  const skillFindings = await parallel(
    skillsToCheck.map(skill => () =>
      agent(skillDetectPrompt(skill, wt), {
        schema: SKILL_DETECT_SCHEMA,
        label: `skill-${skill}`,
        phase: 'Review',
        model: 'sonnet',
      })
    )
  )

  const thermo = await agent(thermoPrompt(wt), {
    schema: THERMO_SCHEMA,
    label: `thermo-${chosen.name}`,
    phase: 'Review',
    model: 'opus',
  })

  const effectDiffReview = await agent(effectDiffReviewPrompt(wt), {
    schema: EFFECT_ADVOCATE_SCHEMA,
    label: `effect-diff-${chosen.name}`,
    phase: 'Review',
    agentType: 'effect-advocate',
  })

  // Verify every finding before fixing: each gets an adversarial verifier that
  // proves the premise (reads cited code; gh-searches consumers for breaking/
  // dead-code claims; checks CI coverage for "run X before merge" claims) and
  // returns confirmed / downgraded / dropped. Kills false positives, redundant
  // CI re-runs, and zero-consumer "breaking changes" before they reach the fixer.
  phase('Verify findings')

  const rawFindings = normalizeFindings(skillFindings, skillsToCheck, thermo, effectDiffReview)
  log(`verifying ${rawFindings.length} raw finding(s)`)

  const verdicts = await parallel(
    rawFindings.map((finding, i) => () =>
      agent(verifyFindingPrompt(wt, finding), {
        schema: VERIFY_SCHEMA,
        label: `verify-${finding.source}-${i}`,
        phase: 'Verify findings',
        model: 'sonnet',
      }).then(v => (v ? { finding, ...v } : null))
    )
  )

  const verifiedFindings = verdicts
    .filter(Boolean)
    .filter(v => v.verdict !== 'dropped')
    .map(v => ({
      source: v.finding.source,
      file: v.finding.file,
      line: v.finding.line,
      claim: v.finding.claim,
      verifiedSeverity: v.severity,
      rationale: v.rationale,
      evidence: v.evidence ?? null,
    }))
    .sort((a, b) => SEVERITY_RANK[a.verifiedSeverity] - SEVERITY_RANK[b.verifiedSeverity])

  const droppedCount = verdicts.filter(Boolean).filter(v => v.verdict === 'dropped').length
  log(
    `verified: ${verifiedFindings.length} kept, ${droppedCount} dropped (${verdicts.filter(Boolean).filter(v => v.verdict === 'downgraded').length} downgraded)`
  )

  phase('Fix review findings')

  const fixerResult = await agent(fixerPrompt(wt, verifiedFindings), {
    schema: FIXER_SCHEMA,
    label: `fix-${chosen.name}`,
    phase: 'Fix review findings',
    model: 'opus',
  })

  await agent(mergeDevelopPrompt(wt), {
    schema: OK_SCHEMA,
    label: `merge-${chosen.name}`,
    phase: 'Fix review findings',
    model: 'opus',
  })

  return fixerResult
}

const draftPr = async (chosen, identity, fixerResult) => {
  phase('Draft PR')
  return await agent(draftPrPrompt(chosen, identity, fixerResult), {
    schema: PR_DRAFT_SCHEMA,
    label: `pr-${chosen.name}`,
    phase: 'Draft PR',
    model: 'sonnet',
  })
}

// =====================================================================
// ORCHESTRATION
// =====================================================================

const identity = await resolveIdentity()
if (identity.error || !identity.userId) {
  log(`identity resolution failed: ${identity.error || 'unknown'} — exiting`)
  return { exited: 'identity-failed', error: identity.error }
}
log(`runner: ${identity.username} (${identity.ownerPrefix}, ${identity.githubLogin})`)

await ensureDaemons()
await reapStrandedWorktrees(identity)

const { inFlightWis, monitorOutcomes } = await monitorInFlight(identity)
const { toFinalize, toTriage, toRestart, toCloseWi, toRefresh } = classifyMonitor(monitorOutcomes)

if (toCloseWi.length) await closeMergedWis(toCloseWi, identity)
if (toTriage.length) await triageAndFixCi(toTriage, identity)
if (toRefresh.length) await keepInFlightCurrent(toRefresh, identity)
if (toFinalize.length) await openForReview(toFinalize, identity)
await peerApprove(identity)

// Cap = number of WIs currently 'In Progress' in GUS. GUS status is authoritative.
// 'Ready for Review'/'Fixed' WIs are waiting on human review — not consuming builder slots.
// No subtraction needed: GUS already reflects transitions from prior ticks.
const stillInFlight = inFlightWis.filter(w => w.status === 'In Progress').length
log(`cap: stillInFlight=${stillInFlight} (In Progress WIs) toFinalize=${toFinalize.length} toCloseWi=${toCloseWi.length} toRestart=${toRestart.length}`)

let chosen
let isRestart = false

if (toRestart.length) {
  chosen = toRestart[0].wi
  isRestart = true
  log(`restarting stuck in-flight WI ${chosen.name} (no PR)`)
} else {
  if (stillInFlight >= MAX_IN_FLIGHT) {
    log(`at cap (${stillInFlight}/${MAX_IN_FLIGHT}); not claiming new WI`)
    return { exited: 'at-cap', inFlight: stillInFlight, finalized: toFinalize.length }
  }
  chosen = await pickCandidate(identity, inFlightWis)
  if (!chosen) {
    log('no candidates — nothing to do')
    return { exited: 'idle', inFlight: stillInFlight }
  }
}

const claimed = await claimOrRestart(chosen, identity, isRestart)
if (!claimed.ok) {
  log(`${isRestart ? 'restart' : 'claim'} failed: ${claimed.detail}`)
  return {
    exited: isRestart ? 'restart-failed' : 'claim-failed',
    error: claimed.detail,
  }
}

const { planResult, skillList } = await runPlan(chosen, identity)
if (planResult.verdict === 'blocked') {
  await bounceBlockedPlan(chosen, planResult, identity)
  return { exited: 'plan-blocked', wi: chosen.name }
}
await reviewAndCommitPlan(chosen, identity)

const buildResult = await runBuild(chosen, identity)
if (buildResult.status === 'stuck') {
  await bounceStuckBuild(chosen, buildResult, identity)
  return { exited: 'build-stuck', wi: chosen.name, reason: buildResult.reason }
}

const fixerResult = await runReview(chosen, identity, skillList)

const prResult = await draftPr(chosen, identity, fixerResult)

log(`opened draft PR ${prResult.prUrl} for ${chosen.name}`)
return {
  exited: 'claimed-and-pr-opened',
  wi: chosen.name,
  prUrl: prResult.prUrl,
  finalized: toFinalize.length,
}
