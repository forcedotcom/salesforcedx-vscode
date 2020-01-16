# 47.15.0 - January 16th, 2020

## Fixed

#### salesforcedx-vscode-core

- Fix `source:push` commands to appear correctly when switching to a scratch org using a username instead of an alias ([PR #1862](https://github.com/forcedotcom/salesforcedx-vscode/pull/1862))

- Prevent the Output panel from opening automatically for these commands:
  - `SFDX: Deploy ...` (all deploy options)
  - `SFDX: Push ...` (all push options)
  - `SFDX: Open Default Org`
  - `SFDX: Authorize an Org`
  - `SFDX: Authorize a Dev Hub`
  - `SFDX: Diff File Against Org`
    ([PR #1865](https://github.com/forcedotcom/salesforcedx-vscode/pull/1865), [Issue #1806](https://github.com/forcedotcom/salesforcedx-vscode/issues/1806))

## Added

#### salesforcedx-vscode-apex

- Setting to override default max heap size for Apex Language Server ([PR #1817](https://github.com/forcedotcom/salesforcedx-vscode/pull/1817), [Issue #1626](https://github.com/forcedotcom/salesforcedx-vscode/issues/1626))-Contribution by [@kenhuman](https://github.com/kenhuman)

#### salesforcedx-vscode-core

- Support for running `SFDX: Diff File Against Org` on Custom Labels ([PR #1859](https://github.com/forcedotcom/salesforcedx-vscode/pull/1859))

# 47.14.0 - January 9th, 2020

## Fixed

#### docs

- Fix typo in 'Org Info' command title [Command Reference](forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/vscode-commands)([PR #1854](https://github.com/forcedotcom/salesforcedx-vscode/pull/1854))—Contribution by [@garychenming](https://github.com/garychenming)

# 47.11.0 - December 18th, 2019

## Fixed

#### docs

- Fix links in various doc sections ([PR #1846](https://github.com/forcedotcom/salesforcedx-vscode/pull/1846), [Issue #1825](https://github.com/forcedotcom/salesforcedx-vscode/issues/1825), [Issue #1821](https://github.com/forcedotcom/salesforcedx-vscode/issues/1821), [Issue #1777](https://github.com/forcedotcom/salesforcedx-vscode/issues/1777))

- Fix broken links in [Development Models](https://developer.salesforce.com/tools/vscode/en/user-guide/development-models) and [Default Org](https://developer.salesforce.com/tools/vscode/en/user-guide/default-org) pages ([PR #1844](https://github.com/forcedotcom/salesforcedx-vscode/pull/1844))—Contribution by [@Lafexlos](https://github.com/Lafexlos)

## Added

#### docs

- Update header and footer to match Salesforce developer site ([PR #1814](https://github.com/forcedotcom/salesforcedx-vscode/pull/1814))

# 47.10.0 - December 12, 2019

## Fixed

#### docs

- Fix typo in doc title for [Lightning Web Components](forcedotcom.github.io/salesforcedx-vscode/articles/lwc/writing) ([PR #1830](https://github.com/forcedotcom/salesforcedx-vscode/pull/1830))

#### salesforcedx-vscode-lightning

- Fix indexing in Lightning Web Components ([PR #1836](https://github.com/forcedotcom/salesforcedx-vscode/pull/1836), [Issue #1832](https://github.com/forcedotcom/salesforcedx-vscode/issues/1832))

## Added

#### salesforcedx-vscode-core

- Added Japanese translations for labels and messages ([PR #1551](https://github.com/forcedotcom/salesforcedx-vscode/pull/1551))

# 47.9.0 - December 6, 2019

## Fixed

#### salesforcedx-vscode-lwc

- Fixed LWC local development bugs ([PR #1809](https://github.com/forcedotcom/salesforcedx-vscode/pull/1809)) —Contribution by [@mysticflute](https://github.com/mysticflute)

## Added

#### docs

- Add link to redirect to the LWC [local development](https://forcedotcom.github.io/salesforcedx-vscode/articles/lwc/localdev) docs from the LWC development guide. ([PR #1790](https://github.com/forcedotcom/salesforcedx-vscode/pull/1790)) —Contribution by [@blythesheldon](https://github.com/blythesheldon)

- Add testing support documentation for [LWC](https://forcedotcom.github.io/salesforcedx-vscode/articles/lwc/testing) ([PR #1765](https://github.com/forcedotcom/salesforcedx-vscode/pull/1765)) -Contribution by [@xyc](https://github.com/xyc)

# 47.6.0 - November 14, 2019

## Fixed

#### salesforcedx-vscode-apex

- Remove beta disclaimer from semantic error description of Apex Language Server ([PR #1785](https://github.com/forcedotcom/salesforcedx-vscode/pull/1785))

#### salesforcedx-vscode-core

- Capitalize template options for the `Create Project with Manifest` command ([PR #1775](https://github.com/forcedotcom/salesforcedx-vscode/pull/1775))

#### docs

- Fix broken links for LWC [local development](https://forcedotcom.github.io/salesforcedx-vscode/articles/lwc/localdev) ([PR #1769](https://github.com/forcedotcom/salesforcedx-vscode/pull/1769))

- Fix typo in `SFDX: Refresh SObject Definitions` command ([PR #1772](https://github.com/forcedotcom/salesforcedx-vscode/pull/1772))—Contribution by [@eouellette](https://github.com/eouellette)

## Added

#### salesforcedx-vscode-lwc

- Add server commands to support LWC local development ([PR #1773](https://github.com/forcedotcom/salesforcedx-vscode/pull/1773))

- Add testing support for the LWC Test Explorer ([PR #1758](https://github.com/forcedotcom/salesforcedx-vscode/pull/1758), [Issue #1703](https://github.com/forcedotcom/salesforcedx-vscode/issues/1703))

#### docs

- Remove beta notice for [Org Browser](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/org-browser) and for features mentioned in [Migrate from Force.com IDE](https://forcedotcom.github.io/salesforcedx-vscode/articles/getting-started/migrate-from-forcecom-ide) ([PR #1780](https://github.com/forcedotcom/salesforcedx-vscode/pull/1780))

# 47.5.0 - November 7, 2019

## Fixed

#### salesforcedx-vscode-core

- Update Org Browser to use the current default org and display the correct alias in the org picker ([PR #1763](https://github.com/forcedotcom/salesforcedx-vscode/pull/1763), [Issue #1761](https://github.com/forcedotcom/salesforcedx-vscode/issues/1761))

## Added

#### salesforcedx-vscode-apex

- Autocompletion for constructors when instantiating a new SObject ([PR #1776](https://github.com/forcedotcom/salesforcedx-vscode/pull/1776), [Issue #920](https://github.com/forcedotcom/salesforcedx-vscode/issues/920))

#### docs

- Add code formatting to the command to view LWC [local development](https://developer.salesforce.com/tools/vscode/en/lwc/localdev) help ([PR #1722](https://github.com/forcedotcom/salesforcedx-vscode/pull/1722))

# 47.4.0 - October 31, 2019

## Fixed

#### docs

- Fix layout used by articles ([PR #1734](https://github.com/forcedotcom/salesforcedx-vscode/pull/1734))
- Fixed broken image links ([PR #1753](https://github.com/forcedotcom/salesforcedx-vscode/pull/1753))
- Fix documentation for [Local Development](https://forcedotcom.github.io/salesforcedx-vscode/articles/lwc/localdev) ([PR #1736](https://github.com/forcedotcom/salesforcedx-vscode/pull/1736))

#### salesforcedx-vscode-apex

- Apex Test Sidebar support for namespaces ([PR #1731](https://github.com/forcedotcom/salesforcedx-vscode/pull/1731), [Issue #1701](https://github.com/forcedotcom/salesforcedx-vscode/issues/1701))

#### salesforcedx-vscode-core

- Refresh session token when it expires while running `SFDX: Refresh SObject Definitions` command ([PR #1739](https://github.com/forcedotcom/salesforcedx-vscode/pull/1739), [Issue #1702](https://github.com/forcedotcom/salesforcedx-vscode/issues/1702))

## Added

#### salesforcedx-vscode-core

- Input validations for alias and expiration days when running `SFDX: Create a Default Scratch Org` command ([PR #1729](https://github.com/forcedotcom/salesforcedx-vscode/pull/1729), [Issue #1708](https://github.com/forcedotcom/salesforcedx-vscode/issues/1708))—Contribution by [@maaaaarco](https://github.com/maaaaarco)

# 47.3.0 - October 28, 2019

## Added

#### salesforcedx-vscode-core

- Enable diff for layouts and permission sets in `SFDX: Diff File Against Org` command ([PR #1713](https://github.com/forcedotcom/salesforcedx-vscode/pull/1713))

- Added the `analytics` template option to the `SFDX: Project Create` command ([PR #1730](https://github.com/forcedotcom/salesforcedx-vscode/pull/1730))

#### salesforcedx-vscode-apex

- Open beta for SOQL Language Server that provides code completion suggestions for SOQL queries ([PR #1741](https://github.com/forcedotcom/salesforcedx-vscode/pull/1741))

#### docs

- [Write SOQL Queries](https://forcedotcom.github.io/salesforcedx-vscode/articles/soql/writing) documentation for SOQL language server ([PR #1741](https://github.com/forcedotcom/salesforcedx-vscode/pull/1741))

# 47.2.0 - October 17, 2019

## Fixed

#### docs

- Reorganize user guide section ([PR #1692](https://github.com/forcedotcom/salesforcedx-vscode/pull/1692))

## Added

#### docs

- Add support for navigating between English and Japanese documents ([PR #1698](https://github.com/forcedotcom/salesforcedx-vscode/pull/1698))

# 47.1.0 - October 12, 2019

## Fixed

#### salesforcedx-vscode-core

- We fixed some minor under-the-hood bugs

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

## 45.15.1 - May 17, 2019

### Fixed

#### salesforcedx-vscode-apex

- Apex language server accurately reports the location of a Trigger definition ([PR #1346](https://github.com/forcedotcom/salesforcedx-vscode/pull/1346))

#### salesforcedx-vscode-core

- Fix an edge case where not having an alias for a Dev Hub makes scratch orgs fail to load in the org picker ([PR #1352](https://github.com/forcedotcom/salesforcedx-vscode/pull/1352))

## 45.15.0 - May 16, 2019

### Added

#### salesforcedx-vscode/docs

- Add [Apex Quick Fix](https://forcedotcom.github.io/salesforcedx-vscode/articles/apex/quick-fix) doc re: how to declare missing methods

#### salesforcedx-vscode-apex

- Add `Declare missing method` quick fix option ([PR #1334](https://github.com/forcedotcom/salesforcedx-vscode/pull/1334))

### Fixed

#### salesforcedx-vscode-core

- Update command context to address SFDX commands not showing after creating scratch orgs ([PR #1327](https://github.com/forcedotcom/salesforcedx-vscode/pull/1327), [Issue #1196](https://github.com/forcedotcom/salesforcedx-vscode/issues/1196))
- Remove `No default org set` warning message when opening the org picker ([PR #1329](https://github.com/forcedotcom/salesforcedx-vscode/pull/1329))

#### salesforcedx-vscode-apex

- Cache most recent code compilation when users trigger code action features like Hover, Apex Rename, Go To Definition, Find All References, etc. ([PR #1334](https://github.com/forcedotcom/salesforcedx-vscode/pull/1334))

## 45.14.0 - May 9, 2019

### Added

#### salesforcedx-vscode

- Reference the change log at the top level of the repository ([PR #1304](https://github.com/forcedotcom/salesforcedx-vscode/pull/1304), [Issue #1292](https://github.com/forcedotcom/salesforcedx-vscode/issues/1292))

### Fixed

#### salesforcedx-vscode-core

- When running `SFDX: Turn On Apex Debug Log for Replay Debugger`, show trace flags only for the user that Salesforce CLI is authenticated with ([PR #1315](https://github.com/forcedotcom/salesforcedx-vscode/pull/1315), [Issue #1285](https://github.com/forcedotcom/salesforcedx-vscode/issues/1285), [Issue #1280](https://github.com/forcedotcom/salesforcedx-vscode/issues/1280))
- When running commands to create metadata, show only directories within package directories as available locations ([PR #1288](https://github.com/forcedotcom/salesforcedx-vscode/pull/1288), [Issue #1206](https://github.com/forcedotcom/salesforcedx-vscode/issues/1206))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- Use system version of Node.js when launching Aura Language Server and LWC Language Server ([PR #1305](https://github.com/forcedotcom/salesforcedx-vscode/pull/1305))
- Show method icon for LWC component methods in Lightning Explorer ([PR #1305](https://github.com/forcedotcom/salesforcedx-vscode/pull/1305))
- Display message in Lightning Explorer when no components are found ([PR #1305](https://github.com/forcedotcom/salesforcedx-vscode/pull/1305))
- Filter Aura and LWC system namespaces for unknown workspaces in Lightning Explorer when no custom components are detected ([PR #1305](https://github.com/forcedotcom/salesforcedx-vscode/pull/1305))

## 45.13.0 - May 2, 2019

### Added

#### salesforcedx-vscode-apex

- Add support for Java 11 ([PR #1275](https://github.com/forcedotcom/salesforcedx-vscode/pull/1275))

### Fixed

#### salesforcedx-vscode-core

- Remove references to `workspace.rootPath`, which is deprecated; use `workspace.workspaceFolders` instead ([PR #1260](https://github.com/forcedotcom/salesforcedx-vscode/pull/1260))

## 45.12.1 - April 25, 2019

### Fixed

#### salesforcedx-vscode-apex

- Enable Apex debuggers to get the latest status from Apex Language Server ([PR #1290](https://github.com/forcedotcom/salesforcedx-vscode/pull/1290), [Issue #1289](https://github.com/forcedotcom/salesforcedx-vscode/issues/1289))

## 45.12.0 - April 25, 2019

### Added

#### salesforcedx-vscode/docs

- Update Prettier installation instructions to use the latest release ([PR #1263](https://github.com/forcedotcom/salesforcedx-vscode/pull/1263))

#### salesforcedx-vscode-core

- Show which default username is in use ([PR #1259](https://github.com/forcedotcom/salesforcedx-vscode/pull/1259))
- Use the `standard` template value (`sfdx force:project:create --template standard`) when creating projects ([PR #1234](https://github.com/forcedotcom/salesforcedx-vscode/pull/1234), [Issue #1090](https://github.com/forcedotcom/salesforcedx-vscode/issues/1090)):
  - `SFDX: Create Project`
  - `SFDX: Create Project with Manifest`
  - `SFDX: Create and Set Up Project for ISV Debugger`

### Fixed

#### salesforcedx-vscode-apex

- Activate Apex extension even when Java is misconfigured ([PR #1261](https://github.com/forcedotcom/salesforcedx-vscode/pull/1261), [Issue #809](https://github.com/forcedotcom/salesforcedx-vscode/issues/809))
- Handle Apex Language Server’s sObject checks on Windows ([PR #1276](https://github.com/forcedotcom/salesforcedx-vscode/pull/1276), [Issue #1269](https://github.com/forcedotcom/salesforcedx-vscode/issues/1269), [Issue #1170](https://github.com/forcedotcom/salesforcedx-vscode/issues/1170))
- Change name of setting that enables sObject refresh on startup to `salesforcedx-vscode-apex.enable-sobject-refresh-on-startup` ([PR #1236](https://github.com/forcedotcom/salesforcedx-vscode/pull/1236))

#### salesforcedx-vscode-core

- Support uppercase package names in `sfdx-project.json` ([PR #1277](https://github.com/forcedotcom/salesforcedx-vscode/pull/1277), [Issue #1266](https://github.com/forcedotcom/salesforcedx-vscode/issues/1266))

#### salesforcedx-vscode-lightning

- Start Lightning Language Server asynchronously ([PR #1253](https://github.com/forcedotcom/salesforcedx-vscode/pull/1253))
- Support different extension activation modes: `always`, `autodetect`, and `off` ([PR #1253](https://github.com/forcedotcom/salesforcedx-vscode/pull/1253))

## 45.10.0 - April 10, 2019

### Fixed

#### salesforcedx-vscode-apex

- Fix NullPointerException when Apex language server processes references ([PR #1245](https://github.com/forcedotcom/salesforcedx-vscode/pull/1245))

#### salesforcedx-vscode-apex-debugger, salesforcedx-vscode-apex-replay-debugger

- Update dependency to address security vulnerability ([PR #1230](https://github.com/forcedotcom/salesforcedx-vscode/pull/1230))

#### salesforcedx-vscode-core

- Expose SFDX: Create commands only on source files’ default directories when right-clicking folders in the File Explorer ([PR #1235](https://github.com/forcedotcom/salesforcedx-vscode/pull/1235), [Issue #852](https://github.com/forcedotcom/salesforcedx-vscode/issues/852)):
  - `SFDX: Create Apex Class`
  - `SFDX: Create Apex Trigger`
  - `SFDX: Create Visualforce Component`
  - `SFDX: Create Visualforce Page`

#### salesforcedx-vscode-lightning

- Stop extension from overwriting `settings.json` contents ([PR #1254](https://github.com/forcedotcom/salesforcedx-vscode/pull/1254), [Issue #1210](https://github.com/forcedotcom/salesforcedx-vscode/issues/1210))

## 45.9.0 - April 4, 2019

### Added

#### salesforcedx-vscode/docs

- Add [Set Up the Prettier Code Formatter for Salesforce Projects](https://forcedotcom.github.io/salesforcedx-vscode/articles/getting-started/prettier) article ([PR #1208](https://github.com/forcedotcom/salesforcedx-vscode/pull/1208))
- Show the statuses of the project’s dependencies ([PR #1218](https://github.com/forcedotcom/salesforcedx-vscode/pull/1218))

#### salesforcedx-vscode-core

- Include org development commands in command palette ([PR #1190](https://github.com/forcedotcom/salesforcedx-vscode/pull/1190), [Issue #662](https://github.com/forcedotcom/salesforcedx-vscode/issues/662), [Issue #918](https://github.com/forcedotcom/salesforcedx-vscode/issues/918)):
  - `SFDX: Deploy Source in Manifest to Org`
  - `SFDX: Retrieve Source in Manifest from Org`
  - `SFDX: Delete from Project and Org`
  - `SFDX: Deploy Source to Org`
  - `SFDX: Retrieve Source From Org`

### Fixed

#### salesforcedx-vscode-apex

- Add missing closing bracket on `testMethod` Apex snippet ([PR #1219](https://github.com/forcedotcom/salesforcedx-vscode/pull/1219))—Contribution by [@1ktribble](https://github.com/1ktribble)

#### salesforcedx-vscode-core

- Add a menu for selecting an output directory for commands that create metadata from a template; create the `default` directory, if it doesn’t exist, when running these commands ([PR #1187](https://github.com/forcedotcom/salesforcedx-vscode/pull/1187), [Issue #852](https://github.com/forcedotcom/salesforcedx-vscode/issues/852), [Issue #998](https://github.com/forcedotcom/salesforcedx-vscode/issues/998))
- Update command execution telemetry when directory type is included ([PR #1225](https://github.com/forcedotcom/salesforcedx-vscode/pull/1225))

## 45.8.0 - March 28, 2019

### Added

#### salesforcedx-vscode-lightning

- Add Aura Language Server: Support Go to Definition, autocompletion, and showing documentation on hover ([PR #1183](https://github.com/forcedotcom/salesforcedx-vscode/pull/1183))

### Fixed

#### salesforcedx-vscode-apex

- Fix threading issues in Apex Language Server’s CompilerService ([PR #1173](https://github.com/forcedotcom/salesforcedx-vscode/pull/1173), [Issue #867](https://github.com/forcedotcom/salesforcedx-vscode/issues/867))

#### salesforcedx-vscode-core

- Prevent Output panel from stealing focus during command execution ([PR #1181](https://github.com/forcedotcom/salesforcedx-vscode/pull/1181), [Issue #1110](https://github.com/forcedotcom/salesforcedx-vscode/issues/1110))

#### salesforcedx-vscode-lightning

- Remove deprecated SLDS linter ([PR #1191](https://github.com/forcedotcom/salesforcedx-vscode/pull/1191))

## 45.7.0 - March 21, 2019

### Added

#### salesforcedx-vscode/docs

- Add troubleshooting information about Apex compilation during deployments ([PR #1150](https://github.com/forcedotcom/salesforcedx-vscode/pull/1150))

#### salesforcedx-vscode-apex

- Visually display Apex code coverage ([PR #1145](https://github.com/forcedotcom/salesforcedx-vscode/pull/1145), [Issue #973](https://github.com/forcedotcom/salesforcedx-vscode/issues/973))
- Collect telemetry data for Apex Language Server ([PR #1148](https://github.com/forcedotcom/salesforcedx-vscode/pull/1148))

#### salesforcedx-vscode-lwc

- Include execution time in telemetry for `SFDX: Create Lightning Web Component` command ([PR #1154](https://github.com/forcedotcom/salesforcedx-vscode/pull/1154))

### Fixed

#### salesforcedx-vscode-apex

- Improve Apex Tests sidebar performance when refreshing tests ([PR #1144](https://github.com/forcedotcom/salesforcedx-vscode/pull/1144), [Issue #1103](https://github.com/forcedotcom/salesforcedx-vscode/issues/1103))
- Update Apex snippets to respect user’s indentation configuration ([PR #1158](https://github.com/forcedotcom/salesforcedx-vscode/pull/1158), [Issue #1152](https://github.com/forcedotcom/salesforcedx-vscode/issues/1152))—Contribution by [@Gkupce](https://github.com/Gkupce)

#### salesforcedx-vscode-core

- Improve performance for [org picker and `SFDX: Set a Default Org` command](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/default-org) ([PR #1139](https://github.com/forcedotcom/salesforcedx-vscode/pull/1139), [Issue #1007](https://github.com/forcedotcom/salesforcedx-vscode/issues/1007))

## 45.6.0 - March 14, 2019

### Added

#### salesforcedx-vscode-core

- Display `source:push` error messages in Problems view ([PR #1117](https://github.com/forcedotcom/salesforcedx-vscode/pull/1117))
- Add CPUs and total system memory information to telemetry ([PR #1119](https://github.com/forcedotcom/salesforcedx-vscode/pull/1119))

### Fixed

#### salesforcedx-vscode-apex

- Enable `SFDX: Re-Run Last Invoked Apex Test Class` and `SFDX: Re-Run Last Invoked Apex Test Method` commands to work with Apex Tests sidebar ([PR #1135](https://github.com/forcedotcom/salesforcedx-vscode/pull/1135), [Issue #962](https://github.com/forcedotcom/salesforcedx-vscode/issues/962))

#### salesforcedx-vscode-core

- Enabling or disabling push-or-deploy-on-save feature does not require reloading VS Code ([PR #1129](https://github.com/forcedotcom/salesforcedx-vscode/pull/1129))

## 45.5.0 - March 7, 2019

### Added

#### salesforcedx-vscode-apex

- Show Apex block comment information when hovering on symbols ([PR #1106](https://github.com/forcedotcom/salesforcedx-vscode/pull/1106))

### Fixed

#### salesforcedx-vscode/docs

- Fix typos in Org Development Model documentation ([PR #1089](https://github.com/forcedotcom/salesforcedx-vscode/pull/1089))—Contribution by [@tet3](https://github.com/tet3)

#### salesforcedx-vscode-apex

- Fix Apex Language Server performance issues that caused high CPU load:
  - Handle document change requests queuing up ([PR #1086](https://github.com/forcedotcom/salesforcedx-vscode/pull/1086), [Issue #1047](https://github.com/forcedotcom/salesforcedx-vscode/issues/1047))
  - Compile only necessary files when running a refactoring operation ([PR #1118](https://github.com/forcedotcom/salesforcedx-vscode/pull/1118), [Issue #1100](https://github.com/forcedotcom/salesforcedx-vscode/issues/1100))
- Include a link to our documentation in the information messages that appear when Java isn’t set up correctly ([PR #1116](https://github.com/forcedotcom/salesforcedx-vscode/pull/1116))

#### salesforcedx-vscode-core

- Remove information message asking to allow configuraton changes on terminal when opening a new Salesforce DX project ([PR #1062](https://github.com/forcedotcom/salesforcedx-vscode/pull/1062))
- Display human-readable `source:deploy` messages in Output view ([PR #1085](https://github.com/forcedotcom/salesforcedx-vscode/pull/1085))
- Allow extensions to activate when Salesforce CLI isn’t installed ([PR #1107](https://github.com/forcedotcom/salesforcedx-vscode/pull/1107))

## 45.3.0 - February 22, 2019

### Added

#### salesforcedx-vscode-core

- Add `salesforcedx-vscode-core.enable-sobject-refresh-on-startup` setting to control initial refresh of sObject definitions ([PR #1079](https://github.com/forcedotcom/salesforcedx-vscode/pull/1079))

### Fixed

#### salesforcedx-vscode

- Update search and analytics on the [documentation site](https://forcedotcom.github.io/salesforcedx-vscode) ([PR #1074](https://github.com/forcedotcom/salesforcedx-vscode/pull/1074))

#### salesforcedx-vscode-core

- Change the telemetry documentation URL to the documentation site’s [FAQ: Telemetry](https://forcedotcom.github.io/salesforcedx-vscode/articles/faq/telemetry) article’s URL ([PR #1059](https://github.com/forcedotcom/salesforcedx-vscode/pull/1059))

#### salesforcedx-vscode-apex

- Fix Apex Language Server performance issue that caused high CPU load: Run `updateTypeInfos` only on latest doc version ([PR #1093](https://github.com/forcedotcom/salesforcedx-vscode/pull/1093), [Issue #1047](https://github.com/forcedotcom/salesforcedx-vscode/issues/1047))

## 45.2.0 - February 14, 2019

### Added

#### salesforcedx-vscode

- Replace the project’s wiki and the docs on the extensions’ Visual Studio Marketplace pages with a new [GitHub Pages site](https://forcedotcom.github.io/salesforcedx-vscode) ([PR #853](https://github.com/forcedotcom/salesforcedx-vscode/pull/853))

#### salesforcedx-vscode-apex

- Update standard Apex symbols to API v45.0 ([PR #1037](https://github.com/forcedotcom/salesforcedx-vscode/pull/1037))

### Fixed

#### salesforcedx-vscode-apex

- Prevent using Apex Refactor: Rename on `System` symbols ([PR #1037](https://github.com/forcedotcom/salesforcedx-vscode/pull/1037))

## 45.1.0 - February 9, 2019

### Added

#### salesforcedx-vscode

- Include LWC extension in Salesforce Extension Pack ([PR #1015](https://github.com/forcedotcom/salesforcedx-vscode/pull/1015))

#### salesforcedx-vscode-apex

- Apex Refactor: Rename is generally available ([PR #984](https://github.com/forcedotcom/salesforcedx-vscode/pull/984), [PR #980](https://github.com/forcedotcom/salesforcedx-vscode/pull/980))

#### salesforcedx-vscode-core

- Change your default org from the VS Code footer ([PR #890](https://github.com/forcedotcom/salesforcedx-vscode/pull/890), [Issue #944](https://github.com/forcedotcom/salesforcedx-vscode/issues/944))
- Automatically refresh sObject definitions on extension activation ([PR #986](https://github.com/forcedotcom/salesforcedx-vscode/pull/986))
- Include execution time in command execution telemetry ([PR #989](https://github.com/forcedotcom/salesforcedx-vscode/pull/989))
- Add syntax highlighting for Einstein Analytics and IoT files ([PR #1003](https://github.com/forcedotcom/salesforcedx-vscode/pull/1003), [Issue #1002](https://github.com/forcedotcom/salesforcedx-vscode/issues/1002))

### Fixed

#### salesforcedx-vscode-apex

- Update test run icon in Apex Tests sidebar to be consistent with official VS Code icons ([PR #988](https://github.com/forcedotcom/salesforcedx-vscode/pull/988))
- Prevent Apex Language Server from running in anonymous Apex (`.apex`) files ([PR #1001](https://github.com/forcedotcom/salesforcedx-vscode/pull/1001), [Issue #929](https://github.com/forcedotcom/salesforcedx-vscode/issues/929))
- Fix Apex rename and codelens exceptions and update rename error messages ([PR #1014](https://github.com/forcedotcom/salesforcedx-vscode/pull/1014))

#### salesforcedx-vscode-core

- Speed up extension activation time ([PR #889](https://github.com/forcedotcom/salesforcedx-vscode/pull/889))
- Make push-or-deploy-on-save feature respect new `packageDirectories` values added to `sfdx-project.json` ([PR #987](https://github.com/forcedotcom/salesforcedx-vscode/pull/987))
- Keep errors in Problems view until next deployment ([PR #1016](https://github.com/forcedotcom/salesforcedx-vscode/pull/1016))

## 44.18.0 - January 31, 2019

### Fixed

#### salesforcedx-vscode-core

- Make push-or-deploy-on-save feature less overzealous, by pushing or deploying files only when they are saved ([PR #895](https://github.com/forcedotcom/salesforcedx-vscode/pull/895), [Issue #883](https://github.com/forcedotcom/salesforcedx-vscode/issues/883))

#### salesforcedx-vscode-apex

- Fix Apex Language Server to make it update stale references in files that have errors when the files are edited ([PR #905](https://github.com/forcedotcom/salesforcedx-vscode/pull/905))

## 44.17.0 - January 24, 2019

### Fixed

#### salesforcedx-vscode-core

- We fixed some minor under-the-hood bugs.

## 44.16.0 - January 17, 2019

### Added

#### salesforcedx-vscode-core

- Add username to Apex debug log entry list ([PR #864](https://github.com/forcedotcom/salesforcedx-vscode/pull/864), [Issue #834](https://github.com/forcedotcom/salesforcedx-vscode/issues/834))—Contribution by [@maaaaarco](https://github.com/maaaaarco)

### Fixed

#### salesforcedx-vscode-core

- Handle errors during extension activation that caused SFDX commands to fail when executed ([PR #868](https://github.com/forcedotcom/salesforcedx-vscode/pull/868), [Issue #742](https://github.com/forcedotcom/salesforcedx-vscode/issues/742))

## 44.15.0 - January 10, 2019

### Added

#### salesforcedx-vscode

- Add [Code of Conduct](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/CODE_OF_CONDUCT.md) ([PR #846](https://github.com/forcedotcom/salesforcedx-vscode/pull/846))

#### salesforcedx-vscode-apex

- Display results in Apex Tests sidebar for tests executed using code lens, Apex Tests sidebar, or command palette commands ([PR #800](https://github.com/forcedotcom/salesforcedx-vscode/pull/800))

- Show different options in Apex Tests sidebar’s right-click menu based on test status: **Go to Definition** for passing tests or **Display Error** for failing tests ([PR #811](https://github.com/forcedotcom/salesforcedx-vscode/pull/811))

#### salesforcedx-vscode-core

- Allow selecting a domain (production, sandbox, or custom) when running `SFDX: Authorize an Org` ([PR #818](https://github.com/forcedotcom/salesforcedx-vscode/pull/818), [Issue #610](https://github.com/forcedotcom/salesforcedx-vscode/issues/610))

- Push or deploy code on save when `salesforcedx-vscode-core.push-or-deploy-on-save.enabled` setting is `true` ([PR #822](https://github.com/forcedotcom/salesforcedx-vscode/pull/822), [Issue #577](https://github.com/forcedotcom/salesforcedx-vscode/issues/577), [Issue #662](https://github.com/forcedotcom/salesforcedx-vscode/issues/662))

### Fixed

#### salesforcedx-vscode-core

- Enable multi-line SOQL query selection for `SFDX: Execute SOQL Query with Currently Selected Text` ([PR #833](https://github.com/forcedotcom/salesforcedx-vscode/pull/833/files), [Issue #816](https://github.com/forcedotcom/salesforcedx-vscode/issues/816))—Contribution by [@boxfoot](https://github.com/boxfoot)

- Fix syntax highlighting for manifest XML files ([PR #823](https://github.com/forcedotcom/salesforcedx-vscode/pull/823))

## 44.11.0 - December 13, 2018

### Added

#### salesforcedx-vscode-core

- Two new commands for working with manifest files (such as `package.xml`): `SFDX: Deploy Source in Manifest to Org` and `SFDX: Retrieve Source in Manifest from Org` ([PR #795](https://github.com/forcedotcom/salesforcedx-vscode/pull/795))

- Set the duration of a scratch org when running `SFDX: Create a Default Scratch Org` ([PR #799](https://github.com/forcedotcom/salesforcedx-vscode/pull/799), [Issue #768](https://github.com/forcedotcom/salesforcedx-vscode/issues/768))—Contribution by [@renatoliveira](https://github.com/renatoliveira)

- Include timestamps for command executions in Output view ([PR #780](https://github.com/forcedotcom/salesforcedx-vscode/pull/780), [Issue #759](https://github.com/forcedotcom/salesforcedx-vscode/issues/759))

### Fixed

#### salesforcedx-vscode-apex

- Update Apex Test sidebar to use **Run Tests** hover text for whole classes ([PR #805](https://github.com/forcedotcom/salesforcedx-vscode/pull/805))

## 44.10.0 - December 6, 2018

### Fixed

#### salesforcedx-vscode-apex

- Alphabetically sort test classes displayed in Apex Tests sidebar ([PR #782](https://github.com/forcedotcom/salesforcedx-vscode/pull/782), [Issue #605](https://github.com/forcedotcom/salesforcedx-vscode/issues/605))—Contribution by [@0ff](https://github.com/0ff)

## 44.9.0 - November 29, 2018

### Fixed

#### salesforcedx-vscode-core

- Show better error message for `SFDX: Turn On Apex Debug Log for Replay Debugger` when updating a trace flag that is missing a debug level ([PR #765](https://github.com/forcedotcom/salesforcedx-vscode/pull/765), [Issue #761](https://github.com/forcedotcom/salesforcedx-vscode/issues/761))

## 44.8.0 - November 22, 2018

### Fixed

#### salesforcedx-vscode-core

- Fix start date when creating or updating a trace flag for the command `SFDX: Turn On Apex Debug Log for Replay Debugger` ([PR #743](https://github.com/forcedotcom/salesforcedx-vscode/pull/743), [Issue #710](https://github.com/forcedotcom/salesforcedx-vscode/issues/710))

#### salesforcedx-vscode-apex

- Fix `NullPointerException` in Apex Language Server that sometimes occurred during initialization ([PR #760](https://github.com/forcedotcom/salesforcedx-vscode/pull/760))

## 44.7.0 - November 15, 2018

### Added

#### salesforcedx-vscode-apex

- Beta for Apex Refactor: Rename capabilities ([PR #681](https://github.com/forcedotcom/salesforcedx-vscode/pull/681), [Apex Refactor: Rename (Beta)](https://forcedotcom.github.io/salesforcedx-vscode/articles/apex/refactoring))

### Fixed

#### salesforcedx-vscode-apex-debugger

- Update Apex Interactive Debugger initialization ([PR #732](https://github.com/forcedotcom/salesforcedx-vscode/pull/732), [PR #754](https://github.com/forcedotcom/salesforcedx-vscode/pull/754), [Issue #722](https://github.com/forcedotcom/salesforcedx-vscode/issues/722))

## 44.6.1 - November 9, 2018

### Fixed

#### salesforcedx-vscode-core

- Update API used for workspace path for commands `SFDX: Deploy This Source to Org` and `SFDX: Deploy Source to Org` ([PR #738](https://github.com/forcedotcom/salesforcedx-vscode/pull/738), [Issue #737](https://github.com/forcedotcom/salesforcedx-vscode/issues/737))

## 44.6.0 - November 8, 2018

### Added

#### salesforcedx-vscode-core

- Include deployment errors in the Problems view for `SFDX: Deploy This Source to Org` and `SFDX: Deploy Source to Org` commands ([PR #717](https://github.com/forcedotcom/salesforcedx-vscode/pull/717), [Issue #588](https://github.com/forcedotcom/salesforcedx-vscode/issues/588))—Contribution by [@ChuckJonas](https://github.com/ChuckJonas)
- Validate JSON schema for `sfdx-project.json` and `project-scratch-def.json` files ([PR #719](https://github.com/forcedotcom/salesforcedx-vscode/pull/719), [Issue #287](https://github.com/forcedotcom/salesforcedx-vscode/issues/287))

## 44.5.0 - November 1, 2018

### Fixed

#### salesforcedx-vscode-apex-replay-debugger

- We fixed some minor under-the-hood bugs.

## 44.4.0 - October 25, 2018

### Fixed

#### salesforcedx-vscode-apex

- Report accurate test results in Apex Tests sidebar ([PR #683](https://github.com/forcedotcom/salesforcedx-vscode/pull/683), [Issue #645](https://github.com/forcedotcom/salesforcedx-vscode/issues/645))

#### salesforcedx-vscode

- Fix typo in scripts ([PR #682](https://github.com/forcedotcom/salesforcedx-vscode/pull/682))—Contribution by [@hasantayyar](https://github.com/hasantayyar)

## 44.3.0 - October 18, 2018

### Fixed

#### salesforcedx-vscode-apex

- We fixed some minor under-the-hood bugs.

## 44.2.0 - October 13, 2018

### Added

#### salesforcedx-vscode-core

- Open beta for Org Development commands ([PR #669](https://github.com/forcedotcom/salesforcedx-vscode/pull/669), _Salesforce Winter ’19 Release Notes_: [Develop Against Any Org in Visual Studio Code (Beta)](https://releasenotes.docs.salesforce.com/en-us/winter19/release-notes/rn_vscode_any_org.htm))

#### salesforcedx-vscode-apex-replay-debugger

- Apex Replay Debugger generally available ([PR #664](https://github.com/forcedotcom/salesforcedx-vscode/pull/664), _Salesforce Winter ’19 Release Notes_: [Debug All Your Orgs for Free with Apex Replay Debugger (Generally Available)](https://releasenotes.docs.salesforce.com/en-us/winter19/release-notes/rn_vscode_replay_debugger.htm))

### Fixed

#### salesforcedx-vscode-apex-replay-debugger

- Fix incorrect variable values when parameters have the same names as the object properties ([PR #663](https://github.com/forcedotcom/salesforcedx-vscode/pull/663))
- Correctly parse values for circular references ([PR #659](https://github.com/forcedotcom/salesforcedx-vscode/pull/659))
- Correctly display static variables after processing breakpoints ([PR #657](https://github.com/forcedotcom/salesforcedx-vscode/pull/657))
- Fix trace flag creation when running `SFDX: Turn On Apex Debug Log for Replay Debugger` with non-scratch orgs ([PR #656](https://github.com/forcedotcom/salesforcedx-vscode/pull/656))

## 43.19.0 - October 4, 2018

### Fixed

#### salesforcedx-vscode-apex

- Fix test execution from Apex Tests sidebar so it shows an error message when the user is not authenticated ([PR #652](https://github.com/forcedotcom/salesforcedx-vscode/pull/652))
- Update telemetry to track extension activation time, Apex LSP errors, and startup time ([PR #646](https://github.com/forcedotcom/salesforcedx-vscode/pull/646))

## 43.17.0 - September 20, 2018

### Fixed

#### salesforcedx-vscode-apex

- Fix `NullPointerException` in Apex Language Server that could occur when using Go To Definition ([PR #642](https://github.com/forcedotcom/salesforcedx-vscode/pull/642))

#### salesforcedx-vscode-core

- Change default scratch org alias to project folder name ([PR #620](https://github.com/forcedotcom/salesforcedx-vscode/pull/620))

#### salesforcedx-vscode-lightning

- Fix Lightning component syntax highlighting ([PR #637](https://github.com/forcedotcom/salesforcedx-vscode/pull/637))

## 43.16.0 - September 13, 2018

### Fixed

#### salesforcedx-vscode-apex-debugger, salesforcedx-vscode-apex-replay-debugger

- Prevent Apex Debugger and Apex Replay Debugger from activating in projects without an `sfdx-project.json` file ([PR #631](https://github.com/forcedotcom/salesforcedx-vscode/pull/631))

#### salesforcedx-vscode

- Update documentation ([PR #628](https://github.com/forcedotcom/salesforcedx-vscode/pull/628))
- Update commands and messages that apply to both scratch orgs and the org development model ([PR #621](https://github.com/forcedotcom/salesforcedx-vscode/pull/621))

#### salesforcedx-vscode-core

- Fix error output when successfully running `SFDX: Execute Anonymous Apex with Currently Selected Text` and `SFDX: Execute Anonymous Apex with Editor Contents` commands ([PR #617](https://github.com/forcedotcom/salesforcedx-vscode/pull/617))

### Added

#### salesforcedx-vscode-apex

- Add folding regions for Apex code ([PR #630](https://github.com/forcedotcom/salesforcedx-vscode/pull/630))

## 43.15.0 - September 6, 2018

### Fixed

#### salesforcedx-vscode

- Update telemetry dialog text with additional opt-out link ([PR #608](https://github.com/forcedotcom/salesforcedx-vscode/pull/608))

## 43.14.0 - August 30, 2018

### Added

#### salesforcedx-vscode-replay-debugger

- Support telemetry for capturing high-level execution details and errors ([PR #599](https://github.com/forcedotcom/salesforcedx-vscode/pull/599))

### Fixed

#### salesforce-vscode-apex

- Fix `NullPointerException` when Apex Language Server initializes ([PR #598](https://github.com/forcedotcom/salesforcedx-vscode/pull/598))

## 43.13.0 - August 23, 2018

### Added

#### salesforcedx-vscode-apex

- [Apex Tests sidebar](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/packages/salesforcedx-vscode-core/README.md#explore-your-apex-tests) allows you to view, run, and interact with the Apex tests in your project ([PR #552](https://github.com/forcedotcom/salesforcedx-vscode/pull/552))

#### salesforcedx-vscode

- Support telemetry for commands in Salesforce extensions ([PR #549](https://github.com/forcedotcom/salesforcedx-vscode/pull/549))

## 43.12.0 - August 16, 2018

### Fixed

#### salesforcedx-vscode

- We fixed some minor under-the-hood bugs.

## 43.11.0 - August 9, 2018

### Fixed

#### salesforcedx-vscode-core

- Prevent `Path does not exist` errors by changing the way that the extension opens folders ([PR #545](https://github.com/forcedotcom/salesforcedx-vscode/pull/545))

### Added

#### salesforcedx-vscode

- Support telemetry in activation/deactivation of Salesforce extensions ([PR #511](https://github.com/forcedotcom/salesforcedx-vscode/pull/511))

## 43.10.0 - August 2, 2018

### Fixed

#### salesforcedx-vscode

- Document how to retrieve code coverage results ([PR #533](https://github.com/forcedotcom/salesforcedx-vscode/pull/533))
- Use ProgressNotification to show SFDX command execution progress in a message box instead of in the footer ([PR #536](https://github.com/forcedotcom/salesforcedx-vscode/pull/536))

## 43.8.0 - July 19, 2018

### Fixed

#### salesforcedx-vscode

- We fixed some minor under-the-hood bugs.

## 43.6.0 - July 5, 2018

### Fixed

#### salesforcedx-vscode-core

- ISV Customer Debugger file watcher looks only for `.sfdx/sfdx-config.json` changes ([PR #509](https://github.com/forcedotcom/salesforcedx-vscode/pull/509))

## 43.5.0 - June 28, 2018

### Fixed

#### salesforcedx-vscode-core

- Guard against salesforcedx-vscode-core failing to launch if there’s an issue with configuring ISV Customer Debugger ([PR #497](https://github.com/forcedotcom/salesforcedx-vscode/pull/497))

### Added

#### salesforcedx-vscode-apex

- Syntax highlighting for merge function and Apex switch statements ([PR #503](https://github.com/forcedotcom/salesforcedx-vscode/pull/503))

## 43.4.0 - June 21, 2018

### Added

#### salesforcedx-vscode-apex

- Apex code snippets for use in autocompletion and when running **Insert Snippet** ([PR #464](https://github.com/forcedotcom/salesforcedx-vscode/pull/464), [PR #487](https://github.com/forcedotcom/salesforcedx-vscode/pull/487))

#### salesforcedx-vscode-core

- `salesforcedx-vscode-core.retrieve-test-code-coverage` setting to enable code coverage calculation and retrieval when running Apex tests ([PR #482](https://github.com/forcedotcom/salesforcedx-vscode/pull/482))—Contribution by [@dylanribb](https://github.com/dylanribb)
- Quick pick to select which API (REST API or Tooling API) to use when running SOQL query commands ([PR #461](https://github.com/forcedotcom/salesforcedx-vscode/pull/461))

## 43.3.0 - June 14, 2018

### Fixed

#### salesforcedx-vscode-apex

- Improve syntax highlighting for built-in Apex classes, methods, and types ([PR #474](https://github.com/forcedotcom/salesforcedx-vscode/pull/474), [PR #484](https://github.com/forcedotcom/salesforcedx-vscode/pull/484))

## 43.2.0 - June 9, 2018

### Added

#### salesforcedx-vscode-apex-replay-debugger

- Apex Replay Debugger extension for VS Code ([Read more](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-replay-debugger))
- SFDX: Turn On Apex Debug Log for Replay Debugger ([PR #264](https://github.com/forcedotcom/salesforcedx-vscode/pull/264))
- SFDX: Turn Off Apex Debug Log for Replay Debugger ([PR #264](https://github.com/forcedotcom/salesforcedx-vscode/pull/264))
- SFDX: Launch Apex Replay Debugger with Current File ([PR #423](https://github.com/forcedotcom/salesforcedx-vscode/pull/423))
- SFDX: Launch Apex Replay Debugger with Last Log File ([PR #439](https://github.com/forcedotcom/salesforcedx-vscode/pull/439))

#### salesforcedx-vscode-apex-debugger

- Use ISV Customer Debugger to debug subscribers of managed packages ([Read more](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-apex-debugger#isv-customer-debugger))
- SFDX: Create and Set Up Project for ISV Debugging ([PR #282](https://github.com/forcedotcom/salesforcedx-vscode/pull/282))

### Fixed

#### salesforcedx-vscode-apex-debugger

- Launch Apex Debugger session with an active Visual Studio Live Share session ([PR #442](https://github.com/forcedotcom/salesforcedx-vscode/pull/442))

## 42.18.0 - May 31, 2018

### Fixed

#### salesforcedx-vscode-core

- Rename the output channel from Salesforce DX CLI to Salesforce CLI ([PR #446](https://github.com/forcedotcom/salesforcedx-vscode/pull/446))

## 42.17.0 - May 24, 2018

### Added

#### salesforcedx-vscode-apex-debugger

- Clarify current Apex Debugger limitations with the Visual Studio Live Share extension ([PR #425](https://github.com/forcedotcom/salesforcedx-vscode/pull/425))

## 42.16.0 - May 17, 2018

### Fixed

#### salesforcedx-vscode-apex

- Apex language grammar rules properly categorize Apex syntax, improving code highlighting ([PR #415](https://github.com/forcedotcom/salesforcedx-vscode/pull/415))
- Go To Definition and Find All References properly handle custom objects that have a namespace ([PR #413](https://github.com/forcedotcom/salesforcedx-vscode/pull/413))

## 42.15.0 - May 10, 2018

### Fixed

#### salesforcedx-vscode-core

- Make extension resilient against Salesforce CLI's STDERR messages (warnings and available updates) when parsing `--json` output ([PR #406](https://github.com/forcedotcom/salesforcedx-vscode/pull/406))

## 42.14.0 - May 3, 2018

### Fixed

#### salesforcedx-vscode-apex

- Code completion now respects the `global`, `public`, `protected`, and `private` modifiers when offering suggestions ([PR #404](https://github.com/forcedotcom/salesforcedx-vscode/pull/404))

## 42.13.0 - April 26, 2018

### Fixed

#### salesforcedx-vscode

- Previously, copying and pasting Salesforce CLI output from the embedded terminal in VS Code would embed terminal escape characters in the pasted text. We have fixed this in Salesforce CLI, and the Visual Studio Code team has made a similar fix in VS Code. If you see any issues with copy and pasting, be sure to update both VS Code and Salesforce CLI.

#### salesforcedx-vscode-apex

- Handle missing `namespace` attribute in sfdx-project.json ([PR #391](https://github.com/forcedotcom/salesforcedx-vscode/pull/391))

## 42.12.0 - April 19, 2018

### Added

#### salesforcedx-vscode-apex

- Go To Definition and Find All References for type usage in constructors for arrays and lists ([PR #376](https://github.com/forcedotcom/salesforcedx-vscode/pull/376))
- Go To Definition and Find All References for types used with instanceOf ([PR #376](https://github.com/forcedotcom/salesforcedx-vscode/pull/376))
- Go To Definition for implicit constructors across Apex classes ([PR #376](https://github.com/forcedotcom/salesforcedx-vscode/pull/376))

### Fixed

#### salesforcedx-vscode-core

- Support invoking Salesforce CLI commands for CLI installations that used the new installers on Windows ([PR #386](https://github.com/forcedotcom/salesforcedx-vscode/pull/386))

## 42.11.0 - April 12, 2018

### Added

#### salesforcedx-vscode-apex

- Go To Definition and Find All References for [built-in (`System`) exceptions](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_exception_methods.htm) ([PR #370](https://github.com/forcedotcom/salesforcedx-vscode/pull/370))
- Go To Definition and Find All References for sObjects in Apex trigger declarations ([PR #370](https://github.com/forcedotcom/salesforcedx-vscode/pull/370))

### Fixed

#### salesforcedx-vscode-apex

- Language server processes Apex code only in the `packageDirectories` set in `sfdx-project.json` (and their subdirectories) ([PR #370](https://github.com/forcedotcom/salesforcedx-vscode/pull/370))

#### salesforcedx-vscode-apex-debugger

- Apex Debugger works on Windows even when there are spaces in the project's path ([PR #359](https://github.com/forcedotcom/salesforcedx-vscode/pull/359))

## 42.10.0 - April 5, 2018

### Added

#### salesforcedx-vscode-apex

- Go To Definition and Find All References for type usage in collection constructors ([PR #362](https://github.com/forcedotcom/salesforcedx-vscode/pull/362))
- Go To Definition and Find All References for type usage in casting ([PR #362](https://github.com/forcedotcom/salesforcedx-vscode/pull/362))

### Fixed

#### salesforcedx-vscode-apex

- Go To Definition now works after moving a class/trigger to a different directory ([PR #362](https://github.com/forcedotcom/salesforcedx-vscode/pull/362))

## 42.8.0 - March 22, 2018

### Added

#### salesforcedx-vscode-apex

- Go To Definition and Find All References for inner interfaces and implicit constructors ([PR #353](https://github.com/forcedotcom/salesforcedx-vscode/pull/353))

## 42.7.0 - March 15, 2018

### Added

#### salesforcedx-vscode-core

- Demo mode for VS Code warns users who authorize business or production orgs on demo machines about the security risk ([PR #335](https://github.com/forcedotcom/salesforcedx-vscode/pull/335))
- `SFDX: Log Out from All Authorized Orgs` command supports demo mode ([PR #335](https://github.com/forcedotcom/salesforcedx-vscode/pull/335))

### Fixed

#### salesforcedx-vscode-apex

- Handle Apex language server failures without disrupting indexing ([PR #341](https://github.com/forcedotcom/salesforcedx-vscode/pull/341))

## 42.5.0 - March 1, 2018

### Added

#### salesforcedx-vscode-apex

- Find All References for user-defined classes, enums, interfaces and methods ([PR #324](https://github.com/forcedotcom/salesforcedx-vscode/pull/324))
- `SFDX: Get Apex Debug Logs` command to fetch debug logs ([PR #310](https://github.com/forcedotcom/salesforcedx-vscode/pull/310))

### Fixed

#### salesforcedx-vscode-core

- Change code actions for running Apex tests to code lenses, to follow VS Code conventions ([PR #324](https://github.com/forcedotcom/salesforcedx-vscode/pull/324))

## 42.4.0 - February 22, 2018

### Added

#### salesforcedx-vscode-core

- Include source links to Apex classes on Apex test failures ([PR #308](https://github.com/forcedotcom/salesforcedx-vscode/pull/308))
- `SFDX: Re-Run Last Invoked Apex Test Class` and `SFDX: Re-Run Last Invoked Apex Test Method` show up in the command palette after you run tests ([PR #308](https://github.com/forcedotcom/salesforcedx-vscode/pull/308))

## 42.2.0 - February 10, 2018

### Added

#### salesforcedx-vscode-core

- Code action to run Apex tests; run a single method or all test methods in a test class ([PR #291](https://github.com/forcedotcom/salesforcedx-vscode/pull/291))

#### salesforcedx-vscode-apex

- Find All References feature for Apex fields and properties; includes usage in expressions, declarations, and references in Apex code ([PR #292](https://github.com/forcedotcom/salesforcedx-vscode/pull/292))

## 41.18.0 - January 22, 2018

### Fixed

#### salesforcedx-vscode

- Update to the latest Salesforce icons ([PR #269](https://github.com/forcedotcom/salesforcedx-vscode/pull/269))

### Added

#### salesforcedx-vscode-core

- New workspace setting to control whether Salesforce CLI success messages show as information messages (pop-ups) or status bar messages (in the footer) ([PR #259](https://github.com/forcedotcom/salesforcedx-vscode/pull/259))

## 41.17.0 - January 15, 2018

### Added

#### salesforcedx-vscode-apex

- Add Go To Definition for class/interface usage for inner classes ([PR #258](https://github.com/forcedotcom/salesforcedx-vscode/pull/258))

## 41.16.0 - January 8, 2018

### Added

#### salesforcedx-vscode-apex

- Enable Go To Definition for usages of classes and interfaces in class and interface declarations ([PR #247](https://github.com/forcedotcom/salesforcedx-vscode/pull/247))

#### salesforcedx-apex-debugger

- Add visual indication in the call stack telling the user what exception the debugger is currently paused on ([PR #240](https://github.com/forcedotcom/salesforcedx-vscode/pull/240))

#### salesforcedx-vscode

- Add Dreamforce video links to README ([PR #239](https://github.com/forcedotcom/salesforcedx-vscode/pull/239))

### Fixed

#### salesforcedx-vscode-core

- Fix scratch org creation alias request message ([PR #238](https://github.com/forcedotcom/salesforcedx-vscode/pull/238))

## 41.12.0 - December 14, 2017

### Added

#### salesforcedx-vscode-core

- Export SFDX_SET_CLIENT_IDS environment variable to the embedded terminal in VS Code, to help with logging ([PR #235](https://github.com/forcedotcom/salesforcedx-vscode/pull/235))

## 41.11.0 - December 7, 2017

### Added

#### salesforcedx-vscode-core

- SFDX: Create Apex Trigger (_Requires v41.11.0 of the Salesforce CLI_) ([PR #224](https://github.com/forcedotcom/salesforcedx-vscode/pull/224))

### Fixed

#### salesforcedx-vscode-core

- Prevent running `SFDX: Refresh SObject Definitions` while it's already running ([PR #227](https://github.com/forcedotcom/salesforcedx-vscode/pull/227))
- Add explanatory comment to the generated sObject faux classes ([PR #228](https://github.com/forcedotcom/salesforcedx-vscode/pull/228))

## 41.9.0 - November 30, 2017

### Added

#### salesforcedx-vscode-apex-debugger

- Configure exception breakpoints ([PR #218](https://github.com/forcedotcom/salesforcedx-vscode/pull/218))
- Timeout for idle debugger session ([PR #221](https://github.com/forcedotcom/salesforcedx-vscode/pull/221))

## 41.8.1 - November 16, 2017

### Fixed

#### salesforcedx-vscode-core

- Fix SFDX commands not showing up on Windows

## 41.8.0 - November 16, 2017

### Added

#### salesforcedx-vscode-core

- Option to run a single Apex test class synchronously (_Requires v41.8.0 of the Salesforce CLI_) ([PR #206](https://github.com/forcedotcom/salesforcedx-vscode/pull/206))
- SFDX: Create Project ([PR #197](https://github.com/forcedotcom/salesforcedx-vscode/pull/197))
- SFDX: Refresh SObject Definitions (Enables code smartness in Apex for sObjects: [Read more](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex))

### Fixed

#### salesforcedx-vscode-apex-debugger

- Paginate collections in variables view ([PR #209](https://github.com/forcedotcom/salesforcedx-vscode/pull/209))

## 41.6.0 - November 2, 2017

### Added

#### salesforcedx-vscode

- Change name to `Salesforce Extensions for VS Code` ([PR #192](https://github.com/forcedotcom/salesforcedx-vscode/pull/192))

### Fixed

#### salesforcedx-vscode-apex-debugger

- Fix timeout issue when starting a debugger session ([PR #194](https://github.com/forcedotcom/salesforcedx-vscode/pull/194))

#### salesforcedx-vscode-visualforce

- Support proper formatting with Cmd+/ (macOS) or Ctrl+/ (Linux and Windows) in embedded CSS and JavaScript within Visualforce files ([PR #200](https://github.com/forcedotcom/salesforcedx-vscode/pull/200))

## 41.5.0 - October 25, 2017

### Added

### salesforcedx-vscode

- Update the minimum VS Code version to 1.17 ([PR #187](https://github.com/forcedotcom/salesforcedx-vscode/pull/187))

### Fixed

#### salesforcedx-vscode-visualforce

- Remove non-public attributes from Visualforce tags ([PR #188](https://github.com/forcedotcom/salesforcedx-vscode/pull/188))

## 41.4.0 - October 19, 2017

### Added

### salesforcedx-vscode-visualforce

- Code completion for standard Visualforce components ([PR #180](https://github.com/forcedotcom/salesforcedx-vscode/pull/180))

### Fixed

#### salesforcedx-vscode-apex-debugger

- Default type of `requestTypeFilter` in `launch.json` is an array ([PR #168](https://github.com/forcedotcom/salesforcedx-vscode/pull/168))
- Fix timing issue when showing the callstack ([PR #168](https://github.com/forcedotcom/salesforcedx-vscode/pull/168))

## 41.3.0 - October 14, 2017

### Added

#### salesforcedx-vscode-apex-debugger

- Apex Debugger extension for VS Code ([Read more](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-apex-debugger))

#### salesforcedx-vscode-core

- Alias prompt for command `SFDX: Create a Default Scratch Org...` ([PR #157](https://github.com/forcedotcom/salesforcedx-vscode/pull/157))

## 40.13.0 - October 5, 2017

### Added

#### salesforcedx-vscode-core

- SFDX: Execute SOQL Query... ([PR #149](https://github.com/forcedotcom/salesforcedx-vscode/pull/149))
- SFDX: Execute SOQL Query with Currently Selected Text ([PR #149](https://github.com/forcedotcom/salesforcedx-vscode/pull/149))
- SFDX: Execute Anonymous Apex with Editor Contents ([PR #152](https://github.com/forcedotcom/salesforcedx-vscode/pull/152))
- SFDX: Execute Anonymous Apex with Currently Selected Text ([PR #152](https://github.com/forcedotcom/salesforcedx-vscode/pull/152))

## 40.12.0 - September 28, 2017

### Added

#### salesforcedx-vscode-core

- SFDX: Display Org Details... ([PR #131](https://github.com/forcedotcom/salesforcedx-vscode/pull/131))
- SFDX: Display Org Details for Default Scratch Org ([PR #116](https://github.com/forcedotcom/salesforcedx-vscode/pull/116))
- SFDX: List All Aliases ([PR #116](https://github.com/forcedotcom/salesforcedx-vscode/pull/116))
- SFDX: List All Config Variables ([PR #116](https://github.com/forcedotcom/salesforcedx-vscode/pull/116))
- SFDX: Pull Source from Default Scratch Org and Override Conflicts ([PR #127](https://github.com/forcedotcom/salesforcedx-vscode/pull/127))
- SFDX: Push Source to Default Scratch Org and Override Conflicts ([PR #125](https://github.com/forcedotcom/salesforcedx-vscode/pull/125))

## 40.11.0 - September 21, 2017

### Added

#### salesforcedx-vscode-apex

- Go To Definition feature for Apex methods, properties, constructors, and class variables across Apex files. ([PR #114](https://github.com/forcedotcom/salesforcedx-vscode/pull/114))

#### salesforcedx-vscode-lightning

- Salesforce Lightning Design System (SLDS) linter for deprecated CSS class names. ([PR #101](https://github.com/forcedotcom/salesforcedx-vscode/pull/101))

### Fixed

#### salesforcedx-vscode-core

- Wizards warn about overwriting an existing file. ([PR #106](https://github.com/forcedotcom/salesforcedx-vscode/pull/106))
- Suggest only 'aura' subdirectories for Lightning wizard commands. ([PR #113](https://github.com/forcedotcom/salesforcedx-vscode/pull/113))

## 40.10.0 - September 14, 2017

### Added

#### salesforcedx-vscode-apex

- Go To Definition feature for Apex methods and constructors within the current file. ([PR #104](https://github.com/forcedotcom/salesforcedx-vscode/pull/104))

#### salesforcedx-vscode-core

- SFDX: View Local Changes command ([PR #102](https://github.com/forcedotcom/salesforcedx-vscode/pull/102))
- SFDX: View Changes in Default Scratch Org command ([PR #102](https://github.com/forcedotcom/salesforcedx-vscode/pull/102))

## 40.9.0 - September 7, 2017

### Added

#### salesforcedx-vscode-apex

- Go To Definition feature for Apex fields, properties, local variables, and method parameters within the current file. ([PR #88](https://github.com/forcedotcom/salesforcedx-vscode/pull/88))

## 40.8.0 - August 31, 2017

### Added

#### salesforcedx-vscode-core

- SFDX: Create Lightning App command ([PR #62](https://github.com/forcedotcom/salesforcedx-vscode/pull/62))
- SFDX: Create Lightning Component command ([PR #70](https://github.com/forcedotcom/salesforcedx-vscode/pull/70))
- SFDX: Create Lightning Event command ([PR #76](https://github.com/forcedotcom/salesforcedx-vscode/pull/76))
- SFDX: Create Lightning Interface command ([PR #77](https://github.com/forcedotcom/salesforcedx-vscode/pull/77))

## 40.7.0 - August 24, 2017

### Changed

#### salesforcedx-vscode-apex

- Switched the Apex Language Server to use standard input/output instead of creating a local socket ([PR #53](https://github.com/forcedotcom/salesforcedx-vscode/pull/53)).

### Added

#### salesforcedx-vscode-core

- SFDX: Create Apex Class command ([PR #47](https://github.com/forcedotcom/salesforcedx-vscode/pull/47))
- SFDX: Create Visualforce Component and SFDX: Create Visualforce Page commands ([PR #55](https://github.com/forcedotcom/salesforcedx-vscode/pull/55))

## 40.5.0 - August 10, 2017

### Bug Fixes

#### salesforcedx-vscode-apex

- Fixed the way entries are stored in the database to prevent errors when upgrading to the latest version of the extension ([PR #42](https://github.com/forcedotcom/salesforcedx-vscode/pull/42), [PR #43](https://github.com/forcedotcom/salesforcedx-vscode/pull/43)).

#### salesforcedx-vscode-core

- The command SFDX: Create a Default Scratch Org now looks for `*-scratch-def.json` files only in the `config` directory and its children ([PR #41](https://github.com/forcedotcom/salesforcedx-vscode/pull/41)).
- SFDX commands appear in the command palette only when a directory open in a VS Code window contains an `sfdx-project.json` file ([PR #40](https://github.com/forcedotcom/salesforcedx-vscode/pull/40#issuecomment-320560173)).
