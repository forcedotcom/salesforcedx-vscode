# 48.6.0 - March 12, 2020

## Fixed

#### docs

- Update Apex content ([PR #1967](https://github.com/forcedotcom/salesforcedx-vscode/pull/1967))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- Prevent extensions activating in non-Salesforce projects ([PR #2070](https://github.com/forcedotcom/salesforcedx-vscode/pull/2070), [Issue #1988](https://github.com/forcedotcom/salesforcedx-vscode/issues/1988), [Issue #2065](https://github.com/forcedotcom/salesforcedx-vscode/issues/2065))

## Added

#### salesforcedx-vscode-core

- Open beta for performance enhancements on single Apex Class deploys. Refer to the [Performance Enhancements](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/perf-enhancements) article. ([PR #2052](https://github.com/forcedotcom/salesforcedx-vscode/pull/2052))

# 48.5.0 - March 5, 2020

## Fixed

#### salesforcedx-vscode-apex

- Remove error from the Apex LSP for completion results of `Page.` ([PR #2054](https://github.com/forcedotcom/salesforcedx-vscode/pull/2054))

## Added

#### docs

- Update contributor info for Prettier Apex plugin [Prettier Apex plugin](https://github.com/dangmai/prettier-plugin-apex) ([PR #2035](https://github.com/forcedotcom/salesforcedx-vscode/pull/2035))-Contribution by [Dang Mai](https://github.com/dangmai)

# 48.4.0 - February 27, 2020

- We did some minor under-the-hood maintenance.

# 48.3.0 - February 24, 2020

## Fixed

#### docs

- Updates to Conflict Detection documentation ([PR #2021](https://github.com/forcedotcom/salesforcedx-vscode/pull/2021))

#### salesforcedx-vscode-core

- Fix ISV Debugger failing with `'Cannot set property 'SFDX_TOOL' of undefined'` ([PR #2027](https://github.com/forcedotcom/salesforcedx-vscode/pull/2027), [Issue #2013](https://github.com/forcedotcom/salesforcedx-vscode/issues/2013))

# 48.2.0 - February 20, 2020

## Fixed

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- Remove automatic configuration of `eslint.nodePath` and `eslintrc.json` ([PR #1771](https://github.com/forcedotcom/salesforcedx-vscode/pull/1771)), ([Issue #1644](https://github.com/forcedotcom/salesforcedx-vscode/issues/1644)), ([Issue #1394](https://github.com/forcedotcom/salesforcedx-vscode/issues/1394)), ([Issue #1049](https://github.com/forcedotcom/salesforcedx-vscode/issues/1049))

#### docs

- Update [Org Browser](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/org-browser) article ([PR #1971](https://github.com/forcedotcom/salesforcedx-vscode/pull/1971))
- Update supported metadata list for [Source Diff](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/source-diff) ([PR #1969](https://github.com/forcedotcom/salesforcedx-vscode/pull/1969))

## Added

#### salesforcedx-vscode-core

- Open beta for conflict detection in manifest operations ([PR #1921](https://github.com/forcedotcom/salesforcedx-vscode/pull/1921)). Refer to [Conflict Detection](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/detect-conflicts) article ([PR #2001](https://github.com/forcedotcom/salesforcedx-vscode/pull/2001))

# 48.1.0 - February 15, 2020

## Fixed

#### docs

- Fix broken links in Lightning and LWC articles ([PR #1987](https://github.com/forcedotcom/salesforcedx-vscode/pull/1987), [PR #1984](https://github.com/forcedotcom/salesforcedx-vscode/pull/1984), [PR #1917](https://github.com/forcedotcom/salesforcedx-vscode/pull/1917))

#### salesforcedx-vscode-apex

- Syntax highlighting for SOQL query clauses ([PR #1973](https://github.com/forcedotcom/salesforcedx-vscode/pull/1973), [Issue #1180](https://github.com/forcedotcom/salesforcedx-vscode/issues/1180))
- Syntax highlighting for multiple string when clauses on Apex switch statements ([PR #1973](https://github.com/forcedotcom/salesforcedx-vscode/pull/1973), [Issue #967](https://github.com/forcedotcom/salesforcedx-vscode/issues/967))
- Restrict completion options to only direct members of a Type or Namespace ([PR #1966](https://github.com/forcedotcom/salesforcedx-vscode/pull/1966))
  ![GIF showing Apex code completion options](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/48.1.0/completion-dot-notation.gif)

#### salesforcedx-vscode-core

- Fix scratch org create command not allowing empty string during input ([PR #1953](https://github.com/forcedotcom/salesforcedx-vscode/pull/1953), [Issue #1929](https://github.com/forcedotcom/salesforcedx-vscode/issues/1929))-Contribution by [@FabienTaillon](https://github.com/FabienTaillon)

## Added

#### salesforcedx-vscode-apex

- Syntax highlighting support for JavaDoc ([PR #1973](https://github.com/forcedotcom/salesforcedx-vscode/pull/1973))-Contribution by [@Codeneos](https://github.com/Codeneos)
- Syntax highlighting support for `inherited sharing` and `transient` Apex keywords ([PR #1973](https://github.com/forcedotcom/salesforcedx-vscode/pull/1973))-Contribution by [@Codeneos](https://github.com/Codeneos)
- Documentation for System class in autocomplete & hover ([PR #1966](https://github.com/forcedotcom/salesforcedx-vscode/pull/1966))
  ![GIF showing Apex code completion with documentation](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/48.1.0/system-class-docs.gif)
