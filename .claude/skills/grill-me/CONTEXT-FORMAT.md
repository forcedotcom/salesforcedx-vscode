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

- [Ordering](./src/ordering/CONTEXT.md) — receives/tracks customer orders
- [Billing](./src/billing/CONTEXT.md) — invoices, payments
- [Fulfillment](./src/fulfillment/CONTEXT.md) — picking, shipping

## Relationships

- **Ordering → Fulfillment**: `OrderPlaced` events trigger picking
- **Fulfillment → Billing**: `ShipmentDispatched` events trigger invoicing
- **Ordering ↔ Billing**: shared `CustomerId`, `Money` types
```

Inference:

- `CONTEXT-MAP.md` exists → read it for contexts
- Only root `CONTEXT.md` → single context
- Neither → create root `CONTEXT.md` lazily on first term

Multi-context → infer which one applies. Unclear → ask.
