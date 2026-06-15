# NotificationModeApi

Configurable success notifications for command execution feedback.

Create via `createNotificationMode` from `@salesforce/effect-ext-utils`:

```typescript
import { createNotificationMode } from '@salesforce/effect-ext-utils';

const notificationApi = createNotificationMode(
  'my-extension-section',
  'my-extension.statusBar',
  'My Extension Status'
);
```

## showSuccessNotification

Show a success notification based on command mode.

```typescript
notificationApi.showSuccessNotification(commandKey, message, forceShow);
```

**Params:**
- `command` — command key to look up mode setting
- `message` — success message text (call `nls.localize()` outside Effect)
- `forceShow?` — (default false) override `*SuccessOff` modes to always show

**Mode behavior:**

| Mode | Success shown? | forceShow=true |
| --- | --- | --- |
| `progressToastSuccessToast` | Toast | Toast |
| `progressToastSuccessOff` | No | Toast |
| `progressStatusBarSuccessStatusBar` | Status bar | Status bar |
| `progressStatusBarSuccessOff` | No | Status bar |

Use `forceShow: true` only when message has critical info (e.g. request ID, warning details).

## getProgressLocation

Get VS Code progress location for command.

```typescript
const location = notificationApi.getProgressLocation(commandKey);
```

**Returns:** `vscode.ProgressLocation.Notification` for toast modes, `.Window` for status-bar modes.

## CommandNotificationMode

```typescript
type CommandNotificationMode =
  | 'progressToastSuccessToast'      // Progress: cancellable toast, Success: toast
  | 'progressToastSuccessOff'        // Progress: cancellable toast, Success: hidden
  | 'progressStatusBarSuccessStatusBar'  // Progress: status bar spinner, Success: status bar
  | 'progressStatusBarSuccessOff';   // Progress: status bar spinner, Success: hidden
```

Users configure per-command, per-extension, or globally via VS Code settings.

## Example Usage

```typescript
import { createNotificationMode } from '@salesforce/effect-ext-utils';
import { nls } from './messages';

const notificationApi = createNotificationMode(
  'salesforcedx-vscode-metadata',
  'metadata.deploy.progress',
  'Metadata Deployment'
);

const deployCommand = Effect.fn('deploy')(function* () {
  const location = notificationApi.getProgressLocation('deploy');
  
  yield* vscode.window.withProgress(
    { location, title: nls.localize('deploying') },
    async () => {
      // Deploy logic
    }
  );

  // Show success (respects mode; forceShow=true if result contains request ID)
  const requestId = yield* fetchDeployStatus();
  const message = nls.localize('deploy_success', requestId);
  notificationApi.showSuccessNotification('deploy', message, !!requestId);
});
```
