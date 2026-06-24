export const meta = {
  name: 'review-diff',
  description: 'Thermonuclear code review of a branch diff: applicable-skill fan-out + thermo + effect review → adversarial per-finding verify → optional fix. Runs standalone or as a sub-step of auto-build-wi.',
  whenToUse: 'On demand against the current branch (/review-diff), or called by auto-build-wi via workflow(). Args: {wt?: dir (default "."), base?: ref (default "origin/develop"), apply?: bool (default true)}. Pass a bare path string to set wt.',
  phases: [
    { title: 'Discover skills' },
    { title: 'Review' },
    { title: 'Verify findings' },
    { title: 'Fix review findings' },
  ],
}

// =====================================================================
// ARGS
// =====================================================================
// Human: `/review-diff` (cwd, origin/develop, apply) or `/review-diff ../some-worktree`.
// auto-build-wi: workflow('review-diff', {wt, base: 'origin/develop', apply: true}).
const _a = args || {}
const wt = (typeof _a === 'string' ? _a.trim() : _a.wt) || '.'
const base = (typeof _a === 'object' && _a.base) || 'origin/develop'
const apply = typeof _a === 'object' && _a !== null && 'apply' in _a ? !!_a.apply : true
const label = (typeof _a === 'object' && _a.label) || wt.split('/').pop() || 'diff'

// =====================================================================
// CONSTANTS  (mirrored from auto-build-wi.js — workflow scripts can't import)
// =====================================================================

const SMALL_DIFF_LINES = 20
const ALWAYS_APPLICABLE_SKILLS = ['typescript', 'concise', 'paths']
const SKILLS_DIR = '.claude/skills'
// Skills not relevant to code review of a diff — operational workflows or environmental setup.
// thermonuclear-code-quality-review is excluded here because it already runs as the dedicated
// thermoPrompt step below; the generic skill fan-out must not invoke it a second time. The skill
// also carries `disable-model-invocation: true`, so it should never be auto-selected on its own.
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
  'thermonuclear-code-quality-review',
]

// Severity rank for sorting. effect 'must'/'should'/'consider' map to
// critical/high/medium upstream in normalizeFindings before reaching here.
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

