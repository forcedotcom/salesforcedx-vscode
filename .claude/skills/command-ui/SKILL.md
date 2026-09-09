---
name: command-ui
description: Command palette, CodeLens, context menus, package.nls titles, and NotificationModeService. Use when adding a command, editing package.nls command titles, wiring success/progress, or calling vscode.commands.registerCommand / vscode.window.withProgress / showInformationMessage for command UX.
review: always
---

# Command UI

One Effect handler. Palette plus any extra _surface_ (context menu, CodeLens, tree item, title). Success/progress through `NotificationModeService`.

- Registration: [services-extension-consumption](../services-extension-consumption/SKILL.md) (`registerCommandWithRuntime`)
- Confirmations / errors / modals: [vscode-window-messages](../vscode-window-messages/SKILL.md)
- Mode API: [notification-mode-api.md](references/notification-mode-api.md)

## Recipe

### 1. Manifest + i18n

Two catalogs. Same key, different files.

| | Manifest (VS Code) | Runtime (`nls.localize`) |
| --- | --- | --- |
| Files | `package.json` `%key%`, `package.nls.json` | `src/messages/i18n.ts` |
| Locale | `package.nls.ja.json` (Partial; missing keys → English) | `i18n.ja.ts` (Partial) |
| Owns | command titles, config descriptions, view titles | progress / success / errors / buttons |

- `contributes.commands`: `"command": "sf.my.command"`, `"title": "%deploy_this_source_text%"` — `%key%` only (`package-json-i18n-descriptions`)
- `package.nls.json`: `"deploy_this_source_text": "SFDX: Deploy This Source to Org"` — Title Case, `SFDX:` prefix ([i18n-messages](../i18n-messages/SKILL.md))
- Same English string in `i18n.ts` under the same key
- Menu `when` for each _surface_ (`commandPalette`, `editor/context`, `explorer/context`)
- `commandLevelNotifications` property key = that English title
- Runtime copy only in `i18n.ts` ([vscode-window-messages](../vscode-window-messages/SKILL.md))

`COMMAND` is `messages.deploy_this_source_text` (always English). `nls.localize('deploy_this_source_text')` is user-visible (locale-aware).

`package.nls.ja.json` / `i18n.ja.ts` are Partial — add a translation when you have one; English is the fallback.

Done: `%key%` in `package.json` + `package.nls.json` + `i18n.ts`; slot key equals `messages.<title_key>`; command in palette.

### 2. Register

Once: `api.services.registerCommandWithRuntime(getRuntime())`.

Palette `when` gates enablement (`sf:project_opened`, `sf:has_target_org`). `when: never` for internals (conflict helpers, status-bar click-to-toast).

Two command IDs only when VS Code arg shapes differ. Share one English title → one notification slot. Both stay in the palette.

Done: `registerCommandWithRuntime` for every contributed command ID.

### 3. Extra surfaces

Same command ID. Handler accepts optional args from the _surface_; palette path falls back (active editor / prompt).

```typescript
export const myCommand = Effect.fn('myCommand')(function* (sourceUri?: URI, uris: URI[] = []) {
  const targets = sourceUri
    ? new Set([sourceUri, ...uris])
    : new Set([yield* api.services.EditorService.getActiveEditorUri()]);
});

new CodeLens(range, { command: 'sf.my.command', title, arguments: [uri] });
```

Done: every CodeLens / menu / `TreeItem.command` uses that ID.

### 4. Layer + slot

Merge `NotificationModeService.Default(extensionSection, statusBarId, statusBarName)` into `AllServicesLayer`. Copy an existing `Default(...)` in that package's `extensionProvider.ts`. Dispose the `ManagedRuntime` on deactivation.

Lookup: command → `extensionLevelNotifications` → global `salesforcedx-vscode-services.notifications`.

Add `commandLevelNotifications` property (English title key from step 1). Copy enum + `enumDescriptions` from a sibling slot; pick PAS / SO / PO — [notification-mode-api.md](references/notification-mode-api.md). Slot `description` is a `%key%` in `package.nls.json`. Add `extensionLevelNotifications` if missing. Slot, not a boolean `showSuccessNotification`.

Type keys from package.json in `src/utils/notificationMode.ts`:

```typescript
import type pkg from '../../package.json';

type CommandNotificationKey =
  keyof (typeof pkg)['contributes']['configuration']['properties']['salesforcedx-vscode-metadata.commandLevelNotifications']['properties'];

export type ProgressOnlyCommandKey = 'SFDX: Diff Source Against Org';
export type ProgressAndSuccessCommandKey = Exclude<CommandNotificationKey, ProgressOnlyCommandKey>;
```

ESLint `notificationSlotMatchesPackageJson` checks SuccessOnly / ProgressOnly aliases against the slot enum.

Done: `Default(...)` in the layer; slot exists; `COMMAND` typed.

### 5. Progress + success

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

`forceShow: true` when the message must not be suppressed (request ID).

Helpers that wrap `vscode.window.withProgress` (e.g. metadata `withPreparationProgress`) take the command key and call `getProgressLocation`.

Done: `getProgressLocation` + `showSuccessNotification`.
