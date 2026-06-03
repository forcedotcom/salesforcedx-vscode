export const meta = {
  name: 'auto-build-wi',
  description: 'Drain GUS work items tagged [ai-auto] end-to-end: claim → plan → build → review → draft PR. Stateless across ticks; pair with /loop.',
  whenToUse: 'Run on a schedule via /loop (e.g. /loop 10m /auto-build-wi). Each tick monitors in-flight WIs and may claim a new one.',
  phases: [
    { title: 'Resolve identity' },
    { title: 'Ensure daemons' },
    { title: 'Monitor in-flight' },
    { title: 'Triage failures' },
    { title: 'Fix CI failures' },
    { title: 'Keep in-flight current' },
    { title: 'Finalize ready' },
    { title: 'Pick candidate' },
    { title: 'Claim + worktree' },
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Review' },
    { title: 'Fix review findings' },
    { title: 'Draft PR' },
  ],
}

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
const PROJECT_ROOT = '/Users/shane.mclaughlin/eng/forcedotcom/vscode-auto'

const IDENTITY_SCHEMA = {
  type: 'object',
  required: ['userId', 'username', 'ownerPrefix', 'slackId', 'githubLogin'],
  properties: {
    userId: { type: 'string' },
    username: { type: 'string' },
    ownerPrefix: { type: 'string' },
    slackId: { type: 'string' },
    githubLogin: { type: 'string' },
    error: { type: 'string' },
  },
}

const WI_LIST_SCHEMA = {
  type: 'object',
  required: ['wis'],
  properties: {
    wis: {
      type: 'array',
      items: {
        type: 'object',
        required: ['wiId', 'name', 'subject'],
        properties: {
          wiId: { type: 'string' },
          name: { type: 'string' },
          subject: { type: 'string' },
          details: { type: 'string' },
          storyPoints: { type: ['number', 'null'] },
          createdDate: { type: 'string' },
          prUrl: { type: ['string', 'null'] },
        },
      },
    },
  },
}

