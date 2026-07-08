export const meta = {
  name: 'review-plan',
  description: 'Multi-pass plan review: concise-style check + revise → effect-advocate + e2e-advocate + plan-adversary fan-out → fold blocking findings into a revise pass → optional commit. Runs standalone or as a sub-step of auto-build-wi.',
  whenToUse: 'On demand against a plan file (/review-plan .claude/plans/W-123.md), or called by auto-build-wi via workflow(). Args: {planPath: file (required), wt?: dir (default "."), subject?, details?, commitMessage?: commit if set}. A bare string sets planPath.',
  phases: [{ title: 'Plan review' }],
}

// =====================================================================
// ARGS
// =====================================================================
// Human: `/review-plan .claude/plans/W-123.md`.
// auto-build-wi: workflow('review-plan', {planPath, wt, subject, details, commitMessage}).
const _a = args || {}
const planPath = typeof _a === 'string' ? _a.trim() : _a.planPath
const wt = (typeof _a === 'object' && _a.wt) || '.'
// used only by the prime agent's standalone/re-plan diff branch; empty in the auto-build-wi pre-Build case
const base = (typeof _a === 'object' && _a.base) || 'origin/develop'
const subject = (typeof _a === 'object' && _a.subject) || ''
const details = (typeof _a === 'object' && _a.details) || ''
const commitMessage = typeof _a === 'object' ? _a.commitMessage : undefined
const label = (typeof _a === 'object' && _a.label) || (planPath || 'plan').split('/').pop()

if (!planPath) {
  log('no planPath provided — pass {planPath} or a bare path string')
  return { error: 'missing-planPath' }
}

// =====================================================================
// SCHEMAS  (mirrored from auto-build-wi.js — workflow scripts can't import)
// =====================================================================

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
        phases: { type: 'array', items: { type: 'object' } },
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

const OK_SCHEMA = {
  type: 'object',
  required: ['ok'],
  properties: { ok: { type: 'boolean' }, detail: { type: ['string', 'null'] } },
}

const PRIME_SCHEMA = {
  type: 'object',
  required: ['pkgs', 'files', 'diff'],
  properties: {
    pkgs: { type: 'array', items: { type: 'string' } },
    files: { type: 'array', items: { type: 'string' } },
    diff: { type: 'string' },
  },
}

// =====================================================================
// PROMPTS
// =====================================================================

const planReviewPrompt = `Review the plan at ${planPath} (relative to ${wt}).

BEFORE judging, Read ${wt}/.claude/skills/concise/SKILL.md so 'concise style' is concrete to you.

Enforce:
- concise skill style (the rules you just read)
- Each phase has a clear commit message
- Verification section exists and notes which items are e2e-covered
- Skills list is non-empty and includes typescript
- **No escape hatches.** Reject any step that pre-authorizes a worse fallback — "if the clean approach proves infeasible / hard / awkward, fall back to <the duplicative or hacky option>". A plan commits to ONE approach. Genuine infeasibility is discovered at build time and escalated then, not licensed in advance — a written fallback becomes the path of least resistance and ships the debt (this is the W-23257488 failure: the plan permitted "fall back to a parallel copy" and the build took it). Require the fallback removed, or split into its own phase with its own justification. Flag as a revision.

Return {approved: true} or {approved: false, revisions: [...]}.`

const planRevisePrompt = revisions =>
  `Revise the plan at ${planPath} (relative to ${wt}) addressing:
${(revisions || []).map(r => `- ${r}`).join('\n')}

Return {verdict: 'plan'} when done.`

const effectPlanReviewPrompt = `Review the plan at ${planPath} (relative to ${wt}, mode: plan review). Identify Effect-TS smells the plan would introduce — hand-rolled retry/timeout/cache, untyped errors, ad-hoc PubSub, services that already exist in salesforcedx-vscode-services, etc.

Return ONLY the structured result.`

const e2ePlanReviewPrompt = `Review the plan at ${planPath} (relative to ${wt}) for e2e test coverage adequacy.

WI Subject: ${subject}
WI Details:
${details || '(empty)'}

Return ONLY the structured result.`

const primePrompt = `Read the plan at ${planPath} (relative to ${wt}) and extract the code it references, so a downstream reviewer can start warm.

Do BOTH:
1. Parse the plan text. Collect every repo-relative path it cites — from \`file:line\` citations and any \`packages/...\` / \`src/...\` mention. Put them in \`files\` (paths only, drop the :line suffix, dedupe). Derive \`pkgs\`: the distinct \`packages/<pkg>\` roots those paths fall under (e.g. \`packages/foo/src/x.ts\` → \`packages/foo\`).
2. From ${wt}, run \`git diff --name-only ${base}...HEAD\` and \`git diff ${base}...HEAD\`. Return the full diff body as \`diff\`. Empty stdout → \`diff: ""\` (expected in the pre-build plan stage). If the diff body exceeds ~60000 chars, return \`diff: "<truncated — run git diff ${base}...HEAD>"\` instead of the body. Union any diff file paths into \`files\` and their package roots into \`pkgs\`.

Return ONLY the structured result {pkgs, files, diff}.`

