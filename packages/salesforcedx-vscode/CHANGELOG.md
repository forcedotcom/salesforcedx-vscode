# 67.14.0 - August 26, 2026

## Added

#### salesforcedx-vscode-lwc

- We added full stack traces to Jest crash errors in the **Test Explorer**, so you can see what went wrong instead of "No test results produced". ([PR #7940](https://github.com/forcedotcom/salesforcedx-vscode/pull/7940))

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- We fixed a bug where breakpoints didn't stop when debugging Anonymous Apex from `.apex` files, `.cls` files, or log files. ([PR #8018](https://github.com/forcedotcom/salesforcedx-vscode/pull/8018))

#### salesforcedx-vscode-metadata

- We fixed a bug where the source tracking status bar icon kept showing a deleted org after you deleted your default scratch org. ([PR #8027](https://github.com/forcedotcom/salesforcedx-vscode/pull/8027))
