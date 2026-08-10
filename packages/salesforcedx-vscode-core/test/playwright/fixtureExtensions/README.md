# Fixture Extensions

Test-only VS Code extensions loaded by Playwright through `testExtensionPaths`.

## Why

Playwright controls VS Code from the Electron process. It cannot directly access objects inside the extension host. A fixture extension can consume public extension APIs, register test commands, and expose results through workspace files for Playwright assertions.

Keep fixture extensions here instead of adding test-only commands to production extensions.

## `workspaceContext`

- consumes Core's public `WorkspaceContext` API as a separate extension
- captures `onOrgChange` events and synchronous getter values
- writes `.workspace-context-state.json` for the desktop spec
- registers commands that switch the target org through real Services and org-picker paths

The test creates the scratch org before VS Code launches so Core's activation snapshot starts with a resolvable target org.
