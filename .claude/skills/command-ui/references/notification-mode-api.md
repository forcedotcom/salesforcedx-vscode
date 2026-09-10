# NotificationModeService

Configurable success notifications and progress location. `commandKey` = English title (`COMMAND` in [SKILL.md](../SKILL.md#1-manifest--i18n)).

Yield `api.services.NotificationModeService`. Merge `Default(extensionSection, statusBarId, statusBarName)` into `AllServicesLayer`.

`Default` returns a scoped per-extension layer. Status item, registered command, and timer release when the owning runtime is disposed.

## showSuccessNotification

```typescript
yield* service.showSuccessNotification(commandKey, message, forceShow?, actions?);
```

- `commandKey` — English title; must match a `commandLevelNotifications` property
- `message` — success message (localize outside Effect)
- `forceShow?` — (default false) override `*SuccessOff`/`successOff` modes
- `actions?` — buttons in toast or on status bar click (default: [])

```typescript
type ToastAction = { label: string; run: () => void | Promise<void> };
```

| Setting value | Success shown? | forceShow=true |
| --- | --- | --- |
| `progressToastSuccessToast` (PAS) | Toast | Toast |
| `progressToastSuccessOff` (PAS) | No | Toast |
| `progressStatusBarSuccessStatusBar` (PAS) | Status bar | Status bar |
| `progressStatusBarSuccessOff` (PAS) | No | Status bar |
| `successToast` (SO) | Toast | Toast |
| `successStatusBar` (SO) | Status bar | Status bar |
| `successOff` (SO) | No | Toast |

PAS = ProgressAndSuccessMode; SO = SuccessOnlyMode. `forceShow: true` for critical info (e.g. request ID). Status bar click → toast with message + actions.

## getProgressLocation

```typescript
const location = yield* service.getProgressLocation(commandKey);
```

Returns `Effect<vscode.ProgressLocation.Notification | vscode.ProgressLocation.Window>`. Pass to `PromptService.withProgress` / `withCancellableProgress`.

## Lifecycle

Service owns VS Code resources through Effect finalizers. Dispose the `ManagedRuntime` on deactivation.

## Mode types

**ProgressAndSuccessMode** (progress + success):

- `progressToastSuccessToast` — toast progress, toast success
- `progressToastSuccessOff` — toast progress, hidden success
- `progressStatusBarSuccessStatusBar` — status bar progress, status bar success
- `progressStatusBarSuccessOff` — status bar progress, hidden success

**SuccessOnlyMode** (success only):

- `successToast` / `successStatusBar` / `successOff`

**ProgressOnlyMode** (progress only):

- `progressToast` / `progressStatusBar`

3 disjoint mode sets; factory auto-detects from raw string. Configure per-command, per-extension, or globally (`salesforcedx-vscode-services.notifications`).
