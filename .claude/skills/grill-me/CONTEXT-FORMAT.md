# CONTEXT.md Format

## Structure

```md
# {Context Name}

{1-2 sentences: what this context is, why it exists.}

## Language

**Order**:
{1-2 sentence definition}
_Avoid_: Purchase, transaction

**Invoice**:
Request for payment sent after delivery.
_Avoid_: Bill, payment request

**Customer**:
Person/org that places orders.
_Avoid_: Client, buyer, account
```

## Rules

- **Be opinionated.** Multiple words for same concept → pick one, list rest under `_Avoid_`.
- **Tight definitions.** 1-2 sentences max. Define what it IS, not what it does.
- **Project-specific terms only.** General programming concepts (timeouts, error types, utility patterns) don't belong even if used heavily. Test: unique to this context, or general programming?
- **Group under subheadings** when natural clusters emerge. Single cluster → flat list fine.

## Single vs multi-context repos

- Single context: one root `CONTEXT.md`.
- Multi-context: root `CONTEXT-MAP.md` lists contexts + relationships:

```md
# Context Map

## Contexts

- [Ordering](./packages/ordering/CONTEXT.md) — receives/tracks customer orders
- [Billing](./packages/billing/CONTEXT.md) — invoices, payments
- [AI tooling](./.claude/CONTEXT.md) — skills, workflows, commands
- [CI](./.github/CONTEXT.md) — GitHub Actions

## Relationships

- **Ordering → Fulfillment**: `OrderPlaced` events trigger picking
- **AI tooling → Ordering**: `auto-build-wi.js` opens PRs against ordering
```

Contexts can live anywhere a coherent vocabulary does — per package, plus
non-source dirs like `.claude/` and `.github/`. Pick narrowest scope that
owns the term.

Inference:

- `CONTEXT-MAP.md` exists → read it for contexts
- Only root `CONTEXT.md` → single context
- Neither → create root `CONTEXT.md` lazily on first term

Multi-context → infer which one applies. Unclear → ask.
