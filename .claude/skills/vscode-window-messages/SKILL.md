---
name: vscode-window-messages
description: Guidelines for using vscode.window.show*Message methods. Use when working with showInformationMessage, showWarningMessage, showErrorMessage.
version: 1.1.0
---

# VSCode Window Messages Best Practices

## Quick Reference: Critical Rules

| Category         | DO                                      | DON'T                                            |
| ---------------- | --------------------------------------- | ------------------------------------------------ |
| API              | Direct `vscode.window.show*Message`     | Legacy `NotificationService`                     |
| Messages         | `nls.localize('key', ...args)`          | String literals or template literals without nls |
| Return Values    | Handle `Thenable<string \| undefined>` or `Thenable<MessageItem \| undefined>` | Ignore return values                             |
| Button Actions   | Check return value for button clicks    | Assume user always clicks                        |
| Button Actions   | `nls.localize`                          | String literals or template literals without nls |
| Modal Options    | `{ modal: true, detail: ... }` for blocking dialogs | `detail` without `modal: true` (detail modal-only); explicit 'Cancel' buttons (VS Code adds one automatically) |
| Effect (wait)    | `Effect.promise()` when response needed | `Effect.promise()` for fire-and-forget           |
| Effect (no wait) | `Effect.sync()` for fire-and-forget     | `Effect.promise()` when not waiting              |

## Use Direct vscode.window Calls

Use `vscode.window.show*Message` directly. Don't use legacy `NotificationService` in new code.

```typescript
import * as vscode from 'vscode';
import { nls } from '../messages/messages';

// CORRECT
await vscode.window.showInformationMessage(nls.localize('retrieve_canceled'));
await vscode.window.showErrorMessage(nls.localize('retrieve_failed', String(error)));

// WRONG
await notificationService.showInformationMessage(nls.localize('retrieve_canceled'));
```

## Internationalization with nls.localize()

All message strings and button labels must use `nls.localize()`. Enforced by `no-vscode-message-literals` ESLint rule.

```typescript
// CORRECT
await vscode.window.showInformationMessage(nls.localize('retrieve_canceled'));
await vscode.window.showErrorMessage(nls.localize('retrieve_failed', String(error)));
await vscode.window.showInformationMessage(`${nls.localize('prefix')} ${nls.localize('suffix')}`);

const answer = await vscode.window.showWarningMessage(
  nls.localize('confirm_delete'),
  nls.localize('yes_button'),
  nls.localize('no_button')
);

// WRONG
await vscode.window.showInformationMessage('Operation successful');
await vscode.window.showInformationMessage(`Operation ${status} successful`);
await vscode.window.showWarningMessage(nls.localize('confirm_delete'), 'Yes', 'No');
```

**Adding new messages:**

1. Add key/value to `i18n.ts` in package
2. Use `nls.localize('your_message_key', ...args)`

## Handling Return Values

Returns clicked button or `undefined` if dismissed.

**Return types:**
- String buttons: `Thenable<string | undefined>`
- MessageItem buttons: `Thenable<MessageItem | undefined>`

```typescript
// CORRECT - String buttons
const selection = await vscode.window.showWarningMessage(
  nls.localize('unsaved_changes'),
  nls.localize('save_button'),
  nls.localize('discard_button')
);

if (selection === nls.localize('save_button')) {
  await saveFile();
}

// CORRECT - MessageItem buttons
const item = await vscode.window.showWarningMessage(
  nls.localize('unsaved_changes'),
  { modal: true },
  { title: nls.localize('save_button') },
  { title: nls.localize('discard_button') }
);

if (item?.title === nls.localize('save_button')) {
  await saveFile();
}

// CORRECT - Fire and forget
void vscode.window.showInformationMessage(nls.localize('operation_completed'));

// WRONG
vscode.window.showInformationMessage(nls.localize('operation_completed')); // Missing void
```

## Integration with Effect

### When User Response is Required

