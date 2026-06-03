# ADR Format

ADRs live in `docs/adr/`. Sequential numbering: `0001-slug.md`, `0002-slug.md`.

Create `docs/adr/` lazily — only when first ADR needed.

## Template

```md
# {Short title}

{1-3 sentences: context, decision, why.}
```

A single paragraph is fine. Value = recording *that* a decision was made and *why*, not filling sections.

## Optional sections

Add only when they earn it:

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — when revisited
- **Considered Options** — when rejected alternatives matter
- **Consequences** — when downstream effects are non-obvious

## Numbering

Highest existing number in `docs/adr/` + 1.

## When to offer an ADR

All three must hold:

1. **Hard to reverse** — meaningful cost to change later
2. **Surprising without context** — reader will wonder "why this way?"
3. **Real trade-off** — genuine alternatives existed

Easy to reverse → skip. Not surprising → nobody wonders. No alternative → nothing to record.

### Qualifies

- **Architectural shape.** "Monorepo." "Event-sourced write model, Postgres read model."
- **Cross-context integration.** "Ordering ↔ Billing via domain events, not sync HTTP."
- **Tech with lock-in.** DB, message bus, auth, deployment target. Not every library — only quarter-to-swap ones.
- **Boundaries/scope.** "Customer data owned by Customer context; others reference by ID." Explicit no-s as valuable as yes-s.
- **Deliberate deviations from obvious path.** "Manual SQL, not ORM, because X." Stops the next engineer from "fixing" deliberate code.
- **Constraints invisible in code.** "No AWS — compliance." "<200ms — partner SLA."
- **Non-obvious rejected alternatives.** Considered GraphQL, picked REST for subtle reasons → record, else suggested again in 6 months.
