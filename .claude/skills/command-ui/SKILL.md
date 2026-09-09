---
name: command-ui
description: Command palette, context menus, CodeLens, and NotificationModeService for VS Code extension commands. Use when adding or changing a command, contributes.commands/menus, CodeLens, success toast, progress, or when code would call vscode.commands.registerCommand or vscode.window.withProgress/showInformationMessage for command UX.
review: always
---

# Command UI

One Effect handler. Palette plus any extra surface (context menu, CodeLens, tree item, title). Success/progress through `NotificationModeService`.

- Registration: [services-extension-consumption](../services-extension-consumption/SKILL.md) (`registerCommandWithRuntime`)
- Confirmations / errors / modals: [vscode-window-messages](../vscode-window-messages/SKILL.md)
- Manifest schema: [packageJson](../packageJson/SKILL.md)
- Title/notification copy: [i18n-messages](../i18n-messages/SKILL.md)
- Mode API: [notification-mode-api.md](references/notification-mode-api.md)

## Surfaces

1. `contributes.commands` — palette by default
2. Register once: `api.services.registerCommandWithRuntime(getRuntime())`
3. Extra surfaces (`editor/context`, `explorer/context`, CodeLens `command:`, `TreeItem.command`) use that same command ID
4. Handler accepts optional args from the extra surface; palette path falls back (active editor / prompt)

```typescript
export const myCommand = Effect.fn('myCommand')(function* (sourceUri?: URI, uris: URI[] = []) {
  const targets = sourceUri
    ? new Set([sourceUri, ...uris])
    : new Set([yield* api.services.EditorService.getActiveEditorUri()]);
  // ...
});

new CodeLens(range, { command: 'sf.my.command', title, arguments: [uri] });
```

Palette `when` gates enablement (`sf:project_opened`, `sf:has_target_org`). `when: never` / `when: false` only for non-user internals (conflict helpers, status-bar click-to-toast).

Two command IDs only when VS Code arg shapes differ (explorer URIs vs no-arg palette). Share one English title → one notification slot. Both stay in the palette.

## Notifications

New commands do not build toasts, progress UI, or a boolean `showSuccessNotification` setting.

### Wire the layer

Merge into the extension `AllServicesLayer` (not `Effect.provide` at the command):

```typescript
api.services.NotificationModeService.Default(
  'salesforcedx-vscode-metadata',
  'sf-metadata-notifications',
  'Salesforce: Metadata Notifications'
)
```

Copy an existing `Default(...)` in that package's `extensionProvider.ts`. Dispose the `ManagedRuntime` on deactivation — the service owns its status item.

### Settings slot

Lookup: command → `extensionLevelNotifications` → global `salesforcedx-vscode-services.notifications`.

Add a property under `salesforcedx-<ext>.commandLevelNotifications`. **Key is the English command title**, not the command ID (`"SFDX: Deploy This Source to Org"`). Copy enum + `enumDescriptions` from a sibling slot in the same `package.json`; pick the mode set that matches the command (PAS / SO / PO) — [notification-mode-api.md](references/notification-mode-api.md).

Also add `extensionLevelNotifications` if the extension does not have it yet.

Type keys from package.json in `src/utils/notificationMode.ts`:

```typescript
import type pkg from '../../package.json';

type CommandNotificationKey =
  keyof (typeof pkg)['contributes']['configuration']['properties']['salesforcedx-vscode-metadata.commandLevelNotifications']['properties'];

export type ProgressOnlyCommandKey = 'SFDX: Diff Source Against Org';
export type ProgressAndSuccessCommandKey = Exclude<CommandNotificationKey, ProgressOnlyCommandKey>;
```

`COMMAND` is `messages.<title_key>` (same string as the package.json property key). ESLint `notificationSlotMatchesPackageJson` checks SuccessOnly / ProgressOnly aliases against the slot enum.

### In the command

```typescript
const COMMAND: ProgressAndSuccessCommandKey = messages.deploy_this_source_text;
const notificationMode = yield* api.services.NotificationModeService;
const location = yield* notificationMode.getProgressLocation(COMMAND);

yield* work.pipe(
  promptService.withProgress(nls.localize('working'), location),
  Effect.tap(() =>
    notificationMode.showSuccessNotification(
      COMMAND,
      nls.localize('command_succeeded_text', nls.localize('deploy_this_source_text'))
    )
  )
);
```

Cancellable: `promptService.withCancellableProgress(title, location)`.

`forceShow: true` only when the message must not be suppressed (request ID).

Helpers that wrap `vscode.window.withProgress` (e.g. metadata `withPreparationProgress`) must take the command key and call `getProgressLocation`.

## Target

| | |
| --- | --- |
| Register | `registerCommandWithRuntime` |
| Progress | `getProgressLocation` + `PromptService.withProgress` / `withCancellableProgress` |
| Success | `showSuccessNotification` |
| Confirm / error | [vscode-window-messages](../vscode-window-messages/SKILL.md) / `ErrorHandlerService` |
