# NotificationModeService

Configurable success notifications & progress location detection. Auto-detects command type from settings.

Provided via `NotificationModeServiceLayer` from `@salesforce/effect-ext-utils`:

```typescript
import { NotificationModeService, NotificationModeServiceLayer, type ToastAction } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

const program = Effect.gen(function* () {
  const service = yield* NotificationModeService;
  // use service.showSuccessNotification, service.getProgressLocation
});

const layer = NotificationModeServiceLayer(
  'my-extension-section',
  'my-extension.statusBar',
  'My Extension Status'
);

yield* program.pipe(Effect.provide(layer));
```

Factory args: `extensionSection`, `statusBarId`, `statusBarName`. Returns `Layer<NotificationModeService>`; manages status bar & command lifecycle.

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

Auto-disposed when layer scope closes (extension deactivation). No manual cleanup needed.

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
import { NotificationModeService, NotificationModeServiceLayer } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

const deployCommand = Effect.fn('deploy')(function* () {
  const service = yield* NotificationModeService;
  const extensionApi = yield* (yield* ExtensionProviderService).getServicesApi;
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
const layer = NotificationModeServiceLayer(
  'salesforcedx-vscode-metadata',
  'metadata.deploy.progress',
  'Metadata Deployment'
);
```
