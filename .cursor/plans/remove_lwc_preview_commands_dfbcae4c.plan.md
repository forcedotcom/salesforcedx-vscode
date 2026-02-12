---
name: Remove LWC Preview Commands
overview: Remove all four LWC local dev commands (preview, open, start, stop), their services, tests, i18n messages, and package contributions. Anything that becomes orphaned (commandUtils, commandConstants) will be deleted. The preview.typeScriptSupport setting is kept—it is used by SelectLwcComponentType and the LWC language server for component creation and tsconfig, not for the preview commands.
todos: []
isProject: false
---

# Remove LWC Preview Commands and References

## Scope

Remove commands: `sf.lightning.lwc.preview`, `sf.lightning.lwc.open`, `sf.lightning.lwc.start`, `sf.lightning.lwc.stop`.

**Kept:** `salesforcedx-vscode-lwc.preview.typeScriptSupport`—used by [parameterGatherers.ts](packages/salesforcedx-vscode-core/src/commands/util/parameterGatherers.ts) (SelectLwcComponentType for LWC creation) and [lwcServer.ts](packages/salesforcedx-lwc-language-server/src/lwcServer.ts) (tsconfig init). Not tied to the removed commands.

## Files to Delete

| File                                                                                                           | Reason                           |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| [lightningLwcPreview.ts](packages/salesforcedx-vscode-lwc/src/commands/lightningLwcPreview.ts)                 | Preview command impl             |
| [lightningLwcOpen.ts](packages/salesforcedx-vscode-lwc/src/commands/lightningLwcOpen.ts)                       | Open command impl                |
| [lightningLwcStart.ts](packages/salesforcedx-vscode-lwc/src/commands/lightningLwcStart.ts)                     | Start command impl               |
| [lightningLwcStop.ts](packages/salesforcedx-vscode-lwc/src/commands/lightningLwcStop.ts)                       | Stop command impl                |
| [commandUtils.ts](packages/salesforcedx-vscode-lwc/src/commands/commandUtils.ts)                               | Only used by these 4 commands    |
| [commandConstants.ts](packages/salesforcedx-vscode-lwc/src/commands/commandConstants.ts)                       | Only used by devServerService    |
| [devServerService.ts](packages/salesforcedx-vscode-lwc/src/service/devServerService.ts)                        | Only used by these commands      |
| [previewService.ts](packages/salesforcedx-vscode-lwc/src/service/previewService.ts)                            | Only used by lightningLwcPreview |
| [lightningLwcPreview.test.ts](packages/salesforcedx-vscode-lwc/test/jest/commands/lightningLwcPreview.test.ts) | Tests removed command            |
| [devServerService.test.ts](packages/salesforcedx-vscode-lwc/test/jest/service/devServerService.test.ts)        | Tests removed service            |
| [commandConstants.test.ts](packages/salesforcedx-vscode-lwc/test/jest/commands/commandConstants.test.ts)       | Tests removed constants          |

## Files to Modify

### [packages/salesforcedx-vscode-lwc/src/index.ts](packages/salesforcedx-vscode-lwc/src/index.ts)

- Remove imports: `lightningLwcOpen`, `lightningLwcPreview`, `lightningLwcStart`, `lightningLwcStop`, `DevServerService`
- Remove `DevServerService.instance.stopServer()` from `deactivate`
- Remove all 4 command registrations from `registerCommands`

### [packages/salesforcedx-vscode-lwc/src/commands/index.ts](packages/salesforcedx-vscode-lwc/src/commands/index.ts)

- Remove exports for the 4 commands

### [packages/salesforcedx-vscode-lwc/package.json](packages/salesforcedx-vscode-lwc/package.json)

