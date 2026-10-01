---
name: manual-test-plan-judgment
description: Manual test plan JSON for one PR. Only caller is the manual test plan script.
disable-model-invocation: true
---

# Manual test plan judgment

Read the diff and the code. Reply with one JSON object. No other text. No fences.

`{ "kind": "nothing" }` when no extension surface (CI, docs, types-only, tooling), or every changed surface is already asserted.

`{ "kind": "checklist", "items": [ ... ] }` with 1+ items:

- `{ "kind": "watch-video", "spec": "<path>", "workflow": "<workflow name>", "job": "<job key>" }`
- `{ "kind": "manual", "step": "<what to look at>" }`

`spec`: repo-relative path, `test/playwright` then a `.spec.ts` file that exists.
`workflow`: `name:` of a leaf `*E2E.yml`. Not `e2e.yml`, `playwrightE2EFullSuite.yml`, `rerunPushE2E.yml`.
`job`: one job key in that file. Not a union such as `e2e-web | e2e-desktop`.

Trace the end-user change. A services or language-server diff still counts when a user can see it. Language servers are on-screen.

An assertion clears only what it asserts. Command-exists, UI-opened, and no-critical-errors do not clear a surface.

`manual` when e2e does not assert the surface, including refactors. No artifact URL.

A `watch-video` item that fails those checks is rejected. The script sends the error back once.
