# NotificationModeApi

Configurable success notifications for command execution feedback.

Create via `createNotificationModeApi` from `@salesforce/effect-ext-utils`:

```typescript
import { createNotificationModeApi, type ToastAction } from '@salesforce/effect-ext-utils';

const { showSuccessNotification, getProgressLocation } = createNotificationModeApi<CommandKey, SuccessOnlyKey>(
  'my-extension-section',
  'my-extension.statusBar',
  'My Extension Status'
);
```

## showSuccessNotification

Show success notification per command mode.

```typescript
showSuccessNotification(commandKey, message, forceShow, actions);
```

**Params:**
- `command` — key to look up mode setting
- `message` — success message (call `nls.localize()` outside Effect)
- `forceShow?` — (default false) override `*SuccessOff` modes
- `actions?` — buttons; appear in toast or on status bar click (default: [])

**ToastAction:**
```typescript
type ToastAction = { label: string; run: () => void | Promise<void> };
```

**Mode behavior:**

| Mode | Success shown? | forceShow=true |
| --- | --- | --- |
| `progressToastSuccessToast` | Toast | Toast |
| `progressToastSuccessOff` | No | Toast |
| `progressStatusBarSuccessStatusBar` | Status bar | Status bar |
| `progressStatusBarSuccessOff` | No | Status bar |

Set `forceShow: true` only for critical info (e.g., request ID, warning details). In status bar modes, clicking notification opens toast with message and actions.

## getProgressLocation

Get VS Code progress location for command.

```typescript
const location = getProgressLocation(commandKey);
```

**Returns:** `vscode.ProgressLocation.Notification` (toast modes) or `.Window` (status-bar modes).

## CommandNotificationMode

```typescript
type CommandNotificationMode =
  | 'progressToastSuccessToast'            // Progress: cancellable toast, Success: toast
  | 'progressToastSuccessOff'              // Progress: cancellable toast, Success: hidden
  | 'progressStatusBarSuccessStatusBar'    // Progress: status bar, Success: status bar
  | 'progressStatusBarSuccessOff';         // Progress: status bar, Success: hidden
```

Configure per-command, per-extension, or globally via VS Code settings.

## Example Usage

```typescript
import { createNotificationModeApi, type ToastAction } from '@salesforce/effect-ext-utils';
import { nls } from './messages';

const { showSuccessNotification, getProgressLocation } = createNotificationModeApi<'deploy'>(
  'salesforcedx-vscode-metadata',
  'metadata.deploy.progress',
  'Metadata Deployment'
);

const deployCommand = Effect.fn('deploy')(function* () {
  const location = getProgressLocation('deploy');

  yield* vscode.window.withProgress(
    { location, title: nls.localize('deploying') },
    async () => {
      // Deploy logic
    }
  );

  // Show success with actions (respects mode; forceShow=true if result contains request ID)
  const requestId = yield* fetchDeployStatus();
  const message = nls.localize('deploy_success', requestId);
  const actions = [
    { label: nls.localize('view_details'), run: () => { /* show details */ } }
  ];
  yield* Effect.sync(() => showSuccessNotification('deploy', message, !!requestId, actions));
});
```
