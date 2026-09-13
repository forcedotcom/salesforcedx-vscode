---
name: lit-webview-architecture
description: Design or refactor a Lit webview's package boundary, Effect service contract, host adapter, lifecycle, registration, or browser bundle. Use for VS Code webviews that separate browser-safe UI from extension-host APIs and message protocols.
review: never
---

# Lit webview architecture

Boundary: UI owns presentation, browser-safe state/actions, and lifecycle coordination; host owns VS Code APIs, transport, metadata/network authorities, and localization.

## Browser-safe contract

- Immutable view state, UI actions, and typed errors from Effect Schemas. Tagged/literal unions instead of loose primitives, enums, or duplicated constants when invalid states matter.
- Directional host-to-UI and UI-to-host message schemas. Handler variant added with its behavior; exhaustive `Match`; no opposite-direction placeholder arms.
- Unknown data validated at entry. DOM `CustomEvent`: structural `type`/`detail` guard, then Schema validation of `detail`; inherited DOM accessors do not form a plain schema struct.
- Required localized labels injected by the host; no defaults hiding missing localization.
- No VS Code, JSforce, extension service, or extension-message imports in the browser-safe package. Host data normalized and validated before UI state.
- Only subpaths with known consumers exported; no root/testing barrels. Type-only dependencies in `devDependencies` with `import type`.

## Effect lifecycle

- 1 service contract: initial state, state stream, typed action dispatch. Extension-owned live layer plus deterministic test layers.
- 1 composition-root-owned scoped fiber per mounted webview: controller, queues, subscriptions, DOM listeners, finalizers.
- Listeners/subscriptions acquired and released as scoped resources. Disconnect interrupts and awaits the session fiber.
- Fiber-identity guard on finalizer cleanup; an old disconnect cannot clear a newer rapid reconnection.
- Components only render state and dispatch intent—no runtimes, scattered `Effect.runFork`/`Effect.runPromise`, or host calls.

## Registration and bundling

- Explicit host-called custom-element registration; every `customElements.define` guarded by `customElements.get`; no registration import side effects.
- New entries built with shared browser esbuild config. IIFE retained while HTML loads a classic deferred script; ESM requires matching script/resource-rewrite changes.
- Non-published UI workspaces marked `private` and excluded from publication/versioning. Contract tests scan source and bundles for host imports and Effect execution in presentation code.
- Compile/bundle/test order expressed in Wireit; browser tests consume the intended emitted application.

Examples: `packages/soql-builder-ui/src/application.ts`, `packages/soql-builder-ui/src/register.ts`, `packages/soql-builder-ui/test/package-contract.test.mjs`, `packages/salesforcedx-vscode-soql/src/soql-builder-ui/lit/`.
