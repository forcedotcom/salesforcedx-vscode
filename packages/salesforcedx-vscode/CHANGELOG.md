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