// =====================================================================
// SCHEMAS
// =====================================================================

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

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['verdict', 'severity', 'rationale'],
  properties: {
    // confirmed: premise verified and could not be disproven — keep at claimed severity (default outcome).
    // downgraded: impact PROVEN lower than claimed (not "seems minor") — severity = proven level.
    // dropped: finding DISPROVEN — premise false, already-covered (CI runs it), or zero affected consumers.
    verdict: { enum: ['confirmed', 'downgraded', 'dropped'] },
    severity: { enum: ['critical', 'high', 'medium', 'low'] },
    rationale: { type: 'string' },
    evidence: { type: ['string', 'null'] },
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

// =====================================================================
// HELPERS
// =====================================================================

const parseShortstatLines = shortstat => {
  // e.g. " 3 files changed, 12 insertions(+), 4 deletions(-)"
  const ins = (shortstat.match(/(\d+)\s+insertion/) || [0, 0])[1]
  const del = (shortstat.match(/(\d+)\s+deletion/) || [0, 0])[1]
  return Number(ins) + Number(del)
}

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

// =====================================================================
// PROMPTS
// =====================================================================

const listSkillsPrompt = `Run 'ls -1 ${wt}/${SKILLS_DIR}' and return {skills: [<one entry per line, no blanks>]}.`

const diffPrompt = `From ${wt}, run both:
- git diff --shortstat ${base}...HEAD
- git diff --name-only ${base}...HEAD

Return {shortstat: "<raw stdout of --shortstat, may be empty>", files: [<one path per line of --name-only>]}.`

const skillDetectPrompt = skill =>
  `Decide if skill '${skill}' applies to the current branch's diff in ${wt}.

Read ${wt}/${SKILLS_DIR}/${skill}/SKILL.md.
Examine: git diff ${base}...HEAD (run from ${wt}).

Answer:
- applies: true if the diff intersects this skill's domain
- findings: concrete code-level changes that would improve the code per this skill, severity-graded. If applies but no actionable findings, return findings: [].

Return ONLY the structured result.`

const thermoPrompt = `Run a thermonuclear code-quality review on the diff in ${wt}.

Read and apply ${wt}/${SKILLS_DIR}/thermonuclear-code-quality-review/SKILL.md (fall back to ~/.claude/skills/thermonuclear-code-quality-review/SKILL.md if absent in the worktree). Examine 'git diff ${base}...HEAD'. Return severity-graded findings only — file:line evidence required.`

const effectDiffReviewPrompt = `Review the diff in ${wt} (mode: diff review). Examine 'git diff ${base}...HEAD'.`

const verifyFindingPrompt = finding =>
  `Adversarially verify ONE code-review finding against the diff in ${wt}. Your job is to DISPROVE the finding, not to justify it. The burden of proof is on dropping/downgrading — a finding is kept at its claimed severity UNLESS you can affirmatively prove it wrong (drop) or prove its impact is lower than claimed (downgrade). "I can't see what value this adds" / "both forms work" / "it's only style or architecture" is NOT grounds to drop or downgrade — that is a KEEP. You only act against a finding with EVIDENCE that disproves it.

Finding (source: ${finding.source}):
${JSON.stringify({ severity: finding.severity, file: finding.file, line: finding.line, claim: finding.claim }, null, 2)}

Establish the premise with EVIDENCE, not assumption. Read the cited file:line and 'git diff ${base}...HEAD' in ${wt}.

Verdict rules:
- **dropped** — ONLY when you can affirmatively DISPROVE the finding via one of these (each is a proof, not a judgment call):
  - **Premise false**: the cited code doesn't do what the finding claims. You read it; the claim is factually wrong.
  - **Already covered by CI**: it only asks to RUN tests/checks that CI already runs on the PR. CI runs Playwright e2e (with retries) and the stop-hook chain (compile/lint/knip/effect-LS/unit) as gating checks — re-running them by hand before merge is redundant. Inspect '.github/workflows/' in ${wt} to confirm what CI covers; a "run X before merge" finding where X is a gating CI job → dropped.
  - **Zero consumer**: it claims a BREAKING API change / removed export / dead code, but no consumer actually exists. PROVE this: read ${wt}/${SKILLS_DIR}/external-consumers/SKILL.md and run its gh searches across org:forcedotcom and org:salesforcecli for the exact removed symbol AND its public-export form (e.g. workspaceContextUtils.<name>). Discount false positives (unrelated same-named symbols, the ci-testing mirror repo, the export site itself, plan/doc files). Zero real consumers → the "breaking" premise is disproven → dropped (note "removed unused export, no consumers" for the PR body instead).
  Inability to prove the finding VALUABLE is never a drop reason. If you cannot disprove it, it is kept.
- **downgraded** — ONLY when you can affirmatively PROVE the real impact is lower than the claimed severity (e.g. claim says "critical: data loss" but you prove the path is behind an off-by-default flag → high; claim says "high" but you prove it's a theoretical edge that cannot occur given the surrounding code → low). Set 'severity' to the proven level. "No user-facing impact I can see" / "seems minor" / "it's just style" is NOT proof of lower impact — that keeps the claimed severity. Do not use downgrade as a soft drop.
- **confirmed** — the premise is verified true and you could not disprove it. This is the DEFAULT outcome for any finding you can't drop or downgrade, INCLUDING true-but-unprovable-value style/architecture findings (reuse an existing service, prefer an Effect idiom, fewer short-term consts) and trivially-correct cleanups (delete a no-op line, fix a misleading comment). Keep 'severity' EQUAL to the claimed severity — do not lower it just because you can't independently confirm the payoff.

Summary: drop ⇔ you DISPROVED it (false / CI-covered / zero-consumer). downgrade ⇔ you PROVED lower impact. Everything else ⇒ confirmed at claimed severity. When in doubt, KEEP.

Return ONLY the structured result. 'severity' = claimed severity for confirmed; the proven-lower level for downgraded; the verified level for dropped (unused). 'evidence' = the file:line / workflow / gh-search summary that grounds the verdict — for 'confirmed', state what you checked and why you could not disprove it.`

const fixerPrompt = verifiedFindings =>
  `Apply review findings to the code in ${wt}.

Each finding was already adversarially verified — premise confirmed, severity corrected, false/redundant/no-consumer findings already removed. 'verifiedSeverity' is authoritative; 'rationale'/'evidence' explain why it survived.

Verified findings (JSON):
${JSON.stringify(verifiedFindings, null, 2)}

Rules:
- Auto-apply ALL critical and high severity findings.
- Auto-apply ALL medium / low findings too — these survived adversarial verification, so the premise is already confirmed. Default to APPLYING, not surfacing. This explicitly includes trivial mechanical edits: deleting a no-op/dead config line, fixing or removing a misleading/stale comment, renaming for clarity. "Low value" is NOT a reason to skip — if the edit is unambiguous and self-contained, just make it.
- Surface to 'remaining' ONLY when applying would be genuinely risky or ambiguous: the fix requires a design decision, spans many files, changes public behavior, or you cannot determine the correct change with confidence. State which of these applies in the note.
- A finding may carry a 'prBodyNote' (e.g. "removed unused export, no consumers") instead of a code change — pass those straight into 'remaining' so they land in the PR body, no edit needed.

Group commits logically: e.g. one commit "fix: critical/high review findings", one "refactor: medium/low review findings". If nothing to fix, return {fixedCount: 0, remaining: [...]}.

Return ONLY the structured result.`

// =====================================================================
// ORCHESTRATION
// =====================================================================

phase('Discover skills')
const skillNames = await agent(listSkillsPrompt, {
  schema: SKILL_LIST_SCHEMA,
  label: 'list-skills',
  phase: 'Discover skills',
  model: 'haiku',
})
const skillList = ((skillNames && skillNames.skills) || []).map(s => s.trim()).filter(Boolean)

phase('Review')
const diffInfo = await agent(diffPrompt, {
  schema: DIFF_RAW_SCHEMA,
  label: `diff-${label}`,
  phase: 'Review',
  model: 'haiku',
})

const lineCount = parseShortstatLines((diffInfo && diffInfo.shortstat) || '')
const skillsToCheck =
  lineCount < SMALL_DIFF_LINES
    ? skillList.filter(s => ALWAYS_APPLICABLE_SKILLS.includes(s))
    : skillList.filter(s => !REVIEW_SKILL_DENYLIST.includes(s))

log(`diff: ${lineCount} lines; checking ${skillsToCheck.length} skills`)

const skillFindings = await parallel(
  skillsToCheck.map(skill => () =>
    agent(skillDetectPrompt(skill), {
      schema: SKILL_DETECT_SCHEMA,
      label: `skill-${skill}`,
      phase: 'Review',
      model: 'sonnet',
    })
  )
)

const thermo = await agent(thermoPrompt, {
  schema: THERMO_SCHEMA,
  label: `thermo-${label}`,
  phase: 'Review',
  model: 'opus',
})

const effectDiffReview = await agent(effectDiffReviewPrompt, {
  schema: EFFECT_ADVOCATE_SCHEMA,
  label: `effect-diff-${label}`,
  phase: 'Review',
  agentType: 'effect-advocate',
})

// Verify every finding before fixing: each gets an adversarial verifier whose
// job is to DISPROVE the finding (reads cited code; gh-searches consumers for
// breaking/dead-code claims; checks CI coverage for "run X before merge" claims).
// It returns confirmed / downgraded / dropped, with the burden of proof on
// dropping/downgrading: drop only on disproof (false / CI-covered / zero-consumer),
// downgrade only on proven-lower impact, else keep at claimed severity. Kills false
// positives without discarding true-but-unprovable-value style/architecture findings.
phase('Verify findings')

const rawFindings = normalizeFindings(skillFindings, skillsToCheck, thermo, effectDiffReview)
log(`verifying ${rawFindings.length} raw finding(s)`)

const verdicts = await parallel(
  rawFindings.map((finding, i) => () =>
    agent(verifyFindingPrompt(finding), {
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

if (!apply) {
  log('apply=false — returning verified findings without fixing')
  return { verifiedFindings, droppedCount, fixerResult: null }
}

phase('Fix review findings')
const fixerResult = await agent(fixerPrompt(verifiedFindings), {
  schema: FIXER_SCHEMA,
  label: `fix-${label}`,
  phase: 'Fix review findings',
  model: 'opus',
})

// A null fixer (subagent died) shouldn't sink the caller — the build is already
// committed. Degrade to no remaining notes so the PR still drafts.
return { verifiedFindings, droppedCount, fixerResult: fixerResult || { remaining: [] } }
