# ADR Format

Live in `docs/adr/`. Sequential: `0001-slug.md`, `0002-slug.md`. Create dir lazily on first ADR.

## Template

```md
# {Short title}

{1-3 sentences: context, decision, why.}
```

Single paragraph fine. Value = recording *that* a decision was made and *why* — not filling sections.

## Optional sections (only when earned)

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — when revisited
- **Considered Options** — rejected alternatives matter
- **Consequences** — downstream effects non-obvious

## Numbering

Highest existing in `docs/adr/` + 1.

## When to offer

All three must hold:

1. Hard to reverse — meaningful cost to change later
2. Surprising without context — reader wonders "why this way?"
3. Real trade-off — genuine alternatives existed

Easy to reverse → skip. Not surprising → nobody wonders. No alternative → nothing to record.

### Qualifies

- Architectural shape. "Monorepo." "Event-sourced write, Postgres read."
- Cross-context integration. "Ordering ↔ Billing via domain events, not sync HTTP."
- Tech with lock-in. DB, message bus, auth, deployment target. Not every library — quarter-to-swap ones.
- Boundaries/scope. "Customer data owned by Customer context; others reference by ID." Explicit nos as valuable as yeses.
- Deliberate deviations. "Manual SQL, not ORM, because X." Stops next engineer "fixing" deliberate code.
- Constraints invisible in code. "No AWS — compliance." "<200ms — partner SLA."
- Non-obvious rejected alternatives. Considered GraphQL, picked REST for subtle reasons → record, else re-suggested in 6 months.
