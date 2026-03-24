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
- **IDs vs Names**: `Id` (e.g. `a07...`) is for CLI commands. `Name` (e.g. `W-12345`) is for PR titles and human display. NEVER use `Id` in PR titles or descriptions. Always query `Name` after creation.

## Prerequisites

1. Run `sf alias list --json`; parse `result` for alias matching `gus` (case-insensitive)
2. If missing: instruct user `sf org login web -a gus`
3. All commands use `-o gus`

## User ID

- From step 1: gus entry `value` = username
- `sf data query --query "SELECT Id FROM User WHERE Username = '<username>' LIMIT 1" -o gus --result-format json`
- User Id = `result.records[0].Id`
- **Reuse from earlier in conversation** if already looked up this session; don't re-query

## Constants

| Constant                | Value                |
| ----------------------- | -------------------- |
| Team ID                 | `a00B0000000w9xPIAQ` |
| Product Tag             | `a1aB000000005G3IAI` |
| User Story RecordTypeId | `0129000000006gDAAQ` |
| Bug RecordTypeId        | `012T00000004MUHIA2` |

Objects: `ADM_Work__c`, `ADM_Epic__c` (not ADM_Theme\_\_c).

## Team members (Assignee**c, QA_Engineer**c)

**Default when unassigned:** Platform Dev Tools Scrum Team `005B0000000GIODIA4` – use when work isn't assigned to a person yet.

| Name               | Id                   |
| ------------------ | -------------------- |
| Cristina Cañizales | `005EE000008cgrGYAQ` |
| Daphne Yang        | `005EE000005d0jdYAA` |
| Jonny Hork         | `005B0000004pYWjIAM` |
| Kyle Walker        | `005EE0000010oCLYAY` |
| Madhur Shrivastava | `005EE00000VZK5FYAX` |
| Peter Hale         | `005B0000000GFvWIAW` |
| Shane McLaughlin   | `005B00000024wGBIAY` |
| Sonal Budhiraja    | `005B0000005ccPnIAI` |

## Work items (ADM_Work\_\_c)

**Base select:** `SELECT Id, Name, Subject__c, Status__c, Story_Points__c, Epic__c, RecordType.Name FROM ADM_Work__c`

**Query patterns** (combine as needed; use LIMIT on broad queries):

| Filter      | WHERE clause                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mine        | `Assignee__c = '<userId>'`                                                                                                                                                                       |
| By status   | `Status__c = 'In Progress'` (or other)                                                                                                                                                           |
| By epic     | `Epic__c = '<epicId>'`                                                                                                                                                                           |
| Unpointed   | `Story_Points__c = null`                                                                                                                                                                         |
| Team's open | `Scrum_Team__c = 'a00B0000000w9xPIAQ' AND Status__c NOT IN ('Closed', 'Completed', 'Closed - Duplicate', 'Closed - Resolved With Internal Tools', 'Closed - No Fix - Working as Designed', ...)` |
| Epic + open | `Epic__c = '<epicId>' AND Status__c NOT IN ('Closed', 'Completed', ...)`                                                                                                                         |

Closed statuses: see ## Status\_\_c values. Use `LIMIT 50` (or 100) when querying team or epic work.

**Create:** Always set `Story_Points__c=2`, `Product_Tag__c=a1aB000000005G3IAI`, `RecordTypeId`. Include `Subject__c`, `Assignee__c`, `Scrum_Team__c=a00B0000000w9xPIAQ`, `Epic__c` (optional), `QA_Engineer__c` (optional), `Details__c` (optional). Leave `Sprint__c` blank; never modify it. **Details\_\_c:** write concisely—fragments/bullets, minimal words, no repetition (see .claude/skills/concise/SKILL.md).

**Details\_\_c formatting (readable WI body):** Details__c is a Rich Text Area (extraTypeInfo: richtextarea)—use HTML, not markdown. The `-v` flag parses space-separated key=value; use `--flags-dir` with a `values` file ([ref](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_flag_values_in_files.htm)):

1. `mkdir -p /tmp/gus-flags`
2. Create `values` with one line: `Details__c='<p><strong>Section</strong></p><p>Content. <code>inline code</code></p><ul><li>item</li></ul><p><strong>Ref:</strong> <a href="https://...">url</a></p>'`
3. `sf data update record -s ADM_Work__c -i <id> -o gus --flags-dir /tmp/gus-flags`