const PR_STATE_SCHEMA = {
  type: 'object',
  required: ['state'],
  properties: {
    state: { enum: ['green', 'failed', 'running', 'no-pr'] },
    prUrl: { type: ['string', 'null'] },
    prNumber: { type: ['number', 'null'] },
    isDraft: { type: ['boolean', 'null'] },
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

const slugify = s =>
  String(s)
    .toLowerCase()
    .replace(/\[ai-auto\]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')

const worktreePath = (ownerPrefix, wiName, subject) =>
  `${PROJECT_ROOT}/../vscode-auto-wt/${ownerPrefix}-${wiName}-${slugify(subject)}`

const branchName = (ownerPrefix, wiName, subject) =>
  `${ownerPrefix}/${wiName}-${slugify(subject)}`

phase('Resolve identity')

const identity = await agent(
  `Resolve the runner's identity for the auto-build pipeline.

Steps:
1. Run 'sf alias list --json'. Find the entry whose alias matches /^gus$/i. If missing, return {error: "no gus alias — run 'sf org login web -a gus'"} and stop.
2. Take the alias's value (the username). Query GUS:
   sf data query --query "SELECT Id FROM User WHERE Username = '<username>' LIMIT 1" -o gus --result-format json
   Take result.records[0].Id → userId.
3. Read .claude/skills/gus-cli/SKILL.md. Find the "Team members" table. Locate the row whose username (alias value) matches. Extract:
   - the row's Id (must equal userId — sanity-check)
   - GitHub login
   - Slack ID
   - owner prefix: derive from Name column as initials lowercase (e.g. "Shane McLaughlin" → "sm", "Daphne Yang" → "dy"). Two letters preferred; for one-word names use first 2 letters.
4. If username doesn't appear in the table, return {error: "runner '<username>' not in gus-cli Team members table"}.

Return ONLY the structured result. Do not log progress narration.`,
  { schema: IDENTITY_SCHEMA, label: 'resolve-identity', model: 'haiku' }
)

if (identity.error || !identity.userId) {
  log(`identity resolution failed: ${identity.error || 'unknown'} — exiting`)
  return { exited: 'identity-failed', error: identity.error }
}

log(`runner: ${identity.username} (${identity.ownerPrefix}, ${identity.githubLogin})`)

phase('Ensure daemons')

await agent(
  `Ensure the gha-rerun daemon is running.

Read .claude/skills/gha-rerun/SKILL.md (and .claude/commands/gha-rerun.md if present) to learn the launcher and how to detect a running daemon (process name, lock file, or state file). Check current state:
- If running: return {ok: true, detail: "already-running"}.
- If not: invoke the launcher per the skill, verify it's running, and return {ok: true, detail: "started"}.
- If launch fails: return {ok: false, detail: "<reason>"}.

Do not configure or rerun anything else. The daemon owns rerun budget; this step just keeps it alive.`,
  { schema: OK_SCHEMA, label: 'ensure-gha-rerun-daemon', phase: 'Ensure daemons', model: 'sonnet' }
)

phase('Monitor in-flight')

const inFlight = await agent(
  `Query GUS for in-flight ai-auto work items assigned to userId ${identity.userId}.

Run a BROAD query — any active status that could plausibly be in-flight, so we never lose track of a WI whose status drifted:
sf data query --query "SELECT Id, Name, Subject__c, Details__c, Status__c, Story_Points__c, CreatedDate FROM ADM_Work__c WHERE Assignee__c = '${identity.userId}' AND Status__c IN ('New','Ready','In Progress','Ready for Review','QA In Progress','Fixed','Waiting') AND Subject__c LIKE '%[ai-auto]%'" -o gus --result-format json

Then filter the records: KEEP only those whose Details__c contains a GitHub PR URL (substring "github.com/forcedotcom/salesforcedx-vscode/pull/"). Those are the truly in-flight WIs — they have an open PR. Drop the rest (those are candidates, handled later).

For each kept record, extract the PR URL from Details__c. Match ANY of these patterns (HTML or plain):
- A literal "PR: https://github.com/forcedotcom/salesforcedx-vscode/pull/<n>" anywhere in Details__c
- An anchor tag <a href="https://github.com/forcedotcom/salesforcedx-vscode/pull/<n>">...</a> anywhere in Details__c
- Any https://github.com/forcedotcom/salesforcedx-vscode/pull/<n> URL string in Details__c
Take the LAST match (most recent).

Return one entry per kept record with wiId=Id, name=Name, subject=Subject__c, details=Details__c, prUrl=<extracted>, storyPoints=Story_Points__c, createdDate=CreatedDate.

Return ONLY the structured result.`,
  { schema: WI_LIST_SCHEMA, label: 'query-in-flight', phase: 'Monitor in-flight', model: 'haiku' }
)

const inFlightWis = inFlight.wis || []
log(`in-flight: ${inFlightWis.length} WI(s)`)

const monitorOutcomes = await pipeline(
  inFlightWis,
  async wi => {
    if (!wi.prUrl) {
      // Edge case: claim happened in a prior tick but PR was never created (build crashed).
      // Treat as a builder restart.
      return { wi, action: 'no-pr-restart' }
    }
    const prState = await agent(
      `Check PR state for ${wi.prUrl}.

Run:
- gh pr view ${wi.prUrl} --json state,isDraft,number,statusCheckRollup
- Parse statusCheckRollup. Determine overall state:
  - 'no-pr' if gh fails to find the PR
  - 'green' if every check has conclusion SUCCESS or NEUTRAL or SKIPPED
  - 'running' if any check is IN_PROGRESS or QUEUED or PENDING
  - 'failed' otherwise (any FAILURE, CANCELLED, TIMED_OUT, etc., with NO IN_PROGRESS/QUEUED/PENDING remaining)
- If state is 'failed', collect failed job names. Run 'gh run view --log-failed <runId>' for the most recent failed/cancelled run linked to the PR head SHA, capture last ~100 lines as failedLogsExcerpt. Also gather the maximum 'run_attempt' across the workflow runs for the PR head SHA (gh api repos/forcedotcom/salesforcedx-vscode/actions/runs?head_sha=<sha> → max .run_attempt). Return that as maxRunAttempt.

Return ONLY the structured result.`,
      { schema: PR_STATE_SCHEMA, label: `check-pr-${wi.name}`, phase: 'Monitor in-flight', model: 'sonnet' }
    )
    return { wi, prState, action: 'evaluate' }
  },
  async result => {
    if (!result || result.action === 'no-pr-restart') return result
    const { wi, prState } = result
    if (prState.state === 'green') return { ...result, decision: 'finalize' }
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

const toFinalize = monitorOutcomes.filter(r => r && r.decision === 'finalize')
const toTriage = monitorOutcomes.filter(r => r && r.decision === 'triage')
const toRestart = monitorOutcomes.filter(
  r => r && (r.decision === 'no-pr-restart' || r.action === 'no-pr-restart')
)

if (toTriage.length) {
  phase('Triage failures')
  const triaged = await parallel(
    toTriage.map(r => () =>
      agent(
        `Triage CI failure on PR ${r.wi.prUrl} for WI ${r.wi.name}.

Failed jobs: ${(r.prState.failedJobs || []).join(', ')}
Log excerpt:
${r.prState.failedLogsExcerpt || '(none)'}

Worktree path: ${worktreePath(identity.ownerPrefix, r.wi.name, r.wi.subject)}

Tasks:
1. Reattach to the worktree (recreate via 'git worktree add <path> <branch>' if missing; run 'npm install' if package-lock.json differs).
2. Inspect the failure vs. the diff ('git diff origin/develop...HEAD').
3. Classify:
   - 'flake-or-infra' if the failure is unrelated to the diff (network, infra, transient)
   - 'e2e-test-issue' if the failure is in e2e test code itself (selector drift, race, etc.) and the fix is contained to e2e files
   - 'code-bug' if the failure indicates a real bug in the source under change (cross-OS path bug, runtime mismatch, logic bug, etc.)
   - 'unknown' if you cannot decide

Return ONLY the structured result.`,
        { schema: TRIAGE_SCHEMA, label: `triage-${r.wi.name}`, phase: 'Triage failures' }
      ).then(triage => ({ ...r, triage }))
    )
  )

  phase('Fix CI failures')
  await parallel(
    triaged.filter(Boolean).map(r => async () => {
      const wt = worktreePath(identity.ownerPrefix, r.wi.name, r.wi.subject)
      if (r.triage.route === 'flake-or-infra' || r.triage.route === 'unknown') {
        await agent(
          `DM the runner about a CI failure that needs human attention.

Slack ID: ${identity.slackId}
Use mcp__slack__slack_send_message to send a DM with content:
"⚠️ ${r.wi.name} CI failed after rerun budget exhausted (route=${r.triage.route}): ${r.triage.summary}\nPR: ${r.wi.prUrl}"

Return {ok: true} on success.`,
          { schema: OK_SCHEMA, label: `dm-${r.wi.name}`, phase: 'Fix CI failures', model: 'haiku' }
        )
        return
      }
      if (r.triage.route === 'e2e-test-issue') {
        await agent(
          `Fix an e2e test failure in worktree ${wt} for WI ${r.wi.name}.

Use the analyze-e2e command and the playwright-e2e skill. Inspect failing job logs (gh run view --log-failed) and the e2e test code in the worktree. Make the fix, commit with message "fix(e2e): <brief> - ${r.wi.name}", and push.

Failed jobs: ${(r.prState.failedJobs || []).join(', ')}
Log excerpt:
${r.prState.failedLogsExcerpt || '(none)'}

Return {status: 'done', commits: [<sha>], reason?} on success or {status: 'stuck', reason} otherwise.`,
          { schema: BUILD_SCHEMA, label: `e2e-fix-${r.wi.name}`, phase: 'Fix CI failures', isolation: 'worktree' }
        )
        return
      }
      // code-bug → run builder with failure context
      await agent(
        `Fix a code bug exposed by CI in worktree ${wt} for WI ${r.wi.name}.

Read the original plan at .claude/plans/${r.wi.name}.md. The failure indicates the code under change is wrong (cross-OS, cross-runtime, or logic bug).

Failed jobs: ${(r.prState.failedJobs || []).join(', ')}
Log excerpt:
${r.prState.failedLogsExcerpt || '(none)'}

Apply the appropriate skills (read frontmatter from .claude/skills/*/SKILL.md to pick relevant ones; always apply: typescript, paths). Repo hooks run on tool calls and will surface compile/lint/dead-code/LSP issues — use that signal to drive correctness; don't run your own retry loop. Commit each logical fix as a separate commit. Push when done.

Return {status: 'done', commits} or {status: 'stuck', reason}.`,
        { schema: BUILD_SCHEMA, label: `code-fix-${r.wi.name}`, phase: 'Fix CI failures', isolation: 'worktree' }
      )
    })
  )
}

const toRefresh = monitorOutcomes.filter(
  r => r && (r.decision === 'wait' || r.decision === 'finalize') && r.wi.prUrl
)
if (toRefresh.length) {
  phase('Keep in-flight current')
  await parallel(
    toRefresh.map(r => () =>
      agent(
        `Keep WI ${r.wi.name}'s branch current with origin/develop.

Worktree: ${worktreePath(identity.ownerPrefix, r.wi.name, r.wi.subject)}
Branch: ${branchName(identity.ownerPrefix, r.wi.name, r.wi.subject)}
PR: ${r.wi.prUrl}

Steps (idempotent; skip work if already current):
1. Reattach worktree if missing: 'git worktree add <path> <branch>'.
2. cd worktree && git fetch origin develop
3. If 'git rev-list --count HEAD..origin/develop' is 0, return {ok: true, detail: "already current"}.
4. git merge origin/develop --no-edit
5. Conflicts → apply .claude/skills/merge-conflicts/SKILL.md best-effort. Unresolvable → 'git merge --abort' and DM ${identity.slackId} via mcp__slack__slack_send_message: "⚠️ ${r.wi.name} merge conflict with develop — manual intervention needed\\nWorktree: <path>\\nPR: ${r.wi.prUrl}". Return {ok: false, detail: "merge-conflict-unresolved"}.
6. If package-lock.json changed, run 'npm install'.
7. git push

Return {ok: true, detail: "<n> commits merged"} or {ok: false, detail}.`,
        { schema: OK_SCHEMA, label: `refresh-${r.wi.name}`, phase: 'Keep in-flight current', isolation: 'worktree' }
      )
    )
  )
}

if (toFinalize.length) {
  phase('Finalize ready')
  await parallel(
    toFinalize.map(r => () =>
      agent(
        `Finalize WI ${r.wi.name} as Ready for Review.

PR: ${r.wi.prUrl}
Worktree: ${worktreePath(identity.ownerPrefix, r.wi.name, r.wi.subject)}
Runner userId: ${identity.userId}
Runner GitHub login: ${identity.githubLogin}
Runner Slack ID: ${identity.slackId}

Steps (idempotent — check current state before each mutation):
1. If PR is still draft, 'gh pr ready ${r.wi.prUrl}'.
2. If WI status != 'Ready for Review', update:
   sf data update record -s ADM_Work__c -i ${r.wi.wiId} -o gus -v "Status__c='Ready for Review' QA_Engineer__c='${identity.userId}'"
3. Reviewer reassignment per pr-draft skill (read .claude/skills/pr-draft/SKILL.md):
   - gh pr view ${r.wi.prUrl} --json reviewRequests --jq '.reviewRequests[].login'
   - For each existing reviewer that isn't ${identity.githubLogin}: 'gh pr edit ${r.wi.prUrl} --remove-reviewer <login>'
   - 'gh pr edit ${r.wi.prUrl} --add-reviewer ${identity.githubLogin}' (if not already)
4. Slack post in #ide-exp-code-review (channel ${REVIEW_CHANNEL_ID}) tagging the runner:
   "<@${identity.slackId}> PR ready for review: <${r.wi.prUrl}|PR> (${r.wi.name})"
   Use mcp__slack__slack_send_message. Only post if you actually changed the WI status this call — otherwise skip the post (idempotency).
5. Remove the worktree: 'git worktree remove ${worktreePath(identity.ownerPrefix, r.wi.name, r.wi.subject)} --force' (if present).

Return {ok: true, detail} where detail summarizes what changed.`,
        { schema: OK_SCHEMA, label: `finalize-${r.wi.name}`, phase: 'Finalize ready', model: 'sonnet' }
      )
    )
  )
}

// Decide whether to restart a stuck in-flight WI, claim a new one, or exit.
const stillInFlight = inFlightWis.length - toFinalize.length // optimistic; some finalizers may have failed

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

  phase('Pick candidate')

  const candidates = await agent(
    `Query claim candidates for userId ${identity.userId}.

Run:
sf data query --query "SELECT Id, Name, Subject__c, Details__c, Story_Points__c, CreatedDate FROM ADM_Work__c WHERE Assignee__c = '${identity.userId}' AND Status__c IN ('New','Ready') AND Subject__c LIKE '%[ai-auto]%' ORDER BY CreatedDate ASC LIMIT 50" -o gus --result-format json

Map each record to wiId, name, subject, details, storyPoints, createdDate. prUrl is null for candidates.

CRITICAL filter: EXCLUDE any record whose Details__c contains the string "github.com/forcedotcom/salesforcedx-vscode/pull/". A PR URL in Details means a prior tick already opened a PR — this WI is in flight even if the Status field disagrees, and re-claiming it would clobber the existing PR. Drop those records before returning.

Return ONLY the structured result.`,
    { schema: WI_LIST_SCHEMA, label: 'query-candidates', phase: 'Pick candidate', model: 'haiku' }
  )

  const candidateList = candidates.wis || []
  if (!candidateList.length) {
    log('no candidates — nothing to do')
    return { exited: 'idle', inFlight: stillInFlight }
  }

  // Belt-and-suspenders: also filter in code in case the agent missed any.
  const inFlightWiIds = new Set(inFlightWis.map(w => w.wiId))
  const filteredCandidates = candidateList.filter(c => {
    if (inFlightWiIds.has(c.wiId)) return false
    const d = c.details || ''
    if (d.includes('github.com/forcedotcom/salesforcedx-vscode/pull/')) {
      log(`excluding ${c.name}: Details already contains a PR URL`)
      return false
    }
    return true
  })
  if (!filteredCandidates.length) {
    log('no candidates after PR-URL filter — nothing to do')
    return { exited: 'idle', inFlight: stillInFlight }
  }
  candidateList.length = 0
  candidateList.push(...filteredCandidates)

  if (candidateList.length === 1) {
    chosen = candidateList[0]
    log(`single candidate: ${chosen.name}`)
  } else {
    const inFlightFiles = await agent(
      `Collect changed file paths from in-flight PRs to avoid overlap when picking.

In-flight PR URLs: ${inFlightWis.filter(w => w.prUrl).map(w => w.prUrl).join(' ') || '(none)'}

For each, run 'gh pr diff <url> --name-only' and aggregate the union of file paths. Return {ok: true, detail: "<comma-separated paths or 'none'>"}.`,
      { schema: OK_SCHEMA, label: 'in-flight-files', phase: 'Pick candidate', model: 'haiku' }
    )
    const pick = await agent(
      `Pick the next WI to work on from these candidates.

Candidates (JSON):
${JSON.stringify(candidateList, null, 2)}

Files already touched by in-flight PRs (avoid overlap when possible):
${inFlightFiles.detail || 'none'}

Selection rules (in order):
1. Honor explicit dependencies in WI text ("blocked by W-XXX", "depends on W-XXX", "after W-XXX merges") — pick a WI whose dependencies are satisfied; defer ones that aren't.
2. If a candidate's likely files (inferred from Subject/Details) overlap heavily with in-flight files, defer it.
3. Prefer smaller Story_Points (null treated as 5).
4. Tie-break by oldest CreatedDate.

Return ONLY {wiId, reason}.`,
      { schema: PICKER_SCHEMA, label: 'pick-wi', phase: 'Pick candidate', model: 'sonnet' }
    )
    chosen = candidateList.find(c => c.wiId === pick.wiId) || candidateList[0]
    log(`picked ${chosen.name}: ${pick.reason}`)
  }
}

phase('Claim + worktree')

const wt = worktreePath(identity.ownerPrefix, chosen.name, chosen.subject)
const branch = branchName(identity.ownerPrefix, chosen.name, chosen.subject)

const claimed = isRestart
  ? await agent(
      `Reattach the worktree for in-flight WI ${chosen.name} that has no PR yet (build crashed in a prior tick). WI is already 'In Progress' — do not change its Status.

Worktree: ${wt}
Branch: ${branch}

Steps (idempotent):
1. From ${PROJECT_ROOT}: 'git fetch origin develop'.
2. Ensure a worktree is checked out at ${wt} for ${branch}:
   - If ${wt} already exists, leave it alone (skip to step 3).
   - Else if branch exists locally ('git rev-parse --verify ${branch}'): 'git worktree add ${wt} ${branch}'.
   - Else if branch exists on origin ('git ls-remote --exit-code --heads origin ${branch}'): 'git worktree add ${wt} -b ${branch} origin/${branch}'.
   - Else (no branch anywhere): 'git worktree add -b ${branch} ${wt} origin/develop --no-track'.
3. cd ${wt} && npm install.

Return {ok: false, detail} on failure, else {ok: true, detail: "reattached"}.`,
      { schema: OK_SCHEMA, label: `restart-${chosen.name}`, phase: 'Claim + worktree', model: 'sonnet' }
    )
  : await agent(
      `Claim WI ${chosen.name} (${chosen.wiId}) and set up the worktree.

Steps:
1. Update WI:
   sf data update record -s ADM_Work__c -i ${chosen.wiId} -o gus -v "Status__c='In Progress'"
2. From ${PROJECT_ROOT}, run:
   git fetch origin develop
   git worktree add -b ${branch} ${wt} origin/develop --no-track
3. cd ${wt} && npm install (deps may differ from origin/develop's lockfile and hooks need them).

If any step fails, return {ok: false, detail: "<reason>"}. On success {ok: true, detail: "claimed"}.`,
      { schema: OK_SCHEMA, label: `claim-${chosen.name}`, phase: 'Claim + worktree', model: 'sonnet' }
    )

if (!claimed.ok) {
  log(`${isRestart ? 'restart' : 'claim'} failed: ${claimed.detail}`)
  return { exited: isRestart ? 'restart-failed' : 'claim-failed', error: claimed.detail }
}

phase('Plan')

const skillNames = await agent(
  `List skill directory names under ${SKILLS_DIR} (one per line, no other output).

Run 'ls -1 ${SKILLS_DIR}' from ${PROJECT_ROOT}. Return {ok: true, detail: "<comma-separated names>"}.`,
  { schema: OK_SCHEMA, label: 'list-skills', phase: 'Plan', model: 'haiku' }
)
const skillList = (skillNames.detail || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean)

const planResult = await agent(
  `Plan implementation for WI ${chosen.name} in worktree ${wt}.

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

Do not commit yet.`,
  { schema: PLAN_SCHEMA, label: `plan-${chosen.name}`, phase: 'Plan', isolation: 'worktree' }
)

if (planResult.verdict === 'blocked') {
  await agent(
    `Bounce WI ${chosen.name} to Waiting and DM the runner.

Steps:
1. Update WI:
   sf data update record -s ADM_Work__c -i ${chosen.wiId} -o gus -v "Status__c='Waiting'"
2. DM ${identity.slackId} via mcp__slack__slack_send_message:
   "🚧 ${chosen.name} bounced to Waiting (plan blocked): ${chosen.subject}\\nQuestions:\\n${(planResult.blocked && planResult.blocked.questions || []).map(q => `• ${q}`).join('\\n')}\\nRun /grill-me to refine."
3. Remove worktree: 'git worktree remove ${wt} --force'.
Return {ok: true}.`,
    { schema: OK_SCHEMA, label: `bounce-${chosen.name}`, phase: 'Plan', model: 'haiku' }
  )
  return { exited: 'plan-blocked', wi: chosen.name }
}

const planReview = await agent(
  `Review the plan at ${wt}/.claude/plans/${chosen.name}.md.

BEFORE judging, Read ${wt}/.claude/skills/concise/SKILL.md so 'concise style' is concrete to you.

Enforce:
- concise skill style (the rules you just read)
- Each phase has a clear commit message
- Verification section exists and notes which items are e2e-covered
- Skills list is non-empty and includes typescript

Return {approved: true} or {approved: false, revisions: [...]}.`,
  { schema: PLAN_REVIEW_SCHEMA, label: `plan-review-${chosen.name}`, phase: 'Plan', isolation: 'worktree', model: 'sonnet' }
)

if (!planReview.approved) {
  await agent(
    `Revise the plan at ${wt}/.claude/plans/${chosen.name}.md addressing:
${(planReview.revisions || []).map(r => `- ${r}`).join('\n')}

Return {verdict: 'plan'} when done.`,
    { schema: PLAN_SCHEMA, label: `plan-revise-${chosen.name}`, phase: 'Plan', isolation: 'worktree', model: 'sonnet' }
  )
}

const [effectPlanReview, e2ePlanReview, adversaryPlanReview] = await parallel([
  () =>
    agent(
      `Review the plan at ${wt}/.claude/plans/${chosen.name}.md (mode: plan review). Identify Effect-TS smells the plan would introduce — hand-rolled retry/timeout/cache, untyped errors, ad-hoc PubSub, services that already exist in salesforcedx-vscode-services, etc.

Return ONLY the structured result.`,
      { schema: EFFECT_ADVOCATE_SCHEMA, label: `effect-plan-${chosen.name}`, phase: 'Plan', isolation: 'worktree', agentType: 'effect-advocate' }
    ),
  () =>
    agent(
      `Review the plan at ${wt}/.claude/plans/${chosen.name}.md for e2e test coverage adequacy.

WI Subject: ${chosen.subject}
WI Details:
${chosen.details || '(empty)'}

Return ONLY the structured result.`,
      { schema: EFFECT_ADVOCATE_SCHEMA, label: `e2e-plan-${chosen.name}`, phase: 'Plan', isolation: 'worktree', agentType: 'e2e-advocate' }
    ),
  () =>
    agent(
      `Adversarially review the plan at ${wt}/.claude/plans/${chosen.name}.md.

WI Subject: ${chosen.subject}
WI Details:
${chosen.details || '(empty)'}

Return ONLY the structured result.`,
      { schema: PLAN_ADVERSARY_SCHEMA, label: `adversary-plan-${chosen.name}`, phase: 'Plan', isolation: 'worktree', agentType: 'plan-adversary' }
    ),
])

const effectMust = (effectPlanReview && effectPlanReview.findings || []).filter(f => f.severity === 'must')
const e2eMust = (e2ePlanReview && e2ePlanReview.findings || []).filter(f => f.severity === 'must')
const adversaryBlocking = (adversaryPlanReview && adversaryPlanReview.findings || []).filter(f => f.severity === 'critical' || f.severity === 'high')

const advocateRevisions = [
  ...effectMust.map(f => `[effect] ${f.suggestion}${f.citation ? ' [' + f.citation + ']' : ''}`),
  ...e2eMust.map(f => `[e2e] ${f.suggestion}${f.citation ? ' [' + f.citation + ']' : ''}`),
  ...adversaryBlocking.map(f => `[adversary:${f.severity}] ${f.claim}${f.suggestion ? ' — ' + f.suggestion : ''}${f.evidence ? ' [' + f.evidence + ']' : ''}`),
]

if (advocateRevisions.length) {
  await agent(
    `Revise the plan at ${wt}/.claude/plans/${chosen.name}.md to address these advocate findings before implementation. The plan must reflect the right approach (Effect idioms, e2e coverage, adversarial concerns), not work around them.

Findings:
${advocateRevisions.map(r => `- ${r}`).join('\n')}

Return {verdict: 'plan'} when done.`,
    { schema: PLAN_SCHEMA, label: `plan-advocate-revise-${chosen.name}`, phase: 'Plan', isolation: 'worktree' }
  )
}

await agent(
  `Commit the plan file in ${wt} — only if there is something to commit.

Steps:
1. cd ${wt}
2. git add .claude/plans/${chosen.name}.md
3. If 'git diff --cached --quiet' returns 0 (nothing staged), skip the commit and return {ok: true, detail: "no-op (plan unchanged)"}.
4. Else: git commit -m "chore: plan for ${chosen.name}" and return {ok: true, detail: "committed"}.`,
  { schema: OK_SCHEMA, label: `commit-plan-${chosen.name}`, phase: 'Plan', isolation: 'worktree', model: 'haiku' }
)

phase('Build')

const buildResult = await agent(
  `Build WI ${chosen.name} per the plan at ${wt}/.claude/plans/${chosen.name}.md.

Operate inside ${wt}. Execute each plan phase end-to-end and commit per the plan's commit-message boundaries (one commit per phase). Apply the skills listed in the plan.

Repo hooks run on tool calls and will surface compile / lint / dead-code / LSP / effect issues — use that feedback to drive correctness. Do NOT run your own retry counter. If you genuinely cannot make progress, return {status: 'stuck', reason}.

If 'package-lock.json' changes during build, re-run 'npm install'.

Return {status: 'done', commits: [<shas>]} on success.`,
  { schema: BUILD_SCHEMA, label: `build-${chosen.name}`, phase: 'Build', isolation: 'worktree' }
)

if (buildResult.status === 'stuck') {
  await agent(
    `Bounce WI ${chosen.name} to Waiting (build stuck) and DM the runner. Worktree stays for human takeover.

Steps:
1. Update WI: sf data update record -s ADM_Work__c -i ${chosen.wiId} -o gus -v "Status__c='Waiting'"
2. DM ${identity.slackId} via mcp__slack__slack_send_message:
   "⚠️ ${chosen.name} build stuck: ${(buildResult.reason || '').replace(/"/g, "'")}\\nWorktree: ${wt}\\nBranch: ${branch}"
Return {ok: true}.`,
    { schema: OK_SCHEMA, label: `bounce-build-${chosen.name}`, phase: 'Build', model: 'haiku' }
  )
  return { exited: 'build-stuck', wi: chosen.name, reason: buildResult.reason }
}

phase('Review')

const diffInfo = await agent(
  `Get diff stats for the branch in ${wt}.

Run from ${wt}:
- git diff --shortstat origin/develop...HEAD
- git diff --name-only origin/develop...HEAD

Return {ok: true, detail: "<lineCount>::<comma-separated files>"} where lineCount is the total of insertions+deletions parsed from --shortstat (or 0 if none).`,
  { schema: OK_SCHEMA, label: `diff-${chosen.name}`, phase: 'Review', isolation: 'worktree', model: 'haiku' }
)

const [lineCountStr] = (diffInfo.detail || '0::').split('::')
const lineCount = Number(lineCountStr) || 0
const skillsToCheck =
  lineCount < SMALL_DIFF_LINES
    ? skillList.filter(s => ALWAYS_APPLICABLE_SKILLS.includes(s))
    : skillList.filter(s => !REVIEW_SKILL_DENYLIST.includes(s))

log(`diff: ${lineCount} lines; checking ${skillsToCheck.length} skills`)

const skillFindings = await parallel(
  skillsToCheck.map(skill => () =>
    agent(
      `Decide if skill '${skill}' applies to the current branch's diff in ${wt}.

Read .claude/skills/${skill}/SKILL.md.
Examine: git diff origin/develop...HEAD (run from ${wt}).

Answer:
- applies: true if the diff intersects this skill's domain
- findings: concrete code-level changes that would improve the code per this skill, severity-graded. If applies but no actionable findings, return findings: [].

Return ONLY the structured result.`,
      { schema: SKILL_DETECT_SCHEMA, label: `skill-${skill}`, phase: 'Review', isolation: 'worktree', model: 'sonnet' }
    )
  )
)

const thermo = await agent(
  `Run a thermonuclear code-quality review on the diff in ${wt}.

Read and apply .claude/skills/thermonuclear-code-quality-review/SKILL.md. Examine 'git diff origin/develop...HEAD'. Return severity-graded findings only — file:line evidence required.`,
  { schema: THERMO_SCHEMA, label: `thermo-${chosen.name}`, phase: 'Review', isolation: 'worktree' }
)

const effectDiffReview = await agent(
  `Review the diff in ${wt} (mode: diff review). Examine 'git diff origin/develop...HEAD'.`,
  { schema: EFFECT_ADVOCATE_SCHEMA, label: `effect-diff-${chosen.name}`, phase: 'Review', isolation: 'worktree', agentType: 'effect-advocate' }
)

phase('Fix review findings')

const fixerResult = await agent(
  `Apply review findings to the code in ${wt}.

Skill findings (per-skill JSON):
${JSON.stringify(skillFindings.filter(Boolean).map((r, i) => ({ skill: skillsToCheck[i], ...r })), null, 2)}

Thermonuclear findings:
${JSON.stringify(thermo.findings, null, 2)}

Effect-advocate findings (severity mapping: 'must' = critical, 'should' = high, 'consider' = medium):
${JSON.stringify(effectDiffReview.findings || [], null, 2)}

Rules:
- Auto-apply ALL critical and high severity findings (this includes every effect-advocate 'must' and 'should').
- Auto-apply medium / low when the fix is cheap and clearly correct.
- Surface the rest in 'remaining' with note + severity for the PR body.

Group commits logically: e.g. one commit "fix: critical/high review findings", one "refactor: medium/low review findings". If nothing to fix, return {fixedCount: 0, remaining: [...]}.

Return ONLY the structured result.`,
  { schema: FIXER_SCHEMA, label: `fix-${chosen.name}`, phase: 'Fix review findings', isolation: 'worktree' }
)

await agent(
  `Merge origin/develop into the branch in ${wt}.

Steps:
1. cd ${wt}
2. git fetch origin develop
3. git merge origin/develop --no-edit
4. If conflicts, apply .claude/skills/merge-conflicts/SKILL.md best-effort. If unresolvable: 'git merge --abort' and return {ok: false, detail: "merge-conflict-unresolved"}.
5. If package-lock.json changed in the merge, run 'npm install'.
6. If the merge ran cleanly with no conflicts, no commit needed beyond the merge commit git already made.
Return {ok: true} on success.`,
  { schema: OK_SCHEMA, label: `merge-${chosen.name}`, phase: 'Fix review findings', isolation: 'worktree', model: 'sonnet' }
)

phase('Draft PR')

const prResult = await agent(
  `Push the branch and open a draft PR for WI ${chosen.name}.

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
5. Create draft PR: gh pr create --draft --title "<title>" --body "<body>" --base develop
6. Take the PR URL from gh's output.
7. Append a PR link to the WI Details__c. CRITICAL: do NOT replace Details__c — read it first, then APPEND.
   a. Fetch existing: \`sf data query --query "SELECT Details__c FROM ADM_Work__c WHERE Id = '${chosen.wiId}'" -o gus --result-format json\`. Parse \`result.records[0].Details__c\` (may be null/empty).
   b. If existing already contains this exact PR URL, skip the update (idempotent — return success).
   c. Compose new value = (existing || "") + '<p><strong>PR:</strong> <a href="<prUrl>">#<prNumber></a></p>'. Use this exact HTML so the monitor can re-extract the URL.
   d. Write via --flags-dir to handle quotes safely:
      - mkdir -p /tmp/gus-flags-${chosen.name}
      - Write a SINGLE-LINE file at /tmp/gus-flags-${chosen.name}/values. Format: Details__c="<NEW_VALUE>" using double-quotes around the value. Inside the value, all HTML attribute quotes must remain as plain double-quotes (the file uses single-quote-shell-escaping at the sf CLI layer; per gus-cli skill, single-line values with double-quote outer + literal double-quote inner work). If the existing Details__c contains a literal " character that would break the value file, fall back to appending using the plain-text form: Details__c='<existing-stripped>\\nPR: <prUrl>' but log a warning that the original HTML was lossy.
      - sf data update record -s ADM_Work__c -i ${chosen.wiId} -o gus --flags-dir /tmp/gus-flags-${chosen.name}
   e. Verify: re-query Details__c and confirm BOTH (i) the new PR URL is present AND (ii) at least one original Goal/Done-when/Why marker from the prior content is still present. If either check fails, do NOT claim success — log the failure detail and return so the workflow retries next tick.

Return {prUrl, prNumber}.`,
  { schema: PR_DRAFT_SCHEMA, label: `pr-${chosen.name}`, phase: 'Draft PR', isolation: 'worktree', model: 'sonnet' }
)

log(`opened draft PR ${prResult.prUrl} for ${chosen.name}`)
return {
  exited: 'claimed-and-pr-opened',
  wi: chosen.name,
  prUrl: prResult.prUrl,
  finalized: toFinalize.length,
}
