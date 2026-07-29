# @salesforce/effect-ext-utils

Utility functions and helpers for Effect-based VS Code extensions.

## Overview

This package provides reusable utilities and helper functions for building VS Code extensions using the Effect library. It contains common patterns and utilities that can be shared across Effect-based extensions.

## Differences between this and the `salesforcedx-vscode-services` extension

1. This is a package, you can import it directly instead of having to get it through the extension API
1. it's a dev-time, not run-time dependency
1. each extension get its own instance of this package, so they aren't shared/commingled. Ex: `extensionScope` is per extension, each extension manages and closes its own scope.
1. You can pass these to `services` as dependencies (ex: some Effect that requires a scope).
1. the dependencies are minimal (mostly Effect, which all extensions will end up with). This should **not** contain any DX libraries or large dependencies

## Installation

```bash
npm install @salesforce/effect-ext-utils
```

## Usage

### annotateRootSpan

```typescript
import { annotateRootSpan } from '@salesforce/effect-ext-utils';

// Annotates the trace's root span instead of the current one. Useful when the
// annotation needs to reach App Insights / O11y (which only ingest top-level spans).
yield * annotateRootSpan({ orgId, featureFlag: 'enabled' });
```

Signature mirrors `Effect.annotateCurrentSpan` — both `(key, value)` and record overloads. The helper walks `Span.parent` to find the trace root, no-ops with a debug log if there is no current span or the chain dead-ends at a non-Effect (External) span.

### NotificationModeService

```typescript
import { NotificationModeService, NotificationModeServiceLayer, getProgressLocation, showSuccessNotification } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

// Create layer in extension activate()
const layer = NotificationModeServiceLayer(
  'my-extension-section',
  'my-extension.statusBar',
  'My Extension Status'
);

// Use in Effect code
const program = Effect.gen(function* () {
  // Get progress location for commands with a progress phase
  const location = yield* getProgressLocation('progressCommandKey');

  // Show success notification (works for both progress+success and success-only commands)
  yield* showSuccessNotification('commandKey', 'Done!');

  // Show success with action buttons
  yield* showSuccessNotification('commandKey', 'Success!', false, [
    { label: 'Open', run: () => { /* action handler */ } }
  ]);

  // Override success-off modes for critical info
  yield* showSuccessNotification('commandKey', 'Success with ID: 12345', true);
});

// Run with the layer
yield* program.pipe(Effect.provide(layer));
```

Service for reading notification mode settings & showing success notifications. Auto-detects command type from settings.

**Factory args:** `extensionSection`, `statusBarId`, `statusBarName`.

**Shared helpers** (use instead of per-extension wrappers):
- `getProgressLocation(command)` — returns Effect; works w/ progress+success & progress-only command keys
- `showSuccessNotification(command, message, forceShow?, actions?)` — returns Effect; works w/ progress+success & success-only command keys

Disposable resources (status bar item, command registration) managed by Layer — disposed on scope close (extension deactivation).

Mode values (auto-detected from settings):
- **Progress+Success**: `progressToastSuccessToast`, `progressToastSuccessOff`, `progressStatusBarSuccessStatusBar`, `progressStatusBarSuccessOff`
- **Success-only**: `successToast`, `successStatusBar`, `successOff`
- **Progress-only**: `progressToast`, `progressStatusBar`

Use `forceShow: true` to override `*SuccessOff`/`successOff` for critical info (e.g., request ID). Action buttons in toast or on status bar click.

## License

BSD-3-Clause

## Support

For issues or questions, please file an issue at:
https://github.com/forcedotcom/salesforcedx-vscode/issues
