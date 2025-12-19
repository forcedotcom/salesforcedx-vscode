---
name: Move Debugger Stop Command
overview: Move the `sf.debugger.stop` command from salesforcedx-vscode-core to salesforcedx-vscode-apex-debugger, including all related code, translations, and package.json entries.
todos:
  - id: move-debugger-stop-ts
    content: Move debuggerStop.ts to apex-debugger, update imports to use core API pattern
    status: pending
  - id: update-i18n
    content: Move 3 debugger message keys to apex-debugger i18n files (EN + JA)
    status: pending
  - id: update-package-json
    content: Move command/menu entries from core to apex-debugger package.json
    status: pending
  - id: update-package-nls
    content: Move package.nls entries (EN + JA) to apex-debugger
    status: pending
  - id: register-command
    content: Register sf.debugger.stop in apex-debugger index.ts
    status: pending
  - id: cleanup-core
    content: Remove debuggerStop exports and registration from core extension
    status: pending
---

# Move Debugger Stop Command to Apex Debugger Extension

## Files to Modify

### Source Files

**Move command implementation:**

- Move [`packages/salesforcedx-vscode-core/src/commands/debuggerStop.ts`](packages/salesforcedx-vscode-core/src/commands/debuggerStop.ts) to `packages/salesforcedx-vscode-apex-debugger/src/commands/debuggerStop.ts`
- Update imports: `channelService` and `taskViewService` will need to be fetched via the core extension API (same pattern as `bootstrapCmd.ts` uses)

**Remove from core exports:**

- [`packages/salesforcedx-vscode-core/src/commands/index.ts`](packages/salesforcedx-vscode-core/src/commands/index.ts) - remove `debuggerStop` export
- [`packages/salesforcedx-vscode-core/src/index.ts`](packages/salesforcedx-vscode-core/src/index.ts) - remove import and command registration (line 36, 136)

### Translations

**Move to debugger extension i18n:**

- Add to [`packages/salesforcedx-vscode-apex-debugger/src/messages/i18n.ts`](packages/salesforcedx-vscode-apex-debugger/src/messages/i18n.ts):
- `debugger_stop_text`
- `debugger_stop_none_found_text`
- `debugger_query_session_text`

- Add to [`packages/salesforcedx-vscode-apex-debugger/src/messages/i18n.ja.ts`](packages/salesforcedx-vscode-apex-debugger/src/messages/i18n.ja.ts):
- Japanese translations for above keys

**Remove from core i18n:**

- [`packages/salesforcedx-vscode-core/src/messages/i18n.ts`](packages/salesforcedx-vscode-core/src/messages/i18n.ts) - remove 3 debugger keys (lines 140-142)
- [`packages/salesforcedx-vscode-core/src/messages/i18n.ja.ts`](packages/salesforcedx-vscode-core/src/messages/i18n.ja.ts) - remove 3 debugger keys (lines 102-104)

### Package.json Changes

**Add to debugger extension:**

- [`packages/salesforcedx-vscode-apex-debugger/package.json`](packages/salesforcedx-vscode-apex-debugger/package.json):
- Add command entry in `contributes.commands`
- Add commandPalette entry in `contributes.menus.commandPalette`

**Add package.nls entries:**

- [`packages/salesforcedx-vscode-apex-debugger/package.nls.json`](packages/salesforcedx-vscode-apex-debugger/package.nls.json) - add `debugger_stop_text`
- [`packages/salesforcedx-vscode-apex-debugger/package.nls.ja.json`](packages/salesforcedx-vscode-apex-debugger/package.nls.ja.json) - add Japanese translation

**Remove from core:**

- [`packages/salesforcedx-vscode-core/package.json`](packages/salesforcedx-vscode-core/package.json):
- Remove command entry (lines 691-694)
- Remove commandPalette entry (lines 440-443)

- [`packages/salesforcedx-vscode-core/package.nls.json`](packages/salesforcedx-vscode-core/package.nls.json) - remove `debugger_stop_text`
- [`packages/salesforcedx-vscode-core/package.nls.ja.json`](packages/salesforcedx-vscode-core/package.nls.ja.json) - remove Japanese translation

### Register Command in Debugger Extension

- [`packages/salesforcedx-vscode-apex-debugger/src/index.ts`](packages/salesforcedx-vscode-apex-debugger/src/index.ts) - register `sf.debugger.stop` command in `registerCommands()`

## Implementation Notes

Refactor `debuggerStop.ts` to not extend `SfCommandletExecutor` and instead fetch `channelService`/`taskViewService` from core API directly (matching `bootstrapCmd.ts` pattern). The `StopActiveDebuggerSessionExecutor` already overrides `execute()` so this is straightforward.

No e2e tests reference either `sf.debugger.stop` or `sf.debug.isv.bootstrap`.