const adversaryPlanReviewPrompt = (pointers, diff) => `Adversarially review the plan at ${planPath} (relative to ${wt}).

WI Subject: ${subject}
WI Details:
${details || '(empty)'}

Read these first, before any grep/find — start warm:
${pointers}

Use the handed-in file list + CONTEXT pointers to jump straight to the code the plan cites. Do NOT \`find\` / \`git show\` to re-discover package layout or the files the plan already names.

${
  diff
    ? `Branch diff (standalone re-plan case — code already on the branch):\n${diff}\n`
    : `No diff yet (pre-build plan stage) — the plan's cited files above are your map.\n`
}
ADR consistency check. Read the ADRs under ${wt}/docs/adr/ (repo-wide) plus any ${wt}/packages/*/docs/adr/ for packages the plan touches. A recorded ADR is binding by default (Status frontmatter is optional; an ADR without an explicit Proposed/Rejected/Deprecated/Superseded marker is Accepted). Then:
- Flag (finding) any plan step that contradicts an ADR's decision, or re-proposes an alternative an ADR explicitly rejected/superseded. Cite the ADR file in 'evidence'.
- Flag (finding) any decision the plan implies that WOULD warrant a new ADR — per ${wt}/.claude/skills/grill-me/ADR-FORMAT.md "When to offer" (all three gates: hard to reverse, surprising without context, real trade-off) — when the plan does not already sequence an ADR-writing step. Suggest sequencing the ADR first (see work-item-sequencing "ADRs sequence first").

Return ONLY the structured result.`

const planAdvocateRevisePrompt = advocateRevisions =>
  `Revise the plan at ${planPath} (relative to ${wt}) to address these advocate findings before implementation. The plan must reflect the right approach (Effect idioms, e2e coverage, adversarial concerns), not work around them.

Findings:
${advocateRevisions.map(r => `- ${r}`).join('\n')}

Return {verdict: 'plan'} when done.`

const commitPlanPrompt = `Commit the plan file in ${wt} — only if there is something to commit.

Steps:
1. cd ${wt}
2. git add ${planPath}
3. If 'git diff --cached --quiet' returns 0 (nothing staged), skip the commit and return {ok: true, detail: "no-op (plan unchanged)"}.
4. Else commit with subject "${commitMessage}". Use a HEREDOC so the Co-Authored-By trailer with YOUR actual model name is preserved (the same trailer you append on any normal commit). Return {ok: true, detail: "committed"}.`

// =====================================================================
// ORCHESTRATION
// =====================================================================

phase('Plan review')

const planReview = await agent(planReviewPrompt, {
  schema: PLAN_REVIEW_SCHEMA,
  label: `plan-review-${label}`,
  phase: 'Plan review',
  model: 'sonnet',
})

if (!planReview.approved) {
  await agent(planRevisePrompt(planReview.revisions), {
    schema: PLAN_SCHEMA,
    label: `plan-revise-${label}`,
    phase: 'Plan review',
    model: 'sonnet',
  })
}

// Prime the adversary with the code the plan references (pre-build: no diff, so
// the plan-cited files + package CONTEXT.md are the warm-start map).
const prime = await agent(primePrompt, {
  schema: PRIME_SCHEMA,
  label: `prime-${label}`,
  phase: 'Plan review',
  model: 'haiku',
})

const primeFiles = ((prime && prime.files) || []).map(f => f.trim()).filter(Boolean)
const primePkgs = ((prime && prime.pkgs) || []).map(p => p.trim()).filter(Boolean)
const primeDiff = (prime && prime.diff) || ''
const pkgContexts = [...new Set(primePkgs)].map(p => `${wt}/${p}/CONTEXT.md`)

const pointers = [
  `${wt}/CONTEXT-MAP.md`,
  ...pkgContexts,
  ...primeFiles.map(f => `${wt}/${f}`),
]
  .map(p => `- ${p}`)
  .join('\n')

const [effectPlanReview, e2ePlanReview, adversaryPlanReview] = await parallel([
  () =>
    agent(effectPlanReviewPrompt, {
      schema: EFFECT_ADVOCATE_SCHEMA,
      label: `effect-plan-${label}`,
      phase: 'Plan review',
      agentType: 'effect-advocate',
    }),
  () =>
    agent(e2ePlanReviewPrompt, {
      schema: EFFECT_ADVOCATE_SCHEMA,
      label: `e2e-plan-${label}`,
      phase: 'Plan review',
      agentType: 'e2e-advocate',
    }),
  () =>
    agent(adversaryPlanReviewPrompt(pointers, primeDiff), {
      schema: PLAN_ADVERSARY_SCHEMA,
      label: `adversary-plan-${label}`,
      phase: 'Plan review',
      agentType: 'plan-adversary',
    }),
])

const effectMust = ((effectPlanReview && effectPlanReview.findings) || []).filter(
  f => f.severity === 'must'
)
const e2eMust = ((e2ePlanReview && e2ePlanReview.findings) || []).filter(f => f.severity === 'must')
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
  log(`applying ${advocateRevisions.length} advocate revision(s)`)
  await agent(planAdvocateRevisePrompt(advocateRevisions), {
    schema: PLAN_SCHEMA,
    label: `plan-advocate-revise-${label}`,
    phase: 'Plan review',
    model: 'opus',
  })
}

if (commitMessage) {
  await agent(commitPlanPrompt, {
    schema: OK_SCHEMA,
    label: `commit-plan-${label}`,
    phase: 'Plan review',
    model: 'haiku',
  })
}

return {
  styleApproved: planReview.approved,
  styleRevisions: planReview.revisions || [],
  advocateRevisions,
  committed: !!commitMessage,
}
