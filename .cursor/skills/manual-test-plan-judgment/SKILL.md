---
name: manual-test-plan-judgment
description: Turn PR facts into a manual test plan JSON object. The manual test plan script is the only caller.
disable-model-invocation: true
---

# Manual test plan judgment

Reply with one JSON object and no other text. No markdown fences.

`{ "kind": "nothing" }` when no extension surface (CI, docs, types-only, tooling), or every changed surface already asserted.

`{ "kind": "checklist", "items": [ ... ] }` with one or more items:

- `{ "kind": "watch-video", "spec": "<path>", "workflow": "<workflow name>", "job": "<job key>" }`
- `{ "kind": "manual", "step": "<what to look at>" }`

`job` is one job key that workflow file defines (`e2e-web`, `e2e-desktop`, `e2e-desktop-lsp`, `e2e-desktop-run-tests`, `e2e-desktop-debug-tests`, `e2e-conflicts-web`, `e2e-conflicts-desktop`, `code-builder-e2e`). Not a union such as `e2e-web | e2e-desktop`.

Trace what the change does for the end user. A diff in services or a language server still counts: use `dependents`. Language servers are on-screen.

Copy `spec`, `workflow`, and `job` from the facts. `spec` may be a dependent package spec path. No artifact URL.

An assertion clears only what it asserts. Command-exists, UI-opened, and no-critical-errors do not clear a surface.

Visual check (`manual` item) when e2e does not assert the surface, including refactors.