- **contributes.commands:** Remove the 4 command entries (lines 354–368)
- **contributes.menus.editor/context:** Remove sf.lightning.lwc.preview item
- **contributes.menus.editor/title/context:** Remove sf.lightning.lwc.preview item
- **contributes.menus.explorer/context:** Remove sf.lightning.lwc.preview item
- **contributes.menus.commandPalette:** Remove the 4 when clauses for start, stop, open, preview
- **contributes.configuration.properties:** Remove `preview.rememberDevice` and `preview.logLevel`

### [packages/salesforcedx-vscode-lwc/src/messages/i18n.ts](packages/salesforcedx-vscode-lwc/src/messages/i18n.ts)

Remove keys: `lightning_lwc_start_text`, `lightning_lwc_start_not_found`, `lightning_lwc_start_addr_in_use`, `lightning_lwc_inactive_scratch_org`, `lightning_lwc_start_failed`, `lightning_lwc_start_exited`, `lightning_lwc_start_already_running`, `lightning_lwc_stop_text`, `lightning_lwc_stop_not_running`, `lightning_lwc_stop_in_progress`, `lightning_lwc_preview_text`, `lightning_lwc_preview_file_undefined`, `lightning_lwc_preview_file_nonexist`, `lightning_lwc_preview_unsupported`, `lightning_lwc_preview_container_mode`, `lightning_lwc_open_text`, `prompt_option_open_browser`, `prompt_option_restart`, `lightning_lwc_no_mobile_plugin`, `lightning_lwc_platform_selection`, `lightning_lwc_android_target_default`, `lightning_lwc_ios_target_default`, `lightning_lwc_android_target_remembered`, `lightning_lwc_ios_target_remembered`, `lightning_lwc_operation_cancelled`, `lightning_lwc_ios_label`, `lightning_lwc_ios_description`, `lightning_lwc_android_label`, `lightning_lwc_android_description`, `lightning_lwc_android_failure`, `lightning_lwc_ios_failure`, `lightning_lwc_android_start`, `lightning_lwc_ios_start`, `lightning_lwc_browserapp_label`, `lightning_lwc_browserapp_description`, `lightning_lwc_preview_create_virtual_device_label`, `lightning_lwc_preview_create_virtual_device_detail`, `lightning_lwc_preview_select_virtual_device`, `lightning_lwc_preview_select_target_app`, `lightning_lwc_preview_desktop_label`, `lightning_lwc_preview_desktop_description`

### [packages/salesforcedx-vscode-lwc/src/messages/i18n.ja.ts](packages/salesforcedx-vscode-lwc/src/messages/i18n.ja.ts)

Remove same keys (Japanese translations)

### [packages/salesforcedx-vscode-lwc/package.nls.json](packages/salesforcedx-vscode-lwc/package.nls.json)

Remove: `lightning_lwc_open_text`, `lightning_lwc_preview_text`, `lightning_lwc_remember_device_description`, `lightning_lwc_mobile_log_level`, `lightning_lwc_start_text`, `lightning_lwc_stop_text`

### [packages/salesforcedx-vscode-lwc/package.nls.ja.json](packages/salesforcedx-vscode-lwc/package.nls.ja.json)

Remove same keys

## Dependency cleanup

- **rxjs:** Only used by lightningLwcStart. Remove from [package.json](packages/salesforcedx-vscode-lwc/package.json) dependencies.
- Update [.vscodeignore](packages/salesforcedx-vscode-lwc/.vscodeignore) if it has rxjs-specific ignores (lines 11-15 reference rxjs).

## No changes needed

- **salesforcedx-vscode-core** parameterGatherers: keeps `LWC_PREVIEW_TYPESCRIPT_SUPPORT` / `preview.typeScriptSupport`
- **salesforcedx-lwc-language-server** lwcServer + constants: keeps `TYPESCRIPT_SUPPORT_SETTING`
- **E2E tests:** No Playwright specs reference LWC preview commands

## Verification

1. `npm run compile`
2. `npm run lint`
3. `npm run test`
4. `npm run vscode:bundle`
5. `npx knip` — fix any unused exports
6. `npm run check:dupes` — review jscpd-report
