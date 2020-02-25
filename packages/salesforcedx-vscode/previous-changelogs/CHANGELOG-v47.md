# 47.17.1 - January 30, 2020

## Fixed

#### salesforcedx-vscode-apex

- Update Apex Language Server error message to include support for Java 8 and Java 11 ([PR #1900](https://github.com/forcedotcom/salesforcedx-vscode/pull/1900))

## Added

#### salesforcedx-vscode-apex

- Tab between arguments when inserting method from code completion ([PR #1913](https://github.com/forcedotcom/salesforcedx-vscode/pull/1913))
  ![GIF showing Apex code completion with new tab fix](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/47.17.1/autocomplete_tabs.gif)

- Disable Global Objects from autocompletion when invoked from a member type ([PR #1913](https://github.com/forcedotcom/salesforcedx-vscode/pull/1913))
  ![GIF showing autocompletion results without global objects](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/47.17.1/autocomplete_no_global_objects.gif)

- Show documentation for autocomplete items when definitions have block comments ([PR #1913](https://github.com/forcedotcom/salesforcedx-vscode/pull/1913))
  ![GIF showing autocompletion results with documentation](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/47.17.1/autocomplete-docs.gif)

- Update how documentation is rendered when hovering over a symbol ([PR #1913](https://github.com/forcedotcom/salesforcedx-vscode/pull/1913))
  ![GIF showing hover results with documentation](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/47.17.1/hover-docs.gif)

- Enable support for JavaDoc symbols ([PR #1910](https://github.com/forcedotcom/salesforcedx-vscode/pull/1910), [Issue #1469](https://github.com/forcedotcom/salesforcedx-vscode/issues/1469))-Contribution by [@danielepiccone](https://github.com/danielepiccone)
  ![GIF showing support for multi-line JavaDoc](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/47.17.1/javadoc-support.gif)

#### salesforcedx-vscode-core

- Use inline help text from SObjects for hover documentation on fields ([PR #1890](https://github.com/forcedotcom/salesforcedx-vscode/pull/1890))-Contribution by [@ChuckJonas](https://github.com/ChuckJonas)
  ![Image showing SObject documentation on hover](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/47.17.1/sobject-hover-docs.png)

- Update minimum supported VSCode version to be 1.40 and above ([PR #1884](https://github.com/forcedotcom/salesforcedx-vscode/pull/1884))

# 47.16.0 - January 23, 2020

## Fixed

#### salesforcedx-vscode-core

- Allow spaces in scratch org alias creation ([PR #1876](https://github.com/forcedotcom/salesforcedx-vscode/pull/1876))

## Added

#### salesforcedx-vscode-core

- Add `SFDX: Create Sample Analytics Template` command to scaffold analytics templates ([PR #1857](https://github.com/forcedotcom/salesforcedx-vscode/pull/1857))

#### docs

- Add tools doc and images [Lightning Web Components](https://forcedotcom.github.io/salesforcedx-vscode/articles/lwc/write-lwc) ([PR #1867](https://github.com/forcedotcom/salesforcedx-vscode/pull/1867))

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
