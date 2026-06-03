---
name: grill-me
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
---

<what-to-do>

Interview relentlessly until shared understanding. Walk each branch of the design tree; resolve dependencies one at a time. Recommend an answer per question.

One question at a time. Wait for feedback.

If a question is answerable by reading code, read code instead of asking.

</what-to-do>

<supporting-info>

## Domain awareness

Look for existing docs. Start with root `CONTEXT-MAP.md` if present —
it lists every context and where each one lives.

### File structure

Single-context:

```
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

Multi-context (root `CONTEXT-MAP.md` exists):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                ← system-wide
├── .claude/CONTEXT.md       ← AI tooling (skills, workflows, commands)
├── .github/CONTEXT.md       ← GitHub Actions / workflow YAML
└── packages/
    ├── ordering/CONTEXT.md
    └── billing/CONTEXT.md
```

Contexts live wherever a coherent vocabulary does — per package, plus
non-source directories like `.claude/` (AI tooling) and `.github/` (CI).
Pick the narrowest scope that owns the term.

Create lazily — only when there's something to write. First new context
in a single-context repo → also create `CONTEXT-MAP.md` and move the
existing root `CONTEXT.md` content into the appropriate scoped file
if it doesn't actually belong at root.

## During the session

### Challenge against the glossary

Term conflicts with existing `CONTEXT.md` → call out: "glossary defines 'cancellation' as X, you mean Y — which?"

### Sharpen fuzzy language

Vague/overloaded term → propose canonical: "'account' — Customer or User?"

### Discuss concrete scenarios

Probe edge cases. Force precision on boundaries.

### Cross-reference with code

User states behavior → verify in code. Surface contradictions: "code cancels whole Orders, you said partial — which?"

### Update CONTEXT.md inline

Term resolved → update immediately. Don't batch. Format: [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` = glossary only. No specs, scratch, implementation decisions.

### Offer ADRs sparingly

Offer iff all three:

1. Hard to reverse
2. Surprising without context
3. Real trade-off (genuine alternatives existed)

Else skip. Format: [ADR-FORMAT.md](./ADR-FORMAT.md).

</supporting-info>
