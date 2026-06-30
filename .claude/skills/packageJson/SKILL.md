---
name: packageJson
description: package.json conventions for this repo. Use when editing/reviewing a package.json — name, types, browser, files, dependencies, devDependencies, packaging, scripts, or vscode contributes.
---

## name

- non-npm package → `@salesforce/foo` (whether published or not)
- vscode-extension package → `salesforcedx-vscode-foo`
- don't rename; flag mismatches to the user

## types

- extension: needed only if it's an extensionDependency of another extension
- non-extension package: not needed

## browser

- web-enabled extensions only; must point to a bundled dist file

## files

- packages that publish to npm need a `files` prop

## scripts

See [wireit skill](../wireit/SKILL.md)

## dependencies

- another package in this repo → version `*`
- no dependency on salesforcedx-vscode-services (extensionDependency / devDependency ok)

## devDependencies

- don't duplicate devDependencies already at repo top level

## packaging

- legacy vsce script (mutates pjson at package time); don't create new ones, want them gone

## vscode "contributes"

### tips

- `commands` show in command palette by default; suppress via `never`/`when` under `commandPalette`
- commands need a unique ID; 2 extensions with the same config → UI warning
- never a `default:true` boolean config (hard to override user/workspace)

### ESLint rules

Rules from `@salesforce/eslint-plugin-vscode-extensions` (`packages/eslint-local-rules`; published to npm) enforce good package.json:

- **`package-json-i18n-descriptions`**: Requires `%key%` placeholders (not hardcoded strings) in commands, config, debuggers, views, walkthroughs. Validates keys exist in `package.nls.json`
- **`package-json-extension-icon`**: Published VS Code extensions (salesforcedx-vscode*) must have top-level `icon`; icon path must exist when specified
- **`package-json-icon-paths`**: Validates `commands[*].icon` and `viewsContainers.activitybar[*].icon` have both `light`/`dark` and files exist
- **`package-json-command-refs`**: Menu commands must reference defined commands; reports orphaned commands
- **`package-json-view-refs`**: View IDs must be referenced in menu `when` clauses or `viewsWelcome`; reports orphaned views
