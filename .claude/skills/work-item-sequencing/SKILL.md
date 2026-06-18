---
name: work-item-sequencing
description: Numbering convention for ordering GUS work items within an epic. Numeric prefixes in Subject__c express sequencing (do X before Y) and parallelism. Use when planning an epic, when the user states a dependency between work items, or when asked what's unblocked/ready in an epic.
---

# Work Item Sequencing

Numbering convention for **order + parallelism** among work items in one epic. Number = prefix in `Subject__c`, space-delimited. Per-epic scope; cross-epic deps go in WI body prose, not numbers.

Companion to [gus-cli](../gus-cli/SKILL.md) (CLI mechanics: query, create, update, statuses, IDs).

## Convention

Prefix `Subject__c` with a dotted number + single space:

```
1 Set up the runtime service
2 Migrate the parser to the runtime
1.1 Add config schema
1.2 Add config loader
```

- **Sequential** (`1`, `2`, `3`): in order. `2` waits on `1`; `3` waits on `2`.
- **Parallel** (`1.1`, `1.2`): same-parent siblings, no waiting on each other.
- **Group gating**: next number at a level waits for **all** work under prior numbers. `2` waits on `1` + every `1.x`/`1.x.y`.
- **Arbitrary depth** (`1.1.1`, …): same recursive rule.

### The rule

> WI ready when every WI sorting before it (at shallower-or-equal ancestor level) is done. Siblings parallel; sibling-group gates next number at parent level.

`1.2` ready once `1.1` + descendants done. `2` ready once everything under `1` done.

### Done

Done = `Status__c` is **`Closed`** or **`Completed`**.

**`Fixed` is not done** — usually means PR not merged yet. Non-terminal statuses (Fixed, Ready for Review, QA In Progress) never satisfy a prerequisite. See [gus-cli ## Status\_\_c values](../gus-cli/SKILL.md#status__c-values).

## When to number

Optional.

- **Use**: epic-level planning, or when user states a dependency.
- **Skip**: standalone work; don't renumber an epic of accumulated independent items.

**Unnumbered = no deps, nothing depends on it.** Always ready; never gates, never gated. Don't infer order from date/position — no number means independent.

## Assigning (planning)

1. Lay out work items.
2. Must-precede → sequential top-level (`1`, `2`).
3. Parallel under a step → same parent, distinct suffix (`1.1`, `1.2`).
4. Independent → leave unnumbered.
5. Prefix `Subject__c` with number + space. Create via [gus-cli](../gus-cli/SKILL.md#work-items-adm_work__c).

Dense from 1 per group preferred; gaps harmless (sort is by value).

## Reading ("what's ready/unblocked in this epic?")

1. Query epic WIs incl `Status__c`. Query **without** open-only filter — done prerequisites are Closed, which open-only excludes (see [gus-cli "What's unfinished in this epic"](../gus-cli/SKILL.md#compound-workflows)).
2. Parse leading dotted number from each `Subject__c`. None → unnumbered.
3. Readiness: unnumbered → ready; numbered → ready iff all prior-sorting ancestors done.
4. Report 3 groups: **Ready now** (unblocked numbered + all unnumbered), **Blocked** (name blocking number), **Done** (optional).

Sort by integer segments (`1.2` before `1.10`, not lexical). Unnumbered sort last.

## Edge cases

- **Malformed** (`1.`, `1..2`, `1.x`): treat unnumbered + **flag** — likely typo'd dependency.
- **Duplicate** (two `1.2`): allowed = parallel siblings. Don't flag.
- **Orphan child** (`1.1`, no `1`): rule still holds; don't require parent to exist.
- **Non-sequence number** (`W-12345 backport`, version `2.40 release`): only leading `N`/`N.N…` + space counts. Ambiguous → ask.
