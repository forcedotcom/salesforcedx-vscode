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

### createNotificationMode

```typescript
import { createNotificationMode } from '@salesforce/effect-ext-utils';

const notificationApi = createNotificationMode(
  'my-extension-section',
  'my-extension.statusBar',
  'My Extension Status'
);

// Show success notification
notificationApi.showSuccessNotification('commandKey', 'Success!');

// Get progress location for withProgress
const location = notificationApi.getProgressLocation('commandKey');
```

Creates a configurable notification API for command execution feedback. Supports multiple modes:
- `progressToastSuccessToast`: toast progress, toast success
- `progressToastSuccessOff`: toast progress, hidden success
- `progressStatusBarSuccessStatusBar`: status bar progress, status bar success
- `progressStatusBarSuccessOff`: status bar progress, hidden success

Users configure per-command, per-extension, or globally via VS Code settings. Use `forceShow: true` to override `*SuccessOff` modes when the message has critical info (e.g., request ID).

See [NotificationModeApi reference](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/.claude/skills/services-extension-consumption/references/notification-mode-api.md) for full details.

## License

BSD-3-Clause

## Support

For issues or questions, please file an issue at:
https://github.com/forcedotcom/salesforcedx-vscode/issues
