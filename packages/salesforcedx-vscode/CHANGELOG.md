# 68.5.5 - October 28, 2026

## Fixed

#### salesforcedx-vscode-apex-testing

- We fixed a bug where failing Apex test runs and debugs showed a success notification instead of a failure count. The Testing sidebar now debugs multiple Apex classes without a race condition, stepping through each class log sequentially with progress feedback. ([PR #8397](https://github.com/forcedotcom/salesforcedx-vscode/pull/8397))

#### salesforcedx-vscode-org-browser

- We fixed a bug where **Org Browser** activation waited for org identity, which could delay the view from initializing. ([PR #8442](https://github.com/forcedotcom/salesforcedx-vscode/pull/8442))

#### salesforcedx-vscode-soql

- We fixed a bug where SOQL with leading `//` header comments or a trailing semicolon failed in **Execute SOQL Query**, query plans, **SOQL Builder**, code lens, and LSP validation. The editor document is left unchanged. ([PR #8457](https://github.com/forcedotcom/salesforcedx-vscode/pull/8457))

## Under the Hood

- We made some under the hood changes. ([PR #8465](https://github.com/forcedotcom/salesforcedx-vscode/pull/8465), [PR #8466](https://github.com/forcedotcom/salesforcedx-vscode/pull/8466), [PR #8477](https://github.com/forcedotcom/salesforcedx-vscode/pull/8477), [PR #8484](https://github.com/forcedotcom/salesforcedx-vscode/pull/8484))
