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

### createProgressAndSuccessNotificationMode

```typescript
import { createProgressAndSuccessNotificationMode } from '@salesforce/effect-ext-utils';

const notificationApi = createProgressAndSuccessNotificationMode(
  'my-extension-section',
  'my-extension.statusBar',
  'My Extension Status'
);

// Show success notification
notificationApi.showSuccessNotification('commandKey', 'Success!');

// Show success with action buttons
notificationApi.showSuccessNotification('commandKey', 'Success!', false, [
  { label: 'Open', run: () => { /* action handler */ } }
]);

// Get progress location for withProgress
const location = notificationApi.getProgressLocation('commandKey');
```

Configurable notifications for commands with both a progress phase and a success notification (`ProgressAndSuccessMode`). Supports modes:
- `progressToastSuccessToast`: toast progress, toast success
- `progressToastSuccessOff`: toast progress, hidden success
- `progressStatusBarSuccessStatusBar`: status bar progress, status bar success
- `progressStatusBarSuccessOff`: status bar progress, hidden success

Action buttons appear in toast notifications and when status bar items are clicked. Users configure per-command, per-extension, or globally via VS Code settings. Use `forceShow: true` to override `*SuccessOff` modes when the message has critical info (e.g., request ID).

See [ProgressAndSuccessNotificationModeApi reference](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/.claude/skills/services-extension-consumption/references/notification-mode-api.md) for full details.

### createNotificationModeApi

```typescript
import { createNotificationModeApi } from '@salesforce/effect-ext-utils';

const notificationApi = createNotificationModeApi(
  'my-extension-section',
  'my-extension.statusBar',
  'My Extension Status'
);

// Use progress+success notifications
notificationApi.showSuccessNotification('progressCommandKey', 'Done!');
const progressLocation = notificationApi.getProgressLocation('progressCommandKey');

// Use success-only notifications
notificationApi.showSuccessOnlyNotification('successCommandKey', 'Complete!');
```

Combined factory that creates both `createProgressAndSuccessNotificationMode` and `createSuccessOnlyNotificationMode` APIs bound to the same settings and status bar. Use when an extension has both command types — avoids repeating config arguments. Returns merged API with both `showSuccessNotification`/`getProgressLocation` and `showSuccessOnlyNotification` methods.

### createSuccessOnlyNotificationMode

```typescript
import { createSuccessOnlyNotificationMode } from '@salesforce/effect-ext-utils';

const notificationApi = createSuccessOnlyNotificationMode(
  'my-extension-section',
  'my-extension.statusBar',
  'My Extension Status'
);

// Show success notification
notificationApi.showSuccessOnlyNotification('commandKey', 'Success!');

// Show success with action buttons
notificationApi.showSuccessOnlyNotification('commandKey', 'Success!', [
  { label: 'Open', run: () => { /* action handler */ } }
]);
```

Configurable notifications for commands with only a success phase — no progress (`SuccessOnlyMode`). Supports modes:
- `toast`: show success as toast notification
- `statusBar`: show success in status bar
- `off`: suppress success notification

Reads command-level `SuccessOnlyMode` settings first, then falls back through extension-level and global `ProgressAndSuccessMode` settings via a mapping function: `progressToastSuccessToast` → `toast`, `progressStatusBarSuccessStatusBar` → `statusBar`, and `progressToast/StatusBarSuccessOff` → `off`. Defaults to `toast` if no configuration is found at any level. Action buttons appear in toast notifications and when status bar items are clicked.

See [SuccessOnlyNotificationModeApi reference](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/.claude/skills/services-extension-consumption/references/notification-mode-api.md) for full details.

## License

BSD-3-Clause

## Support

For issues or questions, please file an issue at:
https://github.com/forcedotcom/salesforcedx-vscode/issues