Use `Effect.promise()` to wait for user response. Blocks execution until user responds.

```typescript
import { Effect } from 'effect';

// CORRECT - Wait for response
const selection =
  yield *
  Effect.promise(() =>
    vscode.window.showWarningMessage(nls.localize('confirm_action'), nls.localize('yes'), nls.localize('no'))
  );

if (selection === nls.localize('yes')) {
  yield * performAction();
}

// CORRECT - Wait for error acknowledgment
yield * Effect.promise(() => vscode.window.showErrorMessage(nls.localize('critical_error')));
```

### When User Response is NOT Required (Fire-and-Forget)

Use `Effect.sync()` for non-blocking messages. Execution continues immediately.

```typescript
import { Effect } from 'effect';

// CORRECT - Fire and forget
yield *
  Effect.sync(() => {
    void vscode.window.showInformationMessage(nls.localize('background_task_started'));
  });

yield * performBackgroundTask();

// WRONG - Blocks unnecessarily
yield * Effect.promise(() => vscode.window.showInformationMessage(nls.localize('background_task_started')));

// WRONG - Direct call in Effect.gen
yield *
  Effect.gen(function* () {
    await vscode.window.showErrorMessage('Error'); // Type error
  });
```

## Message Types

- **`showInformationMessage`**: Success, info, non-critical
- **`showWarningMessage`**: Warnings, recoverable errors, user decisions
- **`showErrorMessage`**: Errors, failures, critical issues

```typescript
await vscode.window.showInformationMessage(nls.localize('retrieve_completed'));
await vscode.window.showWarningMessage(nls.localize('unsaved_changes'));
await vscode.window.showErrorMessage(nls.localize('retrieve_failed', errorMessage));

// Modal with detail (detail only shown for modal)
await vscode.window.showWarningMessage(
  nls.localize('destructive_action_warning'),
  { modal: true, detail: nls.localize('destructive_action_detail') },
  nls.localize('confirm')
);
```

**Note:** VS Code automatically adds a 'Cancel' button to modal dialogs. Do not add an explicit `nls.localize('cancel_button')` as an item when `modal: true`. Dismissing the dialog (via 'Cancel' or ESC) returns `undefined`.

## MessageOptions and MessageItem

### MessageOptions

- **`modal?: boolean`** - System modal dialog, blocks interaction
- **`detail?: string`** - Extra text (modal only)

### Button Types

Strings or `MessageItem` objects:

```typescript
// String buttons (prefer)
const result = await vscode.window.showWarningMessage(
  nls.localize('confirm_action'),
  nls.localize('yes'),
  nls.localize('no')
);
// result: string | undefined

// MessageItem (for modal ESC handling)
const result = await vscode.window.showWarningMessage(
  nls.localize('confirm_action'),
  { modal: true },
  { title: nls.localize('yes'), isCloseAffordance: false },
  { title: nls.localize('no'), isCloseAffordance: true }
);
// result: MessageItem | undefined
```

**`isCloseAffordance`**: `true` = button handles ESC. Modal-only. Modals auto-add Cancel; use this to control which custom button handles ESC.

## Common Patterns

### Conditional Messages

```typescript
// Fire-and-forget
if (hasErrors) {
  void vscode.window.showErrorMessage(nls.localize('operation_completed_with_errors'));
} else {
  void vscode.window.showInformationMessage(nls.localize('operation_completed_successfully'));
}
```

### User Confirmation (Requires Response)

```typescript
import { Effect } from 'effect';

const confirm =
  yield *
  Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('confirm_destructive_action'),
      nls.localize('proceed_button')
    )
  );

if (confirm === nls.localize('proceed_button')) {
  yield * performDestructiveAction();
}
```

## ESLint Rule

`no-vscode-message-literals` enforces:

- No string literals as first argument
- No template literals unless they contain `nls.localize()` calls
- Applies to `showInformationMessage`, `showWarningMessage`, `showErrorMessage`

Run `npm run lint` before committing.
