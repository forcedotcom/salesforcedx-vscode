# NotificationModeApi

Configurable success notifications for command execution feedback. Auto-detects command type (progress+success, success-only, or progress-only) from stored settings.

Create via `createNotificationModeApi` from `@salesforce/effect-ext-utils`:

```typescript
import { createNotificationModeApi, type ToastAction } from '@salesforce/effect-ext-utils';

const { showSuccessNotification, getProgressLocation } = createNotificationModeApi(
  'my-extension-section',
  'my-extension.statusBar',
  'My Extension Status'
);
```

3 args: `extensionSection`, `statusBarId`, `statusBarName`. Type parameters control which command keys map to which notification shapes.

## showSuccessNotification

Show success notification per command mode. Auto-detects from settings.

```typescript
showSuccessNotification(commandKey, message, forceShow?, actions?);
```

**Params:**
- `commandKey` — key to look up mode setting
- `message` — success message (localize outside Effect)
- `forceShow?` — (default false) override `*SuccessOff`/`successOff` modes
- `actions?` — buttons in toast or on status bar click (default: [])

**ToastAction:**
```typescript
type ToastAction = { label: string; run: () => void | Promise<void> };
```

**Mode auto-detection & behavior:**

| Setting value | Success shown? | forceShow=true |
| --- | --- | --- |
| `progressToastSuccessToast` (PAS) | Toast | Toast |
| `progressToastSuccessOff` (PAS) | No | Toast |
| `progressStatusBarSuccessStatusBar` (PAS) | Status bar | Status bar |
| `progressStatusBarSuccessOff` (PAS) | No | Status bar |
| `successToast` (SO) | Toast | Toast |
| `successStatusBar` (SO) | Status bar | Status bar |
| `successOff` (SO) | No | Toast |

PAS = ProgressAndSuccessMode, SO = SuccessOnlyMode. `forceShow: true` for critical info only (e.g., request ID). Status bar click opens toast with message + actions.

## getProgressLocation

Progress location for command.

```typescript
const location = getProgressLocation(commandKey);
```

**Returns:** `vscode.ProgressLocation.Notification` (toast modes) or `.Window` (status bar modes).

## Mode types

**ProgressAndSuccessMode** (4 options — both progress & success phases):
- `progressToastSuccessToast` — toast progress, toast success
- `progressToastSuccessOff` — toast progress, hidden success
- `progressStatusBarSuccessStatusBar` — status bar progress, status bar success
- `progressStatusBarSuccessOff` — status bar progress, hidden success

**SuccessOnlyMode** (3 options — success phase only):
- `successToast` — success as toast
- `successStatusBar` — success in status bar
- `successOff` — suppress success

**ProgressOnlyMode** (2 options — progress phase only):
- `progressToast` — toast progress
- `progressStatusBar` — status bar progress

All 3 mode value sets are disjoint; factory auto-detects from raw string. Configure per-command, per-extension, or globally via VS Code settings.

## Example

```typescript
import { createNotificationModeApi } from '@salesforce/effect-ext-utils';

const { showSuccessNotification, getProgressLocation } = createNotificationModeApi(
  'salesforcedx-vscode-metadata',
  'metadata.deploy.progress',
  'Metadata Deployment'
);

const deployCommand = Effect.fn('deploy')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const location = getProgressLocation('deploy');

  const requestId = yield* api.services.DeployService.deploy().pipe(
    promptService.withProgress(nls.localize('deploying'), location),
    Effect.tap(id =>
      Effect.sync(() =>
        showSuccessNotification('deploy', message, !!id, [
          { label: nls.localize('view_details'), run: () => { /* show */ } }
        ])
      )
    )
  );
});
```
