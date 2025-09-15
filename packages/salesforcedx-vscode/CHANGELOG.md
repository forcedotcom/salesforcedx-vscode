# 64.14.0 - September 17, 2025

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6528](https://github.com/forcedotcom/salesforcedx-vscode/pull/6528))

## Fixed

#### salesforcedx-vscode-core

- We fixed the **SFDX: Execute SOQL Query With Currently Selected Text** command so that columns with parent relationship fields now display their actual values instead of [Object]. This brings the output in line with the `sf data query -q` CLI command.

Thank you [jh480](https://github.com/jh480) for logging this issue. ([PR #6539](https://github.com/forcedotcom/salesforcedx-vscode/pull/6539), [ISSUE #6536](https://github.com/forcedotcom/salesforcedx-vscode/issues/6536))

- We improved namespace handling by checking the org auth file to confirm whether a scratch org has a namespace.
    - orgDisplay now shows the namespace.
    - We added support for no-namespace projects during debugging.
    - Fixed an issue where the Apex Replay Debugger could not run on Apex test classes when the project had a namespace but the connected org did not.

Thank you [Justin Lyon](https://github.com/justin-lyon) for logging this issue. ([PR #6467](https://github.com/forcedotcom/salesforcedx-vscode/pull/6467), [ISSUE #6458](https://github.com/forcedotcom/salesforcedx-vscode/issues/6458))

#### salesforce-vscode-visualforce

- We fixed an issue where `<style>` tags in VF pages caused the Visualforce Language Server to throw errors on save or format. VF pages with `<style>` tags now work as expected without breaking formatting or highlighting.

Thank you [Humaira Zaman](https://github.com/humairazaman-devsinc) and [Charlie Jonas](https://github.com/ChuckJonas) for logging issues. ([PR #6527](https://github.com/forcedotcom/salesforcedx-vscode/pull/6527/), [ISSUE #5593](https://github.com/forcedotcom/salesforcedx-vscode/issues/5593), [ISSUE #5602](https://github.com/forcedotcom/salesforcedx-vscode/issues/5602))
