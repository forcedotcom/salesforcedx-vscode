---
name: gus-cli
description: Interact with the Gus Salesforce org via CLI (sf). Query, create, update work items; query team epics. Use when user mentions Gus, work items, epics, or GUS/Git2Gus workflows.
---

# Gus CLI

Interact with Gus (Salesforce Agile Accelerator org) via sf CLI. Requires alias `gus` in `sf alias list`.

## Safety

- **Queries** (sf data query, sf alias list): run without asking
- **Writes** (create, update): **do not execute until user explicitly confirms**
  - Present the draft (subject, epic, details, assignee). Ask: "Create this work item?" or "Update work item X?"
  - **Draft format:** Use bullet list, not markdown table (tables can render blank in some viewers). Put Details\_\_c in a code block so HTML content is visible.
  - Only run `sf data create record` / `sf data update record` after user says yes (or equivalent)
  - Answering scope questions (e.g. "just createProject") is not confirmation—still ask
- **Epic selection**: when less than 50% sure which epic a work item belongs in, ask the user
- **IDs vs Names**: `Id` (e.g. `a07...`) is for CLI commands. `Name` (e.g. `W-12345`) is for human display and PR titles appended as ` - W-12345` at the end per [pr-draft Title format](../pr-draft/SKILL.md#title-format). NEVER use `Id` in PR titles or descriptions. Always query `Name` after creation.

## Prerequisites

1. Run `sf alias list --json`; parse `result` for alias matching `gus` (case-insensitive)
2. If missing: instruct user `sf org login web -a gus`
3. All commands use `-o gus`

## Runner identity

Cache: `$HOME/.claude/runner-identity.json` — `{userId, username, ownerPrefix, slackId, githubLogin}`.

1. `sf alias list --json` → entry `/^gus$/i`. Missing → `sf org login web -a gus`. Value = `currentUsername`.
2. Cache hit (file exists, all 5 fields, `cached.username === currentUsername`) → use it.
3. Miss → resolve:
   - `sf data query --query "SELECT Id FROM User WHERE Username = '<currentUsername>' LIMIT 1" -o gus --result-format json` → `userId`
   - Match `currentUsername` to ## Team members row → `githubLogin`, `slackId`. `ownerPrefix` = initials lowercase (`Shane McLaughlin` → `sm`; one-word → first 2 chars).
   - Not in table → caller's error.
   - `mkdir -p $HOME/.claude && write JSON`.

Invalidate: alias change auto-detects. Manual: `rm $HOME/.claude/runner-identity.json`.

Same session: reuse conversation value; don't re-read.

## Constants

| Constant                | Value                |
| ----------------------- | -------------------- |
| Team ID                 | `a00B0000000w9xPIAQ` |
| Product Tag             | `a1aB000000005G3IAI` |
| User Story RecordTypeId | `0129000000006gDAAQ` |

**Always use User Story RecordTypeId.** Never create Bug records. If user describes a bug/repro, still create it as a User Story.

Objects: `ADM_Work__c`, `ADM_Epic__c` (not ADM_Theme\_\_c).

## Team members (Assignee**c, QA_Engineer**c)

**Default when unassigned:** Platform Dev Tools Scrum Team `005B0000000GIODIA4` – use when work isn't assigned to a person yet.

| Name               | Id                   | GitHub login      | Slack ID      |
| ------------------ | -------------------- | ----------------- | ------------- |
| Daphne Yang        | `005EE000005d0jdYAA` | `daphne-sfdc`     | `U03CKVATVCY` |
| Jonny Hork         | `005B0000004pYWjIAM` | `jonnyhork`       | `WFGT1L8HF`   |
| Kyle Walker        | `005EE0000010oCLYAY` | `kylewalke`       | `U02GCUGEAUU` |
| Madhur Shrivastava | `005EE00000VZK5FYAX` | `madhur310`       | `U0852LWKWSW` |
| Peter Hale         | `005B0000000GFvWIAW` | `peternhale`      | `WAR9BDB8T`   |
| Shane McLaughlin   | `005B00000024wGBIAY` | `mshanemc`        | `WB4TF6RFY`   |

## Work items (ADM_Work\_\_c)

**Base select:** `SELECT Id, Name, Subject__c, Status__c, Story_Points__c, Epic__c, RecordType.Name FROM ADM_Work__c`

**Optional display/detail fields** (append to SELECT only for single-WI/triage queries; do NOT add to bulk team/epic queries unless asked—keeps base lean, avoids widening every result set/terminal table):

- `Priority__c` — picklist `P0`-`P4`.
- `Epic_Name__c` — formula/string; epic name w/o `Epic__r` join. Bulk lists use existing `Epic__c` id or a separate epic-name lookup (formula evaluated per-row otherwise).
- `Due_Date__c` (datetime) + `Out_of_SLA__c` (boolean) — SLA tracking.
- Security trio: `Security__c` (label "Locked by Security", boolean), `Security_Vulnerability_Category__c` (picklist, 30+ values), `Security_Source__c` (label "Source", picklist, 30+ values—run `sf sobject describe` for full lists).

**Query patterns** (combine as needed; use LIMIT on broad queries):

| Filter      | WHERE clause                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mine        | `Assignee__c = '<userId>'`                                                                                                                                                                       |
| By status   | `Status__c = 'In Progress'` (or other)                                                                                                                                                           |
| By epic     | `Epic__c = '<epicId>'`                                                                                                                                                                           |
| Unpointed   | `Story_Points__c = null`                                                                                                                                                                         |
| Team's open | `Scrum_Team__c = 'a00B0000000w9xPIAQ' AND Status__c IN (<open list>)`                                                                                                                            |
| Epic + open | `Epic__c = '<epicId>' AND Status__c IN (<open list>)`                                                                                                                                            |

**Open/unfinished filters use the WHITELIST `Status__c IN (<open list>)`, never `NOT IN (<terminal>)`** — the open list + why a blacklist leaks legacy terminals (incl. the Bug-no-fix set) live in [statuses.md](./statuses.md). Use `LIMIT 50` (or 100) when querying team or epic work.

### Body fields (`Details__c` vs `Details_and_Steps_to_Reproduce__c`)

The validated User Story body is `Details__c`. Three rules, one place:

- **≥20 chars required.** `Details__c` (field label "Description") has a User Story validation rule: <20 chars → create fails with `Description must be at least 20 characters to submit a User Story`. Despite docs marking it optional, treat as required on create.
- **Don't confuse with `Description__c`** — a DIFFERENT field (label "Comment", unvalidated). The validated body is `Details__c`.
- **Bug records store the body in `Details_and_Steps_to_Reproduce__c`** (richtextarea), not `Details__c`. Querying only `Details__c` misses Bug/PVR content, and a null `Details__c` on a Bug record ≠ under-specified. Single-WI fetch of unknown/mixed record type → `SELECT` both, use whichever is populated.

**Sequencing prefix:** When planning an epic or when the user states a dependency, prefix `Subject__c` with a sequence number + space (e.g. `1.2 Add config loader`). See [work-item-sequencing](../work-item-sequencing/SKILL.md). Optional — skip for independent work.

### Create & update → [writes.md](./writes.md)

`sf data create/update record` has real traps — `-v`/`--flags-dir` incompatibility, space-splitting that truncates multi-word values, HTML-only `Details__c`, href-stripping, and silent wrong-Id overwrites. The create-then-update recipe, formatting, and verify-Id steps live in **[writes.md](./writes.md)**. Read it before any write.

## Epics (ADM_Epic\_\_c)

**Creating an epic or bulk-creating its work items → [epics.md](./epics.md)** (fields, `Scheduled_Build__c`, the `Details__c` ≥20-char + CLI-warning-breaks-JSON gotchas, bulk-create loop).

**Query team epics** (exclude closed):

```
sf data query --query "SELECT Id, Name, Description__c FROM ADM_Epic__c WHERE Team__c = 'a00B0000000w9xPIAQ' AND Health__c NOT IN ('Completed', 'Canceled')" -o gus --result-format json
```

Closed = `Health__c` in ('Completed', 'Canceled'). Use `Description__c` when populated to match work to epic.

**`Description__c` is not filterable in SOQL** — `WHERE`/`LIKE` on it errors `field 'Description__c' can not be filtered in a query call`. To match an epic by text, fetch all open epics and match on `Name`, or post-filter `Description__c` client-side (e.g. with jq). Only `SELECT` it.

## Epic guide: which work items go where

Use to pick the right Epic\_\_c when creating work. Query epics first; match by Name/Description. Key epics:

**IDEx - Mandates and Updates** `a3QEE0000023Fm92AE`

- Compliance, VSCode extensions major release, library/dependency upgrades (sfdx-core, Apex LS, etc.)
- Security/compliance work; keeping extensions on latest core features

**IDEx - Trust** `a3QEE0000023FPZ2A2`

- Customer investigations, bugs, trust backlog

**effect services improvements** `a3QEE0000026sJ72AI`

- Shared Effect library; common effect things that aren't runtime services

**TDX 262 epics** (Code Builder Web, CBLite, Org Browser on Web, LWC on web, Apex Testing Extension, etc.)

- Web IDE compatibility; running extensions in browser

**Backlog epics** (IDE Exp - Core, Extensions, LWC & Aura, etc.)

- Feature-area backlogs; use Name to match

When unsure which epic: ask the user.

## `[ai-auto]` tag

`[ai-auto]` in `Subject__c` or `Details__c` opts a WI into the [auto-build-wi workflow](../../workflows/auto-build-wi.js) (claim → plan → build → review → draft PR). See [workflows/README.md](../../workflows/README.md).

- Add only on explicit user request; only `Subject__c` (title), never `Details__c`
- Skip for WIs needing design/coordination
- Query: `Subject__c LIKE '%[ai-auto]%'`

## Compound workflows

Non-obvious defaults only — assemble the mechanical steps from the sections above.

**Create a WI from this PR** — Subject from PR title, Details = PR link + concise bullets, RecordTypeId always User Story (`0129000000006gDAAQ`, even for bug-like issues). Epic default: **IDEx - Trust** (`a3QEE0000023FPZ2A2`) for bug-like issues unless context says otherwise. Then create + provide link per [writes.md](./writes.md).

**What's unfinished in this epic** — query `Epic__c = '<epicId>' AND Status__c IN (<open list>)` (whitelist per [statuses.md](./statuses.md)), `LIMIT 100`, present as a table. If any `Subject__c` carries a sequence-number prefix (`1`, `1.2`, …), compute ready/blocked per [work-item-sequencing](../work-item-sequencing/SKILL.md) instead of a flat list — "what's ready / unblocked in this epic?" routes there.

## Status\_\_c values

Full picklist, flow, and terminal lists → **[statuses.md](./statuses.md)**.

For create/update use only: `New, In Progress, Ready for Review, QA In Progress, Fixed, Waiting, Closed`. Complete a WI → `Closed`. Mark a duplicate → `Status__c='Duplicate'` + `Related_Work__c` (NOT `Closed - Duplicate`, which a trigger reverts).

### Open queries: WHITELIST, never blacklist

"Open/unfinished" queries MUST use `Status__c IN (<open list>)`, **not** `NOT IN (<terminal>)` — a blacklist leaks legacy terminals (`Closed-U/Ftest`, `Tested`, the Bug-no-fix set) absent from the current picklist. The open list lives in [statuses.md](./statuses.md#open-queries-whitelist-never-blacklist).

## CLI tips

- `--json` for parseable output (not `--result-format json`)
- Parse with `jq`, not python
- `sf data create record` / `sf data update record` for single-record writes
- **Aggregate (`COUNT`/`GROUP BY`) can't paginate** — no `queryMore`, hard cap 200 rows. Errors `Aggregate query does not support queryMore()` past that. Always add `LIMIT`, and scope (e.g. `Epic__c IN (...)`) so the group set stays ≤200. Plain (non-aggregate) `SELECT` also returns one 200-row batch per call via the CLI — for full sets, filter narrower or page, don't assume one query returns everything.
- **Salesforce Ids come in 15-char (case-sensitive) and 18-char (case-insensitive) forms — same record.** A lookup field (`Epic__c`) and the parent's `Id` may differ in length across queries. Match on the first 15 chars (`id[0:15]`), never raw string equality.
- **Field aliasing is aggregate-only.** `SELECT Name n FROM ...` on a plain query errors `only aggregate expressions use field aliasing`. Alias only `COUNT()`/`GROUP BY` selects; for plain selects use the full path (`Development_Lead__r.Name`) and read it by that key in jq.
