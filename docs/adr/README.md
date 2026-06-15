# Architecture Decision Records

Records of *why we chose this and what we rejected*. Anti-regression: stops a tried-and-reverted alternative being re-proposed.

This complements `docs/architecture/` (which describes *how* the system is built). ADRs capture *why this way* and *what was considered and rejected*.

## Format

[ADR-FORMAT.md](../../.claude/skills/grill-me/ADR-FORMAT.md): `NNNN-slug.md`, short title + 1-3 sentences. `## Considered Options` only when a rejected alternative matters. Numbering sequential, assigned at author time (highest existing + 1).

## Scope

- Root `docs/adr/` — repo-wide decisions.
- `packages/*/docs/adr/` — decisions local to one extension.

Lower-tier, mechanical "how" guidance lives in `.claude/skills/` (e.g. wireit, services-extension-consumption, effect-best-practices), not here.
