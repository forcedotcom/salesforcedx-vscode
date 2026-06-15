# CONTEXT.md Format

## Structure

```md
# {Context Name}

{1-2 sentences: what, why.}

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

- Opinionated. Synonyms → pick one, others under `_Avoid_`.
- Tight: 1-2 sentences. What it IS, not what it does.
- Project-specific terms only. General programming concepts (timeouts, error types, utility patterns) don't belong. Test: unique to this context, or general?
- Group under subheadings when clusters emerge. Single cluster → flat fine.
- use /concise skill

## Single vs multi-context

Single → one root `CONTEXT.md`. Multi → root `CONTEXT-MAP.md` lists contexts + relationships:

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

Contexts go wherever coherent vocabulary lives — packages, plus `.claude/`, `.github/`. Narrowest scope owning the term.

Inference:

- `CONTEXT-MAP.md` exists → read it
- Only root `CONTEXT.md` → single context
- Neither → create root `CONTEXT.md` lazily on first term

Multi-context, unclear → ask.