Constraints: File must be single-line (flags-dir treats each line as a separate flag invocation). Value in single quotes. Use HTML: `<p>`, `<strong>`, `<code>`, `<ul><li>`, `<a href="...">`. Avoid unescaped `"` inside value—use `&quot;` or rephrase.

**After create:** Always provide the work item link. Format: `https://gus.lightning.force.com/lightning/r/ADM_Work__c/<recordId>/view` (replace `<recordId>` with the Id from the create output, e.g. `a07EE00002V3a8YYAR`). Example: [a07EE00002V3a8YYAR](https://gus.lightning.force.com/lightning/r/ADM_Work__c/a07EE00002V3a8YYAR/view).

**CRITICAL:** After creation, you MUST query the `Name` (W-XXXXX) to use in PR titles. The `id` returned by `sf data create` is NOT the `W-XXXXX` name.
```bash
sf data query --query "SELECT Name FROM ADM_Work__c WHERE Id = '<id_from_create>'" -o gus --json
```

**Update:** If User Story has null `Story_Points__c`, set `Story_Points__c=2`. Never modify `Sprint__c`. `Details__c` can store PR links, notes.

```
sf data update record -s ADM_Work__c -i <recordId> -o gus -v "Status__c='In Progress' Subject__c='...' Details__c='...'"
```

## Epics (ADM_Epic\_\_c)

**Query team epics** (exclude closed):

```
sf data query --query "SELECT Id, Name, Description__c FROM ADM_Epic__c WHERE Team__c = 'a00B0000000w9xPIAQ' AND Health__c NOT IN ('Completed', 'Canceled')" -o gus --result-format json
```

Closed = `Health__c` in ('Completed', 'Canceled'). Use `Description__c` when populated to match work to epic.

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

## Compound workflows

**Create a bug from this PR**

1. Get PR context: title, body/description, URL (from git/GitHub if available)
2. Resolve User Id (reuse from conversation if known)
3. Pick epic: IDEx - Trust (`a3QEE0000023FPZ2A2`) for bugs unless PR/context indicates otherwise
4. Subject\_\_c: concise from PR title
5. Details\_\_c: PR link + key bullets; see .claude/skills/concise/SKILL.md
6. RecordTypeId: `012T00000004MUHIA2` (Bug)
7. Show draft, ask "Create this work item?" — run `sf data create record` only after yes
8. After create: provide WI link (see **After create** above)

**What's unfinished in this epic**

1. Get epic Id from user or context (branch name, prior query)
2. Query: `Epic__c = '<epicId>' AND Status__c NOT IN (...)` — use all values from ## Status\_\_c values "Closed (terminal)" and "Bug no-fix"
3. Add `LIMIT 100`; order by Status\_\_c or Name
4. Present as table: Name, Subject**c, Status**c, Assignee (or run separate query for assignee names)

## Status\_\_c values

When creating/updating, only use New,In Progress,Ready for Review,QA In Progress,Fixed,Waiting,Closed
When completing a work item, use `Closed`.

**Flow:** New → Acknowledged → Triaged → In Progress → Ready for Review → Fixed → QA In Progress → Completed/Closed

**Blocked:** Investigating | More Info Reqd from Support | Waiting On Customer | Waiting On 3rd Party | Waiting | Deferred | Integrate | Pending Release

**Closed (terminal):** Closed | Completed | Closed - Defunct | Closed - Duplicate | Closed - Eng Internal | Closed - Known Bug Exists | Closed - New Bug Logged | Closed - Resolved With Internal Tools | Closed - Resolved Without Code Change | Closed - Doc/Usability | Closed - Resolved with DB Script | Closed - No Fix - Working as Documented | Closed - No Fix - Working as Designed | Closed - No Fix - Feature Request | Closed - No Fix - Will Not Fix | Closed - Transitioned to Incident | Closed - Resolved by 3rd Party

**Bug no-fix:** Duplicate | Inactive | Never | Not a bug | Not Reproducible | Rejected | Eng Internal

## CLI tips

- `--result-format json` for parseable output
- Strip CLI version warning before JSON parse (`tail -1` or parse last object)
- `sf data create record` / `sf data update record` for single-record writes
