# auto-build workflows

Workflow scripts for [Workflow tool](https://docs.claude.com/) orchestration. Each `.js` file is a self-contained, multi-agent pipeline that fans out subagents per phase and returns a structured result.

## auto-build-wi.js

Drains GUS work items tagged `[ai-auto]` end-to-end: claim → plan → build → review → draft PR. **Stateless across ticks** — each run starts fresh, queries current GUS/GitHub state, and acts. Pair with `/loop` to run on a schedule (e.g. `/loop 10m /auto-build-wi`).

### Arguments

- `args.maxInFlight` — cap on concurrent in-flight WIs (default `5`). When at cap, the tick monitors only and skips claiming a new one.

### Identity resolution

Reads `sf alias list` for the `gus` alias, queries the User record by username, then cross-references the runner against the **Team members** table in [.claude/skills/gus-cli/SKILL.md](../skills/gus-cli/SKILL.md) to derive:
- `userId` — GUS User Id
- `ownerPrefix` — initials (e.g. `sm`) used for branches/worktrees
- `slackId` — for DMs and review pings
- `githubLogin` — for reviewer assignment

If any of these can't be resolved, the tick exits early with `identity-failed`.

### Tick flow

```
                          ┌─────────────────────┐
                          │  Resolve identity   │
                          └──────────┬──────────┘
                                     ▼
                          ┌─────────────────────┐
                          │  Monitor in-flight  │  query GUS for In Progress [ai-auto]
                          │  (per WI: PR check) │  + gh pr view + statusCheckRollup
                          └──────────┬──────────┘
                                     │
            ┌────────────┬───────────┼───────────┬────────────┐
            ▼            ▼           ▼           ▼            ▼
        green/      running/     no-pr/       failed +      failed +
       finalize       wait      restart     gha retries   exhausted
            │            │           │      remaining        │
            │            │           │           │           ▼
            │            │           │           │      ┌─────────┐
            │            │           │           │      │ Triage  │ flake | e2e | code-bug
            │            │           │           │      └────┬────┘
            │            │           │           │           ▼
            │            │           │           │      ┌─────────┐
            │            │           │           │      │ Fix CI  │ DM | e2e fix | code fix
            │            │           │           │      └─────────┘
            ▼            │           ▼           ▼
            │            │      (re-enter      (let
            │            │       builder)     gha-rerun
            │            │                    work)
            └──────┬─────┘
                   ▼
        ┌────────────────────┐
        │ Keep in-flight     │  fetch + merge origin/develop into each
        │ current            │  in-flight worktree; push if non-empty
        └────────┬───────────┘
                 ▼
        ┌────────────────────┐
        │  Finalize ready    │
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
        │       Plan         │  write .claude/plans/W-XXX.md → review →
        │ (3-pass review:    │  effect-advocate review → revise → commit
        │  concise / effect) │  blocked? → bounce to Waiting + DM
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
        │ Fix review findings│  auto-apply critical/high (incl. effect
        │ + merge develop    │  must/should); merge origin/develop
        └────────┬───────────┘
                 ▼
        ┌────────────────────┐
        │      Draft PR      │  push + gh pr create --draft;
        │                    │  append "PR: <url>" to WI Details__c
        └────────────────────┘
```

### Phase notes

**Monitor in-flight.** For each in-flight WI, parses `PR: <url>` out of `Details__c`. Pipeline stage 1 reads PR state; stage 2 decides finalize/wait/restart/triage. PRs with no recorded URL are treated as crashed builders (rare). Failed PRs check the `gha-rerun` daemon's retry budget (3 attempts via GitHub `run_attempt`) and only triage once exhausted — otherwise the daemon handles it.

**Triage failures → Fix CI failures.** Triage classifies one of `flake-or-infra` / `e2e-test-issue` / `code-bug` / `unknown`. Each route runs in parallel: flakes/unknowns DM the runner; e2e issues spawn a fixer using the `analyze-e2e` command and `playwright-e2e` skill; code bugs re-enter a builder agent with the failure context and the original plan.

**Finalize ready.** Idempotent: gates each mutation behind a state check. Flips PR out of draft, sets WI to Ready for Review, reassigns reviewers per [.claude/skills/pr-draft/SKILL.md](../skills/pr-draft/SKILL.md), posts to `#ide-exp-code-review` (channel `C054SJJAB24`) tagging the runner, and removes the worktree.

**Pick candidate.** Single-candidate path skips the picker. Multi-candidate path collects the union of changed files across in-flight PRs (via `gh pr diff --name-only`), then asks the picker to honor explicit dependencies (`blocked by W-XXX`), defer file-overlap, prefer smaller story points, tie-break on oldest `CreatedDate`.

**Plan.** Writes `.claude/plans/<W-XXX>.md` per the [concise skill](../skills/concise/SKILL.md). Three independent review passes:
1. Style review (concise, commit messages, verification section, skills include `typescript`)
2. Effect-advocate plan review — Effect-TS smells in the *approach* (hand-rolled retry/timeout/cache, untyped errors, services that already exist)
3. Revisions if `must` findings surface

If the plan determines the WI is unimplementable (can't name files or definition of done), it returns `{verdict: 'blocked'}` and the workflow bounces the WI to `Waiting` with questions DM'd to the runner.

**Build.** One commit per plan phase. Repo hooks (compile/lint/dead-code/LSP/effect) run on tool calls and drive correctness — the agent does not run its own retry loop. `npm install` re-runs if `package-lock.json` changes.

**Review.** Three parallel reads:
- Per-skill detection: for diffs `< 20` lines, only the always-applicable skills (`typescript`, `concise`, `paths`) run. Larger diffs check every skill.
- Thermonuclear code-quality review (file:line evidence required)
- Effect-advocate diff review

**Fix review findings.** Auto-applies all critical and high (including every effect-advocate `must`/`should`). Cheap mediums applied; the rest surface in PR `Reviewer notes`. Then merges `origin/develop` — uses [merge-conflicts skill](../skills/merge-conflicts/SKILL.md) best-effort; aborts and returns to caller if unresolvable.

**Draft PR.** Pushes the branch, opens a draft PR per [pr-draft skill](../skills/pr-draft/SKILL.md), appends `PR: <url>` back to `Details__c`, ensures the `gha-rerun` daemon is running. Test plan excludes items covered by new/modified e2e files on the branch.

### Worktrees

Each WI gets an isolated git worktree at `../vscode-auto-wt/<ownerPrefix>-<wiName>-<slug>` on branch `<ownerPrefix>/<wiName>-<slug>`. The build, review, and fix phases all run inside that worktree (via `isolation: 'worktree'` on the agent calls). Worktrees are removed on finalize; they're left in place when build/plan bounces a WI to `Waiting` so a human can take over.

### Exit codes (return shape)

| `exited`                  | Meaning                                                |
|---------------------------|--------------------------------------------------------|
| `identity-failed`         | Couldn't resolve runner identity                       |
| `at-cap`                  | In-flight count >= `MAX_IN_FLIGHT`; only monitored     |
| `idle`                    | No candidates; nothing to do                           |
| `claim-failed`            | Worktree creation or status update failed              |
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
| `SKILLS_DIR`               | `.claude/skills`                     | Where skills live                          |
| `REVIEW_CHANNEL_ID`        | `C054SJJAB24`                        | `#ide-exp-code-review` Slack channel       |
| `PROJECT_ROOT`             | `…/vscode-auto`                      | Worktree parent dir is `../vscode-auto-wt` |

### Related

- [/auto-build-wi command](../skills/auto-build-wi/) — user-facing entry that invokes this workflow
- [/loop command](https://docs.claude.com/) — schedules recurring runs
- [gha-rerun daemon](../skills/gha-rerun/SKILL.md) — handles transient CI failures before triage kicks in
- [gus-cli skill](../skills/gus-cli/SKILL.md) — Team members table is the source of truth for runner identity
