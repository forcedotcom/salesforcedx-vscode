---
name: lit-components
description: Create or edit Lit components in this repository, including reactive properties and internal state.
review: never
---

# Lit components

Use Lit's standard decorators with TypeScript auto-accessors.

- Import decorators from their individual `lit/decorators/<name>.js` modules.
- Declare public reactive inputs with `@property(...) public accessor` and internal render state with `@state() private accessor`.
- Initialize accessors inline when they have defaults. Use a definite-assignment assertion for required inputs supplied by the host.
- Use `{ attribute: false }` for object or array inputs that must not map to HTML attributes. Specify `type` when an attribute needs Lit conversion.
- Do not use the legacy `static properties` plus `declare` pattern for reactive members, or enable `experimentalDecorators`/legacy class-field semantics.
- Verify the component with its package compile, lint, unit tests, and focused browser tests when behavior or rendering changes.
