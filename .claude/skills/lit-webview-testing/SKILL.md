---
name: lit-webview-testing
description: Write or review browser component tests for Lit webviews and VSCode Elements. Use for Playwright component harnesses, fake Effect services, accessibility locators, shadow DOM boundaries, lifecycle tests, and deciding what belongs in component tests versus VS Code E2E.
review: never
---

# Lit webview browser testing

Real browser required for Lit updates, custom elements, popovers, shadow DOM, accessibility trees, and `ElementInternals`.

## Harness boundary

- Real Lit components, controller, and Effect application lifecycle; only extension backend replaced with a fake service layer.
- No emulated `acquireVsCodeApi()` or local server.
- Fake types derived from their factory/service source of truth—not handwritten copies.
- Fakes support deterministic state emission, action recording, typed stream/dispatch failures, controllable latency, and resource counters.
- Fake latency via Effect `Clock`; `TestClock` in Effect tests, not wall-clock waits.

## What to test here

- Component contracts and state/action flows: initial, loading, disabled, empty/no-match, invalid/recoverable, restored, external update, success, failure.
- Action count/payload, including rapid or latent actions when cancellation/serialization matters.
- Connect, disconnect, reconnect, listener/subscription cleanup, scoped finalization.
- Keyboard, focus, theme, and form behavior where browser semantics matter.
- Thin extension-host E2E: VS Code wiring, packaging, CSP/resources, desktop/web integration, critical journeys.

## Interaction rules

- Controls located by accessible role/name/label; documented public `value`/`checked` set before dispatching the public event.
- Observable UI/application assertions—not private state or arbitrary render delays. Mount helper may await `updateComplete` to establish readiness.
- Unavoidable shadow traversal isolated in 1 named helper, only for otherwise unobservable contracts such as `ElementInternals` form association.
- Wrapper adapting an inaccessible nested node: user-visible accessibility assertion first; narrowly scoped implementation assertion only if needed.

## Repository integration

- Compile, fixture bundle, and browser execution in the package Wireit graph and relevant CI `test:web` path.
- Package compile, lint, unit tests, and focused browser suite run from repository root.
- General syntax/reliability: [playwright-e2e](../playwright-e2e/SKILL.md). This skill owns the component-test boundary.

Examples: `packages/soql-builder-ui/test/browser/`, `packages/soql-builder-ui/src/testing/fakeEffectService.ts`.
