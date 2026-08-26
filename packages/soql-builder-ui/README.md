# SOQL Builder UI

`@salesforce/soql-builder-ui` is the private, browser-safe Lit and Effect foundation for the SOQL Builder. It owns presentation, validated browser DTOs, UI state and actions, and scoped controller lifecycle primitives. It does not import VS Code APIs, extension services, JSforce, or extension-host message types.

The extension owns the VS Code integration service and connects it to one scoped Effect session for the lifetime of the Lit application. An explicit migration build can package that application for demonstrations and integration testing. Normal release builds continue to build and activate the existing LWC application until the cutover story.

This workspace is not published to npm and does not include an example Node server.

## Browser component tests

Run `npm run test:browser --workspace @salesforce/soql-builder-ui` from the repository root. The repository-owned
Playwright harness bundles the real Lit application, VSCode Elements, and a deterministic fake Effect service, then
runs the component flows in headless Chromium. It does not emulate `acquireVsCodeApi()` and does not require a local
HTTP server.

These are component integration tests: the Lit components, controller, and Effect lifecycle are real, while the
extension-owned backend is replaced by the fake service. The same webview components run in desktop and web extension
hosts, so the component behavior applies to both environments. Keep this suite focused on component contracts,
state/action flows, failure handling, and lifecycle behavior; retain a thinner extension-host E2E layer for host
wiring, packaging, and VS Code integration assurance.

The root unit-test graph runs `test:unit`. The SOQL extension's `test:web` workflow depends on `test:browser`, so CI
executes this suite in the existing Linux Playwright job that installs Chromium and uploads browser diagnostics.

Tests should locate controls by accessible role, name, or label and drive documented public element APIs. Shadow-root
traversal is limited to the documented helper in `test/browser/helpers.ts` for low-level behavior that cannot be
observed through accessibility or host-element contracts, such as `ElementInternals` form association.

The exported builder and query-results fake service factories support deterministic state emission, typed state-stream
and dispatch failures, adjustable dispatch latency, recorded actions, and acquisition/subscription/finalizer counters.
Latency uses Effect `Clock`, so service tests can provide `TestContext.TestContext` and advance `TestClock` without
waiting for wall-clock time. The query-results factory accepts the concrete Effect service tag, state, actions, and
failure types that its migration story will own, keeping this harness independent from VS Code host APIs.
