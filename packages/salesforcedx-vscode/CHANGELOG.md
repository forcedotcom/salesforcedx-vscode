# 67.5.0 - July 15, 2026

## Added

#### salesforcedx-vscode-org

- Add username param to ConnectionService.getConnection, migrate determineConnectedStatusForNonScratchOrg - W-23354940 ([PR #7738](https://github.com/forcedotcom/salesforcedx-vscode/pull/7738))

- Gate orgDisplay sensitive-info behind modal confirm - W-23230633 ([PR #7690](https://github.com/forcedotcom/salesforcedx-vscode/pull/7690))

#### salesforcedx-vscode-services

- Add username param to ConnectionService.getConnection, migrate determineConnectedStatusForNonScratchOrg - W-23354940 ([PR #7738](https://github.com/forcedotcom/salesforcedx-vscode/pull/7738))

- Gate orgDisplay sensitive-info behind modal confirm - W-23230633 ([PR #7690](https://github.com/forcedotcom/salesforcedx-vscode/pull/7690))

## Fixed

#### docs

- Resolve effect ESM to shrink bundle - W-23313216 ([PR #7737](https://github.com/forcedotcom/salesforcedx-vscode/pull/7737))

- Shrink bundle via esbuild ESM resolution of effect - W-23313202 ([PR #7692](https://github.com/forcedotcom/salesforcedx-vscode/pull/7692))

#### salesforcedx-apex

- Correct handling of log levels to be able to debug Anonymous Apex - W-23339705 ([PR #7683](https://github.com/forcedotcom/salesforcedx-vscode/pull/7683))

#### salesforcedx-apex-replay-debugger

- Correct handling of log levels to be able to debug Anonymous Apex - W-23339705 ([PR #7683](https://github.com/forcedotcom/salesforcedx-vscode/pull/7683))

#### salesforcedx-utils-vscode

- Remove dead getOrgApiVersion + FlagParameter exports from utils-vscode - W-23355254 ([PR #7697](https://github.com/forcedotcom/salesforcedx-vscode/pull/7697))

#### salesforcedx-vscode-apex

- Resolve effect ESM to shrink bundle - W-23313207 ([PR #7721](https://github.com/forcedotcom/salesforcedx-vscode/pull/7721))

- Add ADR to migrate telemetry to Effect spans/logs - W-23348766 ([PR #7694](https://github.com/forcedotcom/salesforcedx-vscode/pull/7694))

#### salesforcedx-vscode-apex-debugger

- Shrink bundle via esbuild ESM resolution of effect - W-23313202 ([PR #7692](https://github.com/forcedotcom/salesforcedx-vscode/pull/7692))

#### salesforcedx-vscode-apex-log

- Shrink bundle via esbuild ESM resolution of effect - W-23313203 ([PR #7703](https://github.com/forcedotcom/salesforcedx-vscode/pull/7703))

#### salesforcedx-vscode-apex-oas

- Shrink bundle via esbuild ESM resolution of effect - W-23313204 ([PR #7707](https://github.com/forcedotcom/salesforcedx-vscode/pull/7707))

#### salesforcedx-vscode-apex-replay-debugger

- Resolve effect ESM to shrink bundle - W-23313205 ([PR #7714](https://github.com/forcedotcom/salesforcedx-vscode/pull/7714))

- Get rid of old broken command SFDX: Execute Anonymous Apex with Currently Selected Text + rename debug command to SFDX: Debug Anonymous Apex with Editor's Selected Text for consistency - W-23329171 ([PR #7680](https://github.com/forcedotcom/salesforcedx-vscode/pull/7680))

#### salesforcedx-vscode-apex-testing

- Shrink apex-testing bundle via esbuild ESM resolution of effect - W-23313206 ([PR #7715](https://github.com/forcedotcom/salesforcedx-vscode/pull/7715))

#### salesforcedx-vscode-core

- Shrink core bundle via esbuild ESM resolution of effect - W-23313208 ([PR #7719](https://github.com/forcedotcom/salesforcedx-vscode/pull/7719))

#### salesforcedx-vscode-lightning

- Resolve effect ESM to shrink bundle - W-23313209 ([PR #7720](https://github.com/forcedotcom/salesforcedx-vscode/pull/7720))

#### salesforcedx-vscode-lwc

- Resolve effect ESM to shrink bundle - W-23313210 ([PR #7722](https://github.com/forcedotcom/salesforcedx-vscode/pull/7722))

#### salesforcedx-vscode-metadata

- Shrink metadata bundle via esbuild ESM resolution of effect - W-23313212 ([PR #7723](https://github.com/forcedotcom/salesforcedx-vscode/pull/7723))

#### salesforcedx-vscode-org

- Resolve effect ESM to shrink bundle - W-23313213 ([PR #7724](https://github.com/forcedotcom/salesforcedx-vscode/pull/7724))

#### salesforcedx-vscode-org-browser

- Shrink bundle via esbuild ESM resolution of effect - W-23313202 ([PR #7692](https://github.com/forcedotcom/salesforcedx-vscode/pull/7692))

#### salesforcedx-vscode-services

- Gate telemetry exporters per-export instead of per-Layer - W-23369387 ([PR #7740](https://github.com/forcedotcom/salesforcedx-vscode/pull/7740))

- Resolve effect ESM to shrink bundle - W-23313214 ([PR #7725](https://github.com/forcedotcom/salesforcedx-vscode/pull/7725))

- Correct handling of log levels to be able to debug Anonymous Apex - W-23339705 ([PR #7683](https://github.com/forcedotcom/salesforcedx-vscode/pull/7683))

#### salesforcedx-vscode-soql

- Resolve effect ESM to shrink bundle - W-23313215 ([PR #7726](https://github.com/forcedotcom/salesforcedx-vscode/pull/7726))

#### salesforcedx-vscode-visualforce

- Resolve effect ESM to shrink bundle - W-23313216 ([PR #7737](https://github.com/forcedotcom/salesforcedx-vscode/pull/7737))

