# NotificationModeService

Configurable success notifications & progress location. Auto-detects command type from settings.

`commandKey` is the **English command title** (package.json `commandLevelNotifications` property key / `messages.*_text`), not the command ID.

Get the class and per-extension layer factory from the services API. Merge `Default(...)` into the extension `AllServicesLayer` — do not `Effect.provide` at command sites.

```typescript
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ToastAction } from 'salesforcedx-vscode-services';
import * as Effect from 'effect/Effect';

const api = yield* (yield* ExtensionProviderService).getServicesApi;
const service = yield* api.services.NotificationModeService;
```

```typescript
api.services.NotificationModeService.Default(
  'salesforcedx-vscode-metadata',
  'sf-metadata-notifications',
  'Salesforce: Metadata Notifications'
)
```

`Default(extensionSection, statusBarId, statusBarName)` returns a scoped per-extension layer. Its status item, registered command, and timer are released when the owning runtime is disposed.

## showSuccessNotification

```typescript
yield* service.showSuccessNotification(commandKey, message, forceShow?, actions?);
```

**Params:**

- `commandKey` — English title; must match a `commandLevelNotifications` property
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

PAS = ProgressAndSuccessMode; SO = SuccessOnlyMode. Use `forceShow: true` for critical info (e.g. request ID). Status bar click → toast with message + actions.

## getProgressLocation

```typescript
const location = yield* service.getProgressLocation(commandKey);
```

**Returns:** `Effect<vscode.ProgressLocation.Notification | vscode.ProgressLocation.Window>`.

Pass `location` to `PromptService.withProgress` / `withCancellableProgress`.

## Lifecycle

The service owns its VS Code resources through Effect finalizers. Don't add a notification disposable to `context.subscriptions`. Dispose the `ManagedRuntime` during extension deactivation.

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

3 disjoint mode sets; factory auto-detects from raw string. Configure per-command, per-extension, or globally (`salesforcedx-vscode-services.notifications`).

## Example

```typescript
const COMMAND: ProgressAndSuccessCommandKey = messages.package_install_text;
const notificationMode = yield* api.services.NotificationModeService;
const promptService = yield* api.services.PromptService;
const location = yield* notificationMode.getProgressLocation(COMMAND);

yield* install.pipe(
  promptService.withProgress(nls.localize('package_install_verifying_progress', id), location),
  Effect.tap(() =>
    notificationMode.showSuccessNotification(
      COMMAND,
      nls.localize('package_install_succeeded_message', packageId)
    )
  )
);
```
