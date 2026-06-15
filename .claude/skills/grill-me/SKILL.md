---
name: grill-me
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
---

## How to grill

- Interview until shared understanding. Walk each branch; resolve deps one at a time. Recommend an answer per question.
- One question at a time. Wait for feedback.
- Answerable from code → read it, don't ask.

## Domain awareness

Existing docs first. Root `CONTEXT-MAP.md` lists contexts.

Single-context:

```
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

Multi-context:

```
/
├── CONTEXT-MAP.md
├── docs/adr/                ← system-wide
├── .claude/CONTEXT.md       ← AI tooling
├── .github/CONTEXT.md       ← CI YAML
└── packages/
    ├── ordering/CONTEXT.md
    └── billing/CONTEXT.md
```

Contexts go wherever a coherent vocabulary lives — packages, plus non-source dirs (`.claude/`, `.github/`). Narrowest scope owning the term.

Also read ADRs for the grilled area: root `docs/adr/` + in-scope `packages/*/docs/adr/`. ADRs = *why / what-rejected* — grill against them; don't re-propose a reverted alternative.

Create lazily. First new context in a single-context repo → also create `CONTEXT-MAP.md`; move existing root `CONTEXT.md` to its proper scope if it doesn't belong at root.

## During the session

- **Glossary conflict**: "glossary defines 'cancellation' as X, you mean Y — which?"
- **Fuzzy term**: propose canonical. "'account' — Customer or User?"
- **Edge cases**: probe boundaries.
- **Cross-ref code**: verify claims. "code cancels whole Orders, you said partial — which?"
- **Update `CONTEXT.md` inline** as terms resolve. Don't batch. Format: [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md). Glossary only — no specs/scratch/decisions.
- **ADRs sparingly**. Offer iff all three: hard to reverse, surprising without context, real trade-off. Format: [ADR-FORMAT.md](./ADR-FORMAT.md).
