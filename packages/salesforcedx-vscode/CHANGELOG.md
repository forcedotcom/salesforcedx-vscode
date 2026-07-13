# 67.5.0 - July 15, 2026

## Added

#### salesforcedx-vscode-org

- The **SFDX: Display Org Details** and **SFDX: Display Org Details for Default Org** commands now show a modal warning and require you to click **Continue** before sensitive org info is written to the output channel. Clicking **Cancel** aborts without showing anything. ([PR #7690](https://github.com/forcedotcom/salesforcedx-vscode/pull/7690))

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- We removed the broken **SFDX: Execute Anonymous Apex with Currently Selected Text** command and renamed **SFDX: Debug Anonymous Apex** to **SFDX: Debug Anonymous Apex with Editor's Selected Text**. The debug command now also works on highlighted text in Anonymous Apex (`.apex`) files, matching the execute command. ([PR #7680](https://github.com/forcedotcom/salesforcedx-vscode/pull/7680))

#### salesforcedx-apex

- We fixed a bug where debugging Anonymous Apex failed because of incorrect log-level handling. You can now debug Anonymous Apex from the **Debug** code lens, **SFDX: Launch Apex Replay Debugger with Selected File**, and **SFDX: Debug Anonymous Apex with Editor's Selected Text**. ([PR #7683](https://github.com/forcedotcom/salesforcedx-vscode/pull/7683))

#### salesforcedx-vscode-org

- We fixed a bug where the dev hub was missing from the org table in **SFDX: Display Org Details**. ([PR #7738](https://github.com/forcedotcom/salesforcedx-vscode/pull/7738))
