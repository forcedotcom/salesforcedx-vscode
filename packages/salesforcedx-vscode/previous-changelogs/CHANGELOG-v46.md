# 46.17.0 - October 3, 2019

## Fixed

#### salesforcedx-vscode-core

- Remove Internal-development option from the Settings editor ([PR #1689](https://github.com/forcedotcom/salesforcedx-vscode/pull/1689), [Issue #1670](https://github.com/forcedotcom/salesforcedx-vscode/issues/1670), [Issue #1678](https://github.com/forcedotcom/salesforcedx-vscode/issues/1678))

## Added

#### salesforcedx-vscode-core

- Add `SFDX: Diff File Against Org` command to the context menu of metadata in the Explorer ([PR #1688](https://github.com/forcedotcom/salesforcedx-vscode/pull/1688), [Issue #1666](https://github.com/forcedotcom/salesforcedx-vscode/issues/1666))

#### docs

- Update documentation for LWC local development ([PR #1687](https://github.com/forcedotcom/salesforcedx-vscode/pull/1687))

# 46.16.0 - September 26, 2019

## Added

#### salesforcedx-vscode-core

- Update Org Browser to retrieve all instances of a metadata type ([PR #1667](https://github.com/forcedotcom/salesforcedx-vscode/pull/1667))

#### salesforcedx-sobjects-faux-generator, salesforcedx-vscode-apex

- Allow selecting SObject category (custom, standard or all) when running `SFDX: Refresh SObject Definitions` ([PR #1681](https://github.com/forcedotcom/salesforcedx-vscode/pull/1681))

#### docs

- Add retrieve multiple components documentation for [Org Browser](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/org-browser) ([PR #1667](https://github.com/forcedotcom/salesforcedx-vscode/pull/1667))

- Add links at the bottom of the articles to provide feedback and log bugs ([PR #1646](https://github.com/forcedotcom/salesforcedx-vscode/pull/1646))

- Add recommended timeout setting for [Prettier](https://forcedotcom.github.io/salesforcedx-vscode/articles/getting-started/prettier) setup ([PR #1647](https://github.com/forcedotcom/salesforcedx-vscode/pull/1647))

- Add pre-selection settings for [Apex](https://forcedotcom.github.io/salesforcedx-vscode/articles/apex/writing) auto-complete dropdown list ([PR #1665](https://github.com/forcedotcom/salesforcedx-vscode/pull/1665))

- Add [local develop](https://forcedotcom.github.io/salesforcedx-vscode/articles/lwc/localdev) documentation for LWC ([PR #1676](https://github.com/forcedotcom/salesforcedx-vscode/pull/1676)) —Contribution by [@blythesheldon](https://github.com/blythesheldon)

# 46.15.0 - September 19, 2019

### Fixed

#### salesforcedx-vscode-core

- We fixed some minor under-the-hood bugs.

# 46.14.0 - September 12, 2019

## Fixed

#### salesforcedx-vscode-core

- Set global default Dev Hub when running `SFDX: Authorize a Dev Hub`, if not already set ([PR #1614](https://github.com/forcedotcom/salesforcedx-vscode/pull/1614))

## Added

#### docs

- Update info such as redirects and version in [salesforcedx-vscode/docs](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/docs) ([PR #1642](https://github.com/forcedotcom/salesforcedx-vscode/pull/1642))

# 46.13.0 - September 5, 2019

## Fixed

#### salesforcedx-vscode-apex

- Fix syntax highlighting for literal `when` values of String type in Apex switch statement ([PR #1628](https://github.com/forcedotcom/salesforcedx-vscode/pull/1628), [Issue #967](https://github.com/forcedotcom/salesforcedx-vscode/issues/967))

- Fix syntax highlighting for block comments without spaces ([PR #1628](https://github.com/forcedotcom/salesforcedx-vscode/pull/1628), [Issue #921](https://github.com/forcedotcom/salesforcedx-vscode/issues/921))

- Fix syntax highlighting for namespace names in Apex classes ([PR #1628](https://github.com/forcedotcom/salesforcedx-vscode/pull/1628))

#### salesforcedx-vscode-core

- Prevent `SFDX: Diff File Against Org` from appearing in the Command Palette when a non-SFDX project is opened. ([PR #1608](https://github.com/forcedotcom/salesforcedx-vscode/pull/1608), [Issue #1600](https://github.com/forcedotcom/salesforcedx-vscode/issues/1600))

- Update documentation link when guiding users to fix Java configuration ([PR #1602](https://github.com/forcedotcom/salesforcedx-vscode/pull/1602))

## Added

#### docs

- Add troubleshooting steps for setting up Windows PATH variable in [Set Salesforce CLI Path (Windows)](https://forcedotcom.github.io/salesforcedx-vscode/articles/troubleshooting#set-salesforce-cli-path-windows)([PR #1621](https://github.com/forcedotcom/salesforcedx-vscode/pull/1621))

# 46.12.0 - August 29, 2019

## Fixed

#### salesforcedx-vscode-core

- Fix issue with displaying errors in the Problem View when deploying code ([PR #1597](https://github.com/forcedotcom/salesforcedx-vscode/pull/1597)
- Org Browser is now enabled by default. Removed the option to disable this setting through the Settings editor ([PR #1598](https://github.com/forcedotcom/salesforcedx-vscode/pull/1598))

#### docs

- Remove references to enabling Org Browser ([PR #1598](https://github.com/forcedotcom/salesforcedx-vscode/pull/1598))

## Added

#### docs

- Open beta for ([Remote Development](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/remote-development)) that allows you to use a container as a full-featured development environment ([PR #1609](https://github.com/forcedotcom/salesforcedx-vscode/pull/1609))

## 46.11.0 - August 22, 2019

## Fixed

#### salesforcedx-core

- Add custom objects as a bundle for retrieving in the Org Browser ([PR #1569](https://github.com/forcedotcom/salesforcedx-vscode/pull/1569))

#### docs

- Fix documentation link for ([Org Browser](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/org-browser)) in user and workspace settings ([PR #1565](https://github.com/forcedotcom/salesforcedx-vscode/pull/1565))

## Added

#### salesforcedx-core

- Open beta for Diff Plugin that allows you to diff local metadata against an org ([PR #1568](https://github.com/forcedotcom/salesforcedx-vscode/pull/1568))

- Add retrieval of standard objects for the Org Browser ([PR #1571](https://github.com/forcedotcom/salesforcedx-vscode/pull/1571))

#### docs

- Add documentation for ([Source Diff](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/source-diff)) ([PR #1580](https://github.com/forcedotcom/salesforcedx-vscode/pull/1580))

## 46.10.0 - August 15, 2019

## Fixed

#### salesforcedx-core

- Rename `Apex Debug: Configure Exceptions` command to `SFDX: Configure Apex Debug Exceptions` and only enable it when working with a SFDX project ([PR #1533](https://github.com/forcedotcom/salesforcedx-vscode/pull/1533))

## 46.9.0 - August 8, 2019

## Added

#### salesforcedx-utils-vscode

- Use VS Code API to open browser in the host machine when operating in headless environment ([PR #1448](https://github.com/forcedotcom/salesforcedx-vscode/pull/1448))

#### docs

- Include Japanese translation for Salesforce Extensions for VS Code documentation ([PR #1528](https://github.com/forcedotcom/salesforcedx-vscode/pull/1528)) ([Japanese documentation](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/docs/articles-jp))

## 46.8.0 - August 1, 2019

## Fixed

#### salesforcedx-vscode-apex

- Fix NullPointerException in bind expressions when analyzing SOQL query ([PR #1514](https://github.com/forcedotcom/salesforcedx-vscode/pull/1514))

#### salesforcedx-vscode-apex, salesforcedx-vscode-apex-debugger, salesforcedx-vscode-core, salesforcedx-vscode-lightning, salesforcedx-vscode-visualforce

- Remove unnecesssary images to reduce file size of extensions ([PR #1517](https://github.com/forcedotcom/salesforcedx-vscode/pull/1517))

#### salesforcedx-vscode-core

- Fix issue causing the core extension to fail during activation when using a long defaultusername ([PR #1526](https://github.com/forcedotcom/salesforcedx-vscode/pull/1526))

## Added

#### salesforcedx-vscode-core

- Open beta for Org Browser feature. Refer to Org Browser [article](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/org-browser) for setup instructions ([PR #1498](https://github.com/forcedotcom/salesforcedx-vscode/pull/1498))

## 46.7.0 - July 25, 2019

## Fixed

#### salesforcedx-vscode-visualforce

- Update to the latest version of the Visualforce Language Server ([PR #1486](https://github.com/forcedotcom/salesforcedx-vscode/pull/1486))

## 46.6.0 - July 18, 2019

### Fixed

#### salesforcedx-vscode/docs

- Update Apex Refactor: Extract Local Variable documentaion and Apex Refactor: Extract to Local Constant demo gif [Apex Refactoring](https://forcedotcom.github.io/salesforcedx-vscode/articles/apex/refactoring) article ([PR #1484](https://github.com/forcedotcom/salesforcedx-vscode/pull/1484))

#### salesforcedx-vscode-apex

- Remove static modifier for `Extract Constant` when invoked from within an inner class ([PR #1484](https://github.com/forcedotcom/salesforcedx-vscode/pull/1484))

## 46.5.0 - July 11, 2019

### Fixed

#### salesforcedx-vscode/docs

- Update sidebar navigation structure ([PR #1458](https://github.com/forcedotcom/salesforcedx-vscode/pull/1458))
- Update [Java Setup](https://forcedotcom.github.io/salesforcedx-vscode/articles/getting-started/java-setup) article to include Zulu & AdoptOpenJDK setup instructions ([PR #1458](https://github.com/forcedotcom/salesforcedx-vscode/pull/1458))

#### salesforcedx-vscode-core

- Update command context to switch from non-source-tracked to source-tracked org after creating scratch orgs ([PR #1456](https://github.com/forcedotcom/salesforcedx-vscode/pull/1456), [Issue #1449](https://github.com/forcedotcom/salesforcedx-vscode/issues/1449))

- Remove the check for modified document before deploying and also collect more telemetry data for deploy on save feature ([PR #1464](https://github.com/forcedotcom/salesforcedx-vscode/pull/1464), [Issue #1451](https://github.com/forcedotcom/salesforcedx-vscode/issues/1451))

## 46.4.0 - July 3, 2019

### Fixed

#### salesforcedx-vscode-apex

- Fix `Declare missing method` quick fix option crashing when generating a method with nested return type ([PR #1444](https://github.com/forcedotcom/salesforcedx-vscode/pull/1444))

#### salesforcedx-vscode-core

- Update deploy on save to run one deployment at a time, optimize how subsequent saves are queued for deployment, and trigger immediate deployment if there isn't an active one ([PR #1442](https://github.com/forcedotcom/salesforcedx-vscode/pull/1442), [Issue #1155](https://github.com/forcedotcom/salesforcedx-vscode/issues/1155))

### Added

#### salesforcedx-sobjects-faux-generator

- Improve build process to reduce file size of extensions ([PR #1440](https://github.com/forcedotcom/salesforcedx-vscode/pull/1440))

## 46.3.0 - June 27, 2019

### Fixed

#### salesforcedx-vscode-apex

- Extract unary expressions and disable extract for unresolved expression types ([PR #1427](https://github.com/forcedotcom/salesforcedx-vscode/pull/1427))

## 46.2.0 - June 20, 2019

### Fixed

#### salesforcedx-vscode-apex

- Disable quick fix diagnostics for Apex ([PR #1416](https://github.com/forcedotcom/salesforcedx-vscode/pull/1416), [Issue #1405](https://github.com/forcedotcom/salesforcedx-vscode/issues/1405))

#### salesforcedx-vscode-core

- Guide users to authorize a Dev Hub if they attempt to create a scratch org without enabling a Dev Hub ([PR #1384](https://github.com/forcedotcom/salesforcedx-vscode/pull/1384))

### Added

#### salesforcedx-vscode-apex

- Add auto close pair for documentation block comments in Apex ([PR #1349](https://github.com/forcedotcom/salesforcedx-vscode/pull/1349))—Contribution by [@no-stack-dub-sack](https://github.com/no-stack-dub-sack)

## 46.1.0 - June 15, 2019

### Fixed

#### salesforcedx-vscode/docs

- Fix incorrect steps in [Migrate from Force.com IDE to Salesforce Extensions for VS Code](https://forcedotcom.github.io/salesforcedx-vscode/articles/getting-started/migrate-from-forcecom-ide) article ([PR #1380](https://github.com/forcedotcom/salesforcedx-vscode/pull/1380), [Issue #957](https://github.com/forcedotcom/salesforcedx-vscode/issues/957), [Issue #1136](https://github.com/forcedotcom/salesforcedx-vscode/issues/1136))
- Fix broken links in [Migrate from Force.com IDE to Salesforce Extensions for VS Code](https://forcedotcom.github.io/salesforcedx-vscode/articles/getting-started/migrate-from-forcecom-ide) article ([PR #1400](https://github.com/forcedotcom/salesforcedx-vscode/pull/1400))

#### salesforcedx-vscode-apex

- Include return statement in method generated by `Declare missing method` quick fix option ([PR #1391](https://github.com/forcedotcom/salesforcedx-vscode/pull/1391))
- Include squiggly line for `Declare missing method` quick fix option when `salesforcedx-vscode-apex.enable-semantic-errors` is disabled ([PR #1391](https://github.com/forcedotcom/salesforcedx-vscode/pull/1391))
- Update messages to include support of JDK 11 ([PR #1377](https://github.com/forcedotcom/salesforcedx-vscode/pull/1377))

#### salesforcedx-vscode-core

- Increase timeout for updating the command context after creating scratch orgs ([PR #1398](https://github.com/forcedotcom/salesforcedx-vscode/pull/1398))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- Fix Aura and LWC language servers crashing when an old version of Node.js is present ([PR #1401](https://github.com/forcedotcom/salesforcedx-vscode/pull/1401), [Issue #1267](https://github.com/forcedotcom/salesforcedx-vscode/issues/1267))

### Added

#### salesforcedx-vscode/docs

- Apex Refactor: Extract Local Variable, and Apex Refactor: Extract to Local Constant documentation in [Apex Refactoring](https://forcedotcom.github.io/salesforcedx-vscode/articles/apex/refactoring) article ([PR #1388](https://github.com/forcedotcom/salesforcedx-vscode/pull/1388))

#### salesforcedx-vscode-apex

- Apex Refactor: Extract Local Variable ([PR #1391](https://github.com/forcedotcom/salesforcedx-vscode/pull/1391))
- Apex Refactor: Extract to Local Constant ([PR #1391](https://github.com/forcedotcom/salesforcedx-vscode/pull/1391))
