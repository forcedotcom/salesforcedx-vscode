# auto-build workflows

Workflow scripts for [Workflow tool](https://docs.claude.com/) orchestration. Each `.js` file is a self-contained, multi-agent pipeline that fans out subagents per phase and returns a structured result.

## Note

This code is a mess.  Claude requires this live in 1 file (no imports, no TS, no effect)

## Setup

Required before running anything in this directory:

1. **Claude Code ≥ 2.1.154.** `claude --version` to check; upgrade with `claude update` (or your package manager). Older versions don't support inline workflow scripts.
2. **Enable dynamic workflows.** Just ask Claude: _"enable dynamic workflows"_. Claude will set `"enableWorkflows": true` in [.claude/settings.json](../settings.json) (and your `~/.claude/settings.json` if you want it on globally). Without this flag, the `Workflow` tool is unavailable and `/auto-build-wi` fails immediately.
3. **gus alias + identity.** `sf alias list` must show a `gus` alias pointing to the org you query work items in (`sf org login web -a gus` if missing). Your username must be listed under **Team members** in [.claude/skills/gus-cli/SKILL.md](../skills/gus-cli/SKILL.md) (with `Github_Username__c`, slack id, owner prefix). The first run caches identity to `$HOME/.claude/runner-identity.json`.
4. **Slack MCP.** `mcp__slack__slack_send_message` must be reachable (DMs and `#ide-exp-code-review` posts). Run `/salesforce-trust-foundations:mcp-auth` if MCP calls 401.

## review-plan.js / review-diff.js — standalone review entry points

Plan-review + code-review sub-graphs extracted to own workflows: human-runnable on demand against any branch/plan, not just inside an `auto-build-wi` tick. `auto-build-wi` calls them via `workflow()` — pipeline single-sourced (prompts/schemas in the child). Scripts can't `import`, so each child copies the few shared constants/schemas.

### `/review-plan` — multi-pass plan review

```text
/review-plan .claude/plans/W-123.md
```

Concise-style check + revise → effect-advocate + e2e-advocate + plan-adversary fan-out (parallel) → fold blocking findings (effect `must`, e2e `must`, adversary `critical`/`high`) into 1 revise pass → optional commit.

| Arg | Default | Purpose |
| --- | --- | --- |
| `planPath` (or bare string) | _required_ | Plan file, relative to `wt` |
| `wt` | `.` | Worktree/dir holding the plan |
| `subject` / `details` | `''` | WI context for e2e/adversary reviewers |
| `commitMessage` | _unset_ | Set → commit plan file w/ this subject |

### `/review-diff` — thermonuclear code review

```text
/review-diff                 # current branch vs origin/develop, applies fixes
/review-diff ../some-worktree
```

Applicable-skill fan-out (diff-sized: `<20` lines → `typescript`/`concise`/`paths` only; larger → all skills minus operational denylist) + thermo + effect diff review → adversarial per-finding verify (`confirmed`/`downgraded`/`dropped`) → fixer. Returns `{verifiedFindings, droppedCount, fixerResult}`.

| Arg | Default | Purpose |
| --- | --- | --- |
| `wt` (or bare string) | `.` | Worktree/dir to review |
| `base` | `origin/develop` | Diff base ref |
| `apply` | `true` | `false` → return findings, skip fixer |

## auto-build-wi.js

Drains GUS work items tagged `[ai-auto]` end-to-end: claim → plan → build → review → draft PR. **Stateless across ticks** — each run starts fresh, queries current GUS/GitHub state, and acts. Pair with `/loop` to run on a schedule (e.g. `/loop 10m /auto-build-wi`). The Plan and Review phases delegate to [`review-plan`](#review-planjs--review-diffjs--standalone-review-entry-points) / `review-diff`.

### Arguments

- `args.maxInFlight` — cap on concurrent in-flight WIs (default `5`). When at cap, the tick monitors only and skips claiming a new one.

### Identity resolution

Reads `sf alias list` for the `gus` alias, queries the User record by username, then cross-references the runner against the **Team members** table in [.claude/skills/gus-cli/SKILL.md](../skills/gus-cli/SKILL.md) to derive:

- `userId` — GUS User Id
- `ownerPrefix` — initials (e.g. `sm`) used for branches/worktrees
- `slackId` — for DMs and review pings
- `githubLogin` — for reviewer assignment

Cached at `$HOME/.claude/runner-identity.json` after first resolve. If any of these can't be resolved, the tick exits early with `identity-failed`.

### Tick flow

```text
                          ┌─────────────────────┐
                          │  Resolve identity   │
                          └──────────┬──────────┘
                                     ▼
                          ┌─────────────────────┐
                          │   Ensure daemons    │  start gha-rerun if not running
                          └──────────┬──────────┘
                                     ▼
                          ┌─────────────────────┐
                          │ Reap stranded       │  rm worktrees/branches whose PRs
                          │ worktrees           │  already merged/closed (haiku)
                          └──────────┬──────────┘
                                     ▼
                          ┌─────────────────────┐
                          │  Monitor in-flight  │  query GUS for In Progress [ai-auto]
                          │  (per WI: PR check) │  + gh pr view + statusCheckRollup
                          └──────────┬──────────┘
                                     │
       ┌──────────┬───────┬──────────┼───────────┬────────────┐
       ▼          ▼       ▼          ▼           ▼            ▼
   merged/     green/  running/    no-pr/      failed +     failed +
   closed     finalize   wait     restart    gha retries   exhausted
       │          │       │          │       remaining        │
       ▼          │       │          │           │            ▼
  ┌─────────┐     │       │          │           │       ┌─────────┐
  │ Close   │     │       │          │           │       │ Triage  │ flake | e2e | code-bug
  │ merged  │     │       │          │           │       └────┬────┘
  │ WIs     │     │       │          │           │            ▼
  └─────────┘     │       │          │           │       ┌─────────┐
   set WI         │       │          │           │       │ Fix CI  │ DM | e2e fix | code fix
   Closed,        │       │          │           │       └─────────┘
   rm worktree    ▼       │          ▼           ▼
                  │       │     (re-enter      (let
                  │       │      builder)     gha-rerun
                  │       │                   work)
                  └───┬───┘
                      ▼
        ┌────────────────────┐
        │ Keep in-flight     │  conflicting PRs only: merge origin/develop
        │ current            │  into each worktree sequentially; push
        └────────┬───────────┘
                 ▼
        ┌────────────────────┐
        │  Open for review   │  green PRs: undraft, set 'Ready for Review',
        │                    │  reassign reviewers, post Slack, rm worktree
        └────────┬───────────┘
                 ▼
        ┌────────────────────┐
        │   Peer approve     │  approve OTHER runners' PRs that owner
        │                    │  rubber-stamped with /ai-auto approve
        └────────┬───────────┘
                 ▼
        ┌────────────────────┐
        │ at cap?            │── yes ──▶ exit
        └────────┬───────────┘
                 │ no
                 ▼
        ┌────────────────────┐
        │  Pick candidate    │  query New/Ready [ai-auto]; rank by deps,
        └────────┬───────────┘  file-overlap with in-flight, story points
                 ▼
        ┌────────────────────┐
        │ Claim + worktree   │  Status='In Progress' + git worktree add
        └────────┬───────────┘
                 ▼
        ┌────────────────────┐
        │       Plan         │  write .claude/plans/W-XXX.md → style review
        │ (4-pass review:    │  → effect / e2e / adversary in parallel →
        │  style + 3 parallel│  revise → commit
        │  advocates)        │  blocked? → bounce to Waiting + DM
        └────────┬───────────┘
                 ▼
        ┌────────────────────┐
        │       Build        │  one commit per plan phase; hooks drive
        │  (in worktree)     │  correctness; stuck → bounce + DM
        └────────┬───────────┘
                 ▼
        ┌────────────────────┐
        │       Review       │  fan out: per-skill detect + thermo +
        │  (parallel)        │  effect-advocate diff review
        └────────┬───────────┘
                 ▼
        ┌────────────────────┐
        │  Verify findings   │  adversarial check per finding (parallel):
        │  (parallel)        │  premise + CI-coverage + consumer gh-search
        └────────┬───────────┘  → confirmed | downgraded | dropped
                 ▼
        ┌────────────────────┐
        │ Fix review findings│  consume verified findings; auto-apply
        │ + merge develop    │  critical/high; merge origin/develop
        └────────┬───────────┘
                 ▼
        ┌────────────────────┐
        │      Draft PR      │  push + gh pr create --draft;
        │                    │  append "PR: <url>" to WI Details__c
        └────────────────────┘
```

### Peer approval — `/ai-auto approve`

Owners can rubber-stamp their own AI-generated PR by leaving a PR comment whose first line matches:

```text
/ai-auto approve
```

(Comment body, line-anchored — anything below the line is a free-form note.) On the next tick, ANOTHER runner's `auto-build-wi` will:

1. Pick up the comment if `Status__c='Ready for Review'` and `Subject__c LIKE '%[ai-auto]%'`.
2. Verify the comment was authored by the PR owner and posted at-or-after the current head SHA's commit timestamp (re-pushes invalidate prior approvals).
3. Submit a GitHub approval as the approving runner: _"Peer-approved on behalf of @owner per /ai-auto approve"_.
4. Advance the WI to `Status__c='Fixed'`.

The owner gets GitHub's native approval notification — no Slack DM (it would look like a self-DM since the runner sent it). Idempotent: re-running the tick after approval is a no-op.

**Setup for peer approval:** every runner whose PRs you want auto-approved AND every runner you want approving on your behalf must be listed in the **Team members** table of [.claude/skills/gus-cli/SKILL.md](../skills/gus-cli/SKILL.md) with their `Github_Username__c` populated.

### Phase notes

**Resolve identity.** First step every tick. Reads cache; falls back to gus-cli skill resolution if cache miss/mismatch.

**Ensure daemons.** Launches the [gha-rerun daemon](../skills/gha-rerun/SKILL.md) if it's not already running. The daemon owns CI rerun budget — without it, transient CI failures escalate to triage immediately.

**Reap stranded worktrees.** Runs before monitoring (single haiku agent). Lists `git worktree list`, and for any worktree on an `<ownerPrefix>/W-` branch whose PR is already `MERGED`/`CLOSED` (e.g. user merged manually, so the WI dropped out of the in-flight query), removes the worktree and deletes the local branch. Skips the main worktree, workflow-isolation worktrees under `.claude/worktrees/`, and branches with no PR (still building). Never errors — partial progress is fine.

**Monitor in-flight.** For each in-flight WI, parses `PR: <url>` out of `Details__c`. Pipeline stage 1 reads PR state; stage 2 decides close/finalize/wait/restart/triage. PRs with no recorded URL are treated as crashed builders (rare). Failed PRs check the `gha-rerun` daemon's retry budget (3 attempts via GitHub `run_attempt`) and only triage once exhausted — otherwise the daemon handles it.

**Close merged WIs.** For WIs whose PR came back `merged` or `closed`, runs one haiku agent each (parallel, idempotent): sets `Status__c='Closed'`, removes the worktree, deletes the local branch.

**Triage failures → Fix CI failures.** Triage classifies one of `flake-or-infra` / `e2e-test-issue` / `code-bug` / `unknown`. Each route runs in parallel: flakes/unknowns DM the runner; e2e issues spawn a fixer using the `analyze-e2e` command and `playwright-e2e` skill; code bugs re-enter a builder agent with the failure context and the original plan.

**Keep in-flight current.** Only for PRs whose `mergeable === 'CONFLICTING'` — not every behind-develop PR. `git fetch origin develop` and merge into the worktree. Conflicts use [merge-conflicts skill](../skills/merge-conflicts/SKILL.md) best-effort; unresolvable conflicts DM the runner. Push if any merge happened. Runs **sequentially** across worktrees — merges can trigger compile/lint/test, and doing many at once crashes the machine.

**Open for review.** Green PRs only. Idempotent: gates each mutation behind a state check. Flips PR out of draft, sets WI to Ready for Review, reassigns reviewers per [.claude/skills/pr-draft/SKILL.md](../skills/pr-draft/SKILL.md), posts to `#ide-exp-code-review` (channel `C054SJJAB24`) tagging the runner, and removes the worktree.

**Peer approve.** Queries `Status__c='Ready for Review'` ai-auto WIs assigned to OTHER runners. For each, looks for the `/ai-auto approve` magic string from the owner (see above), then approves and advances to `Fixed`.

**Pick candidate.** Single-candidate path skips the picker. Multi-candidate path collects the union of changed files across in-flight PRs (via `gh pr diff --name-only`), then asks the picker to honor explicit dependencies (`blocked by W-XXX`), defer file-overlap, prefer smaller story points, tie-break on oldest `CreatedDate`. Excludes any candidate whose `Details__c` already contains a PR URL (would clobber an existing PR).

**Plan.** Writes `.claude/plans/<W-XXX>.md` per the [concise skill](../skills/concise/SKILL.md). Review passes:

1. **Style review** (sequential) — concise, commit messages, verification section, skills include `typescript`
2. **Effect-advocate plan review** (parallel) — Effect-TS smells in the _approach_ (hand-rolled retry/timeout/cache, untyped errors, services that already exist)
3. **e2e-advocate plan review** (parallel) — adequacy of e2e test coverage in the plan
4. **plan-adversary review** (parallel) — highest-likelihood ways the plan is wrong, mis-scoped, or will silently fail

Style revisions apply first; advocate revisions (effect `must`, e2e `must`, adversary `critical`/`high`) apply after in a single revise pass. Then commit.

If the plan determines the WI is unimplementable (can't name files or definition of done), it returns `{verdict: 'blocked'}` and the workflow bounces the WI to `Waiting` with questions DM'd to the runner.

**Build.** One commit per plan phase. Repo hooks (compile/lint/dead-code/LSP/effect) run on tool calls and drive correctness — the agent does not run its own retry loop. `npm install` re-runs if `package-lock.json` changes.

**Review.** Three parallel reads:

- Per-skill detection: for diffs `< 20` lines, only the always-applicable skills (`typescript`, `concise`, `paths`) run. Larger diffs check every skill except those in `REVIEW_SKILL_DENYLIST` (operational/setup skills not relevant to diff review).
- Thermonuclear code-quality review (file:line evidence required)
- Effect-advocate diff review

**Verify findings.** All review findings (skill + thermo + effect-advocate) are normalized to a uniform shape, then each is **adversarially verified** by its own agent in parallel (sonnet, worktree-isolated), defaulting to skepticism — analogous to the global `/c` "cite or retract" rule. A finding survives only if its premise is demonstrably true _and_ acting on it adds value beyond CI/automation. Drop rules:

- **False premise** — cited code doesn't do what the finding claims.
- **CI-redundant** — only asks to _run_ a check CI already gates (Playwright e2e with retries, the stop-hook compile/lint/knip/effect-LS/unit chain). The agent inspects `.github/workflows/` to confirm coverage.
- **No consumers** — a breaking-API / removed-export / dead-code claim must _prove_ affected consumers exist via [external-consumers skill](../skills/external-consumers/SKILL.md) gh searches across `org:forcedotcom` + `org:salesforcecli` (discounting same-named symbols, the ci-testing mirror, the export site, docs). Zero real consumers → dropped with a `prBodyNote` ("removed unused export, no consumers") instead.

Verdicts: `confirmed` (kept at claimed severity) / `downgraded` (premise holds, lower real severity) / `dropped`. Dropped findings are removed; survivors carry an authoritative `verifiedSeverity` into the fixer.

**Fix review findings.** Consumes the _pre-verified_ findings (premise confirmed, severity corrected, false/redundant/no-consumer ones already gone). Auto-applies all critical and high (including every effect-advocate `must`/`should`). Cheap mediums applied; the rest — plus any `prBodyNote` passthroughs — surface in PR `Reviewer notes`. Then merges `origin/develop` — uses [merge-conflicts skill](../skills/merge-conflicts/SKILL.md) best-effort; aborts and returns to caller if unresolvable.

**Draft PR.** Pushes the branch, opens a draft PR per [pr-draft skill](../skills/pr-draft/SKILL.md), appends `PR: <url>` back to `Details__c` (read-modify-write — never replaces existing content), ensures the `gha-rerun` daemon is running. Test plan excludes items covered by new/modified e2e files on the branch.

### Worktrees

Each WI gets an isolated git worktree at `../vscode-auto-wt/<ownerPrefix>-<wiName>-<slug>` on branch `<ownerPrefix>/<wiName>-<slug>`. The build, review, and fix phases all run inside that worktree (via `isolation: 'worktree'` on the agent calls). Worktrees are removed on Open for review; they're left in place when build/plan bounces a WI to `Waiting` so a human can take over.

### Exit codes (return shape)

| `exited`                  | Meaning                                                |
|---------------------------|--------------------------------------------------------|
| `identity-failed`         | Couldn't resolve runner identity                       |
| `at-cap`                  | In-flight count >= `MAX_IN_FLIGHT`; only monitored     |
| `idle`                    | No candidates; nothing to do                           |
| `claim-failed`            | Worktree creation or status update failed              |
| `restart-failed`          | Reattaching worktree for a no-PR WI failed             |
| `plan-blocked`            | Plan agent determined WI not implementable             |
| `build-stuck`             | Build agent gave up; worktree preserved for handoff    |
| `claimed-and-pr-opened`   | Successful tick: new draft PR exists                   |

### Constants

Edit at the top of the script:

| Constant                   | Default                              | Purpose                                    |
|----------------------------|--------------------------------------|--------------------------------------------|
| `MAX_IN_FLIGHT`            | `args.maxInFlight ?? 5`              | Concurrent WI cap                          |
| `SMALL_DIFF_LINES`         | `20`                                 | Below this, only always-applicable skills  |
| `ALWAYS_APPLICABLE_SKILLS` | `['typescript','concise','paths']`   | Skills checked even on tiny diffs          |
| `REVIEW_SKILL_DENYLIST`    | (operational skills)                 | Skills excluded from diff review           |
| `SKILLS_DIR`               | `.claude/skills`                     | Where skills live                          |
| `REVIEW_CHANNEL_ID`        | `C054SJJAB24`                        | `#ide-exp-code-review` Slack channel       |
| `PROJECT_ROOT`             | `…/vscode-auto`                      | Worktree parent dir is `../vscode-auto-wt` |

### Related

- [/auto-build-wi command](../skills/auto-build-wi/) — user-facing entry that invokes this workflow
- [/loop command](https://docs.claude.com/) — schedules recurring runs
- [gha-rerun daemon](../skills/gha-rerun/SKILL.md) — handles transient CI failures before triage kicks in
- [gus-cli skill](../skills/gus-cli/SKILL.md) — Team members table is the source of truth for runner identity
