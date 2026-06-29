---
name: backlog-grooming
description: Triage the team's open GUS backlog — propose closing done-but-open work items (with code/test citations), flag under-specified items for grilling, catch wrong-epic / orphan / unpointed / dead-link items, and close completed epics. User-invoked.
disable-model-invocation: true
---

# Backlog grooming

Triage pass over open GUS work items + epics. **Every finding is a proposal — never auto-write.** Output: one report file, then confirm-and-execute.

CLI mechanics (queries, statuses, IDs, create/update, Duplicate handling, aggregate-query limits, 15-vs-18-char Ids) live in [gus-cli](../gus-cli/SKILL.md) — this skill never restates them.

**Scale is real: ~900+ open WIs across ~45 epics.** Two tiers:

- **Team-wide aggregates** (counts, GROUP BY) — run once, cover everything. Cheap.
- **Per-WI checks** (readiness, done-but-open, wrong-epic, dup, dead-link, sequencing) — too many for one whole-team pass. **Scope to one epic per run**, or a user-chosen subset.

## Steps

### 1. Preflight + scope

- Resolve `gus` alias + runner identity per [gus-cli](../gus-cli/SKILL.md#runner-identity).
- Ask the scope: **(a)** team-wide aggregates only (epics + bulk counts — fast), or **(b)** also deep-groom one epic (per-WI checks). Default (a); offer the epic list if (b).

**Done when:** alias resolves, scope chosen.

### 2. Team-wide pass (always — runs under both scope a and b)

Aggregates over the whole team — one query each, no per-WI memory. Mind the [gus-cli ## CLI tips](../gus-cli/SKILL.md#cli-tips) aggregate-paginate cap (200 rows, needs `LIMIT`) + 15-vs-18-char Id rule.

- **Open WI count + orphan + unpointed**: scope by `Scrum_Team__c = <team>` (the authoritative "team backlog" set; see [gus-cli ## Work items](../gus-cli/SKILL.md#work-items-adm_work__c) "Team's open"). Use the **whitelist** `Status__c IN (<open list>)` from [gus-cli ## Open queries](../gus-cli/SKILL.md#open-queries-whitelist-never-blacklist) — NOT a `NOT IN` exclusion (legacy statuses like `Closed-U/Ftest`/`Tested` leak through a blacklist). orphan = `+ Epic__c=null`, unpointed = `+ Story_Points__c=null`. For bulk-point cleanup, also filter `RecordType.Name IN ('User Story','Bug')`.
- **Open epics** + `Description__c`, `Development_Lead__c`, `Scheduled_Build__c`. **Drop separator epics** (names like `===== below the line =====`) — board dividers, not real.
- **Per-epic counts**: `GROUP BY Epic__c` for open-WIs (whitelist `Status__c IN (<open list>)`, same as above) and for total-WIs (any status), each scoped `Epic__c IN (<the open-epic Ids>) LIMIT 200`. Join GROUP-BY keys to the epic list **on first 15 chars** (truncate both sides). Note: GROUP BY only returns epics that HAVE WIs — derive **empty-epic** by *set difference* (open-epic list MINUS total-WI keys), not from the query rows. Then **epic-complete** = in total-keys, not in open-keys; **epic-ownerless** = `Development_Lead__c` null. See [checks.md](./checks.md).

(Scope by `Scrum_Team__c` and by epic-membership can diverge — an orphan WI belongs to the team but no epic; per-epic sums won't equal the team total. Both are intended: team count for headline, epic-IN for per-epic.)

**Done when:** every team-wide check in [checks.md](./checks.md) has a count or list. High-volume counts (orphans, unpointed, ownerless) reported as a number + sample, not a per-item list.

### 3. Per-epic deep pass (scope b only)

For the chosen epic, pull its open WIs (whitelist `Status__c IN (<open list>)`; `SELECT` Id, Name, Subject\_\_c, Status\_\_c, Story_Points\_\_c, RecordType.Name, Details\_\_c, **Details_and_Steps_to_Reproduce\_\_c** (Bug-type body — see [checks.md](./checks.md) Readiness), Assignee\_\_c). Run the per-WI checks in [checks.md](./checks.md): readiness (grill / ai-auto), wrong-epic, open-vs-open dup, dead-link, merged-not-Completed, sequencing-health. Then the gated done-but-open investigation (step 4).

**Done when:** every open WI in the epic evaluated by every per-WI check; each emits a list (possibly empty) of {WI, evidence, proposed action}.

### 4. Gated code investigation (done-but-open, scope b)

1. **Filter** the epic's open WIs to plausible done-but-open candidates — has a PR/issue link, names a greppable feature/file, or has shipped siblings. Skip pure-design / coordination WIs.
2. **Log the drop count**: "investigating N of M; skipped M−N (reason)." Never silently truncate.
3. **Fan out** one investigator subagent per candidate (`caveman:cavecrew-investigator` or `Explore`). Note: WIs may reference PRs in **other repos** (e.g. `forcedotcom/apex-language-support`) — the investigator follows those via `gh`. Each: blame the cited/likely area → introducing commit → PR → owning WI name. Returns `{tier, citation, causingPR, relatedWI}`. See [checks.md](./checks.md#done-but-open) for tier bar + subagent prompt.

**Done when:** every filtered candidate has a verdict; drop count logged.

### 5. Write the report

Write `.claude/backlog-grooming-<YYYY-MM-DD>.md` (gitignored). Section per check; each finding = WI/Epic Name + [link](https://gus.lightning.force.com/lightning/r/ADM_Work__c/<id>/view) + evidence/citation + proposed action + tier (done-but-open only). Order high-confidence → low. Top summary: counts per check, scope, investigation drop count.

**Done when:** file written, every finding present with its citation, chat shows the summary table.

### 6. Confirm and execute

(Dry-run mode: if the user asked for read-only / validation, stop here — list what *would* be proposed, perform no writes.)

Walk findings with the user. Per [gus-cli ## Safety](../gus-cli/SKILL.md#safety): present each write, act only on explicit yes. High-volume buckets (orphans, unpointed) → offer **bulk action or top-N**, not one-by-one. Execute approved writes (Close/Duplicate+`Related_Work__c`, epic close, `[ai-auto]` tag, epic move, dev-lead tag, point=2). Grill candidates not executed here — user later runs [grill-me](../grill-me/SKILL.md) on ones they pick.

**Done when:** every approved write succeeded (verify per [gus-cli](../gus-cli/SKILL.md)), report annotated with actioned vs deferred.
