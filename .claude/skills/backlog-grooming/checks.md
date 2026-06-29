# Grooming checks

Each: trigger → proposed action. All proposals; user confirms in step 6.

## Cheap checks (step 3 — metadata only)

### Readiness (under-specified + ai-auto candidate)

One axis. A WI is **ready** iff an AI workflow could execute it as written: clear goal/done-definition, verification (test/behavior), where-to-change (files/area), context (ADR/CONTEXT/link), actionable scope. Char count is not the test — substance is.

**Read the right body field.** Bug-type WIs store the body in `Details_and_Steps_to_Reproduce__c`, not `Details__c`. `SELECT` both; judge on whichever is populated. Null `Details__c` alone ≠ under-specified — check the bug field first.

- Fails bar → **propose grill** ([grill-me](../grill-me/SKILL.md)). Triage lists them; user picks which to grill. Don't grill inline.
- Passes bar + small + independent → **propose `[ai-auto]` tag** (Subject\_\_c only; see [gus-cli ## ai-auto tag](../gus-cli/SKILL.md#ai-auto-tag)). **Disqualifiers** (ready but NOT ai-auto): WI modifies the auto-build harness itself (`auto-build-wi.js`/workflow internals), needs design/coordination, or the WI text says build-by-hand. When in doubt, don't propose the tag.

### Wrong epic

`Description__c` not SOQL-filterable → match client-side. Propose move **only on obvious mismatch**: WI clearly fits another epic AND weakly fits current. Cite the target epic's matching words. Borderline → stay silent.

### Orphan

WI with no `Epic__c`. **Propose an epic** (existing best-fit, or grill to define one). High-volume (100s) — report count + sample, propose **top-N-newest per run** or keyword→epic batch, not a full per-item list.

### Unpointed

`Story_Points__c = null`. High-volume (often >half the backlog). **Report count**, offer bulk set-to-2 on confirm — not a per-item walk.

### Empty epic

Open epic with **zero** WIs. **Flag "needs WIs or grilling"** — do NOT propose close (empty = placeholder, not done). Exclude separator epics (`===== below the line =====` dividers) — not real epics.

### Epic ownerless

Open epic missing `Development_Lead__c` (`reference` → User). **Propose tagging a dev lead** — pick from [gus-cli ## Team members](../gus-cli/SKILL.md#team-members-assigneec-qa_engineerc), or ask the user. Other lead fields exist (`Product_Owner__c`, `Quality_Lead__c`, …) — ignore them; only `Development_Lead__c`. If most epics lack one (common), report as a count + process-gap note, not a per-epic list.

### Epic complete

Open epic, ≥1 WI, **all** terminal (terminal incl. `Duplicate`/`Rejected`/bug-no-fix — those count as complete). **Propose close epic** (`Health__c='Completed'`). Note the status mix + `Scheduled_Build__c` if future — still propose (shipped early).

### Merged-not-Completed

WI in `Fixed`/`Ready for Review` whose `Details__c` PR link is **merged**. **Propose bump to Completed.** (Link-only here; deeper proof is step 4.)

### Open-vs-open duplicate

Two live WIs, same intent. **Propose one as `Duplicate`** of the other + `Related_Work__c` (see [gus-cli ## Status](../gus-cli/SKILL.md#status__c-values)).

### Dead link

`Details__c` PR/issue ref that 404s, OR an empty `href=""` (SF strips external links on save — see [gus-cli](../gus-cli/SKILL.md#work-items-adm_work__c)). **Flag** for cleanup.

### Sequencing health

Per [work-item-sequencing](../work-item-sequencing/SKILL.md): malformed prefixes (`1.`, `1..2`), orphan children, permanently-blocked chains. **Flag.**

## Done-but-open (step 4 — gated, subagent)

Open WI whose work already shipped. **Two tiers** — both user-confirmed; tier = how hard to look:

**Candidate filter** (step 4.1): include a WI if it names existing shippable behavior — a PR/issue link, a greppable feature/file, or shipped siblings. A WI proposing a **to-be-built** deliverable (new skill/role/agent that doesn't exist yet) is NOT a done-but-open candidate — drop it (it's a readiness/grill case, not a closure case). Log every drop.


- **Close tier** (strong): an e2e/integration test proves the behavior, OR a merged PR names the WI. High confidence.
- **Verify tier** (weak): code looks present, no test/PR proof. Surface for a closer look — never silent-close.

Code-presence alone is Verify, not Close — a function existing ≠ the WI's behavior satisfied.

### Subagent prompt shape

One `caveman:cavecrew-investigator` (or `Explore`) per filtered candidate. Give it the WI Name, Subject\_\_c, Details\_\_c, any links. Ask it to:

1. Locate where the behavior would live (grep/blame the cited or likely area).
2. If found, `git blame` → introducing commit → `gh pr view` for the PR → scan PR title/body for a `W-xxxxx`.
3. Return strict JSON: `{tier: "close"|"verify"|"none", citation: "file:line | test name | none", causingPR: "url|none", relatedWI: "W-xxxxx|none"}`.

### Closure action from verdict

Tier and `relatedWI` are orthogonal: **tier decides the proposal strength** (Close vs Surface), **`relatedWI` decides the form** (Duplicate vs plain Close). Apply in that order:

1. `tier: none` → drop, no proposal.
2. `tier: verify` → **Surface for closer look, never auto-close** — even if a `relatedWI` is present. Note the relatedWI as the *likely* dup target so the user can confirm. (e.g. PR named the WI but a later PR reverted part → verify, not close.)
3. `tier: close` + `relatedWI` found → **propose `Duplicate`** + `Related_Work__c` = that WI ([gus-cli](../gus-cli/SKILL.md#status__c-values): status `Duplicate`, not `Closed - Duplicate`).
4. `tier: close`, no owning WI → **propose plain `Closed`/`Completed`** with the code/test citation.
