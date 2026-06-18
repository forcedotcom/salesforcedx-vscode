---
name: work-item-sequencing
description: Numbering convention for ordering GUS work items within an epic. Numeric prefixes in Subject__c express sequencing (do X before Y) and parallelism. Use when planning an epic, when the user states a dependency between work items, or when asked what's unblocked/ready in an epic.
---

# Work Item Sequencing

A numbering convention for expressing **order and parallelism** among work items inside a single epic. Numbers live as a prefix in `Subject__c` (space-delimited). Scope is per-epic; cross-epic dependencies are explained in the WI body prose, not encoded in numbers.

This is a companion to [gus-cli](../gus-cli/SKILL.md), which owns the CLI mechanics (querying, creating, updating, statuses, IDs).

## The convention

Prefix the `Subject__c` with a dotted number and a single space:

```
1 Set up the runtime service
2 Migrate the parser to the runtime
1.1 Add config schema
1.2 Add config loader
```

- **Sequential** — `1`, `2`, `3`: do in order. `2` does not start until `1` is done. `3` does not start until `2` is done.
- **Parallel** — `1.1`, `1.2`, `1.3`: siblings sharing a parent prefix can all be worked at once, no waiting on each other.
- **Gating between groups** — the next number at a level waits for **all** work under the prior numbers at that level. `2` does not start until `1` *and* every `1.x` (and `1.x.y`, …) are done.
- **Arbitrary depth** — `1.1.1`, `1.1.2` nest the same way. One recursive rule (below) covers every level.

### The one rule

> A work item is **ready** when every work item that sorts before it at a shallower-or-equal ancestor level is done. Equivalently: siblings run in parallel; a sibling-group gates the next number at its parent level.

Walk it: `1.2` is ready once `1.1` and all of `1.1`'s descendants are done. `2` is ready once everything under `1` (`1`, `1.1`, `1.1.1`, `1.2`, …) is done.

### "Done"

Done = `Status__c` is **`Closed`** or **`Completed`**.

`Fixed` is **not** done — Fixed usually means the PR is not merged yet. Do not treat Fixed, Ready for Review, QA In Progress, or any non-terminal status as satisfying a prerequisite.

(See [gus-cli ## Status\_\_c values](../gus-cli/SKILL.md#status__c-values).)

## When to use numbers

Numbers are **optional**.

- **Use them** during epic-level planning, or whenever the user expresses a dependency between work items.
- **Skip them** for standalone work. An epic that has accumulated independent work items over time does not need renumbering.

### Unnumbered work items

A work item with no numeric prefix has **no dependencies and nothing depends on it**. It is always ready. It never gates a numbered item and is never gated by one. Do not infer order from creation date, position, or anything else — absence of a number means independent.

## Assigning numbers (during planning)

When planning an epic with the user:

1. Lay out the work items.
2. For any that must precede others, assign sequential top-level numbers (`1`, `2`, …).
3. For work that can proceed in parallel under a step, give them the same parent with distinct child suffixes (`1.1`, `1.2`).
4. Leave genuinely independent items unnumbered.
5. Prefix each `Subject__c` with its number + a space. Create via [gus-cli](../gus-cli/SKILL.md#work-items-adm_work__c).

Keep numbers dense and starting at 1 within a group where practical, but gaps are harmless — sorting is by dotted-numeric value.

## Reading a plan ("what's ready / what's unblocked in this epic?")

1. Query the epic's open work items (see [gus-cli "What's unfinished in this epic"](../gus-cli/SKILL.md#compound-workflows)). Also include `Status__c` so done-ness can be computed. To know whether a prerequisite is done, query the epic's WIs **without** the open-only filter (a Closed prerequisite is excluded by the open-only query).
2. Parse the leading dotted number from each `Subject__c`. No leading number → unnumbered (independent).
3. Compute readiness with the one rule:
   - Unnumbered → **ready**.
   - Numbered → ready iff every WI that sorts before it at a shallower-or-equal ancestor level is done (`Closed`/`Completed`).
4. Report three groups:
   - **Ready now** — unblocked numbered items + all unnumbered items.
   - **Blocked** — numbered items whose prerequisites are not all done; name the blocking number(s).
   - **Done** — `Closed`/`Completed` (optional, for context).

### Sorting

Sort by dotted-numeric segments, comparing each segment as an integer (`1.2` before `1.10`), not lexically. Unnumbered items sort last (or list them separately).

## Edge cases

- **Malformed prefix** (e.g. `1.` , `1..2`, `1.x`): treat as unnumbered and **flag it** to the user — likely a typo that meant to express a dependency.
- **Duplicate numbers** (two WIs both `1.2`): allowed — they're parallel siblings, same as any sibling pair. No need to flag.
- **Orphan child** (`1.1` exists but no `1`): the rule still works — `1.1` is gated only by anything sorting before it. Don't require a parent WI to exist.
- **Number in `Subject__c` that isn't a sequence** (e.g. `W-12345 backport` or a version like `2.40 release`): only treat a leading `N` or `N.N…` followed by a space as a sequence number. When ambiguous, ask.
