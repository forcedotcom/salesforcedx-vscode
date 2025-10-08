# 64.17.2 - October 8, 2025

## Fixed

#### salesforcedx-vscode-core

- We fixed some minor bugs in the hover documentation of metadata XML files. ([PR #6588](https://github.com/forcedotcom/salesforcedx-vscode/pull/6588))

- We added a prompt that pops up to ask the user to reauthenticate to the org when the Code Builder window sits idle for too long and the access token becomes expired. ([PR #6583](https://github.com/forcedotcom/salesforcedx-vscode/pull/6583))

- We re-enabled the auth related commands in Code Builder by adding a check for the environment variable `CODE_BUILDER`. ([PR #6586](https://github.com/forcedotcom/salesforcedx-vscode/pull/6586))
