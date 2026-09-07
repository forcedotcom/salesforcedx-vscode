# NotificationModeService

Configurable success notifications & progress location detection. Auto-detects command type from settings.

Get the class and per-extension layer factory from the services API:

```typescript
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ToastAction } from 'salesforcedx-vscode-services';
import * as Effect from 'effect/Effect';

const program = Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const service = yield* api.services.NotificationModeService;
  // use service.showSuccessNotification, service.getProgressLocation
});

const api = yield* (yield* ExtensionProviderService).getServicesApi;
const layer = api.services.NotificationModeService.Default(
  'my-extension-section',
  'my-extension.statusBar',
  'My Extension Status'
);

yield* program.pipe(Effect.provide(layer));
```

`Default(extensionSection, statusBarId, statusBarName)` returns a scoped per-extension layer. Its status item,
registered command, and timer are released when the owning runtime is disposed.

## showSuccessNotification

Show success notification per command mode.

```typescript
yield* service.showSuccessNotification(commandKey, message, forceShow?, actions?);
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

PAS = ProgressAndSuccessMode; SO = SuccessOnlyMode. Use `forceShow: true` for critical info (e.g., request ID). Status bar click → toast with message + actions.

## getProgressLocation

Progress location for command.

```typescript
const location = yield* service.getProgressLocation(commandKey);
```

**Returns:** `Effect<vscode.ProgressLocation.Notification | vscode.ProgressLocation.Window>`.

## Lifecycle

The service owns its VS Code resources through Effect finalizers. Don't add a notification disposable to
`context.subscriptions`. Dispose the `ManagedRuntime` during extension deactivation; see the parent skill's
Resource Lifecycle section.

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

3 disjoint mode sets; factory auto-detects from raw string. Configure per-command, per-extension, or globally.

## Example

```typescript
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

const deployCommand = Effect.fn('deploy')(function* () {
  const extensionApi = yield* (yield* ExtensionProviderService).getServicesApi;
  const service = yield* extensionApi.services.NotificationModeService;
  const promptService = yield* extensionApi.services.PromptService;
  const location = yield* service.getProgressLocation('deploy');

  const requestId = yield* extensionApi.services.DeployService.deploy().pipe(
    promptService.withProgress(nls.localize('deploying'), location),
    Effect.tap(id =>
      service.showSuccessNotification('deploy', message, !!id, [
        { label: nls.localize('view_details'), run: () => { /* show */ } }
      ])
    )
  );
});

// In extension activate():
const extensionApi = yield* (yield* ExtensionProviderService).getServicesApi;
const layer = extensionApi.services.NotificationModeService.Default(
  'salesforcedx-vscode-metadata',
  'metadata.deploy.progress',
  'Metadata Deployment'
);
```
