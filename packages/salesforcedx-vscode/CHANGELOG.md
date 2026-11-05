# 68.7.3 - November 4, 2026

## Added

#### salesforcedx-vscode-apex

- We added VS Code Settings under `salesforcedx-vscode-apex.advanced.capabilities` so you can enable or disable individual Apex language server providers. The Apex language server restarts automatically when a setting changes. ([PR #8498](https://github.com/forcedotcom/salesforcedx-vscode/pull/8498))

## Fixed

#### salesforcedx-apex

- We fixed a bug where anonymous Apex in the Web Console failed with `INVALID_SESSION_ID` even when REST calls succeeded. ([PR #8505](https://github.com/forcedotcom/salesforcedx-vscode/pull/8505))

#### salesforcedx-vscode-org-browser

- We fixed a bug where a failed workspace scan made **Org Browser** treat components as absent. Components now stay visible with a question-mark icon when presence is unknown, and a notification names the orphaned `-meta.xml` and its missing content file. ([PR #8460](https://github.com/forcedotcom/salesforcedx-vscode/pull/8460))

#### salesforcedx-vscode-services

- We fixed a bug where switching the default org could leave the status bar and **Open Default Org in Browser** showing or opening the previous org. ([PR #8493](https://github.com/forcedotcom/salesforcedx-vscode/pull/8493))

#### salesforcedx-vscode-soql

- We fixed a bug where web **SOQL Builder** showed a **Set a Default Org** button that did nothing. The web builder now hides that button and shows a short message that a default org is required. ([PR #8444](https://github.com/forcedotcom/salesforcedx-vscode/pull/8444))

## Under the Hood

- We made some under the hood changes. ([PR #8467](https://github.com/forcedotcom/salesforcedx-vscode/pull/8467), [PR #8508](https://github.com/forcedotcom/salesforcedx-vscode/pull/8508))
