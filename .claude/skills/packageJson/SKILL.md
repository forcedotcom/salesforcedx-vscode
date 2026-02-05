---
name: packageJson
description: Guidelines for package.json files in packages
---

## Name

any package that's not an npm package should be named @salesforce/foo (whether it actually published to npm or not)
any package that publishes a vscode extension should be named salesforcedx-vscode-foo
don't rename packages, but do tell the user when stuff doesn't match the rules

## types

on an extension, you only need a `types` prop if your extension will be an extensionDependency of some other extension.

probably not necessary for non-extension packages.

## browser

only for web-enabled extensions. Must point to a bundled dist file

## npm packages

packages that publish to npm should have a `files` property in the package.json

## scripts

See [wireit skill](.claude/skills/wireit/SKILL.md)

## dependencies

run `npm install` after changes

use `*` as the version for anything that's another package in this repo
there should be no dependency on salesforcedx-vscode-services. extensionDependency is ok, devDependency is ok.

### devDependencies

packages should not duplicate devDependencies that exist at the top level of the repo.
run `npm install` after changes

## packaging

The `packaging` property is legacy vsce packaging script (modifying pjson during package time). Avoid creating it, we eventually want them all gone.

## vscode "contributes"

### Tips

- anything in `commands` will appear in command palette. If you don't want that, you have to `never` or use some `when` under commandPalette
- commands need a unique ID, 2 extensions contributing the same config will produce a UI warning
- never create a "default:true" boolean configuration (it's hard to override user/workspace)

### ESLint rules

there are some rules to enforce good package.json

- **`package-json-i18n-descriptions`**: Requires `%key%` placeholders (not hardcoded strings) in commands, config, debuggers, views, walkthroughs. Validates keys exist in `package.nls.json`
- **`package-json-icon-paths`**: Validates `commands[*].icon` and `viewsContainers.activitybar[*].icon` have both `light`/`dark` and files exist
- **`package-json-command-refs`**: Menu commands must reference defined commands; reports orphaned commands
- **`package-json-view-refs`**: View IDs must be referenced in menu `when` clauses or `viewsWelcome`; reports orphaned views
