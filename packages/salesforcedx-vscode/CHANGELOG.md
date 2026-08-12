# 67.10.0 - August 12, 2026

## Added

#### salesforcedx-vscode-apex

- We added an option to automatically terminate orphaned Apex Language Server
  processes without prompting. Enable the new
  `salesforcedx-vscode-apex.autoTerminateOrphanedProcesses` setting to silently
  kill orphaned processes on activation, or click **Always Auto-Terminate** in
  the orphan-detection prompt to enable it with confirmation.
  ([PR #7643](https://github.com/forcedotcom/salesforcedx-vscode/pull/7643))

#### salesforcedx-vscode-apex-log

- The trace flag user picker now groups results by user type — Standard,
  Automated Process, Partner, Customer/Portal, Guest, and Other — making it
  easier to find the right user when setting a trace flag.
  ([PR #7958](https://github.com/forcedotcom/salesforcedx-vscode/pull/7958))

## Fixed

#### salesforcedx-vscode-core

- We fixed a bug where `NODE_EXTRA_CA_CERTS`, `SF_LOG_LEVEL`, and
  `SF_DISABLE_TELEMETRY` were not passed to `sf` CLI commands. Settings changes
  now take effect on the next command without requiring a VS Code window reload.
  ([PR #7899](https://github.com/forcedotcom/salesforcedx-vscode/pull/7899))

- We updated the `@salesforce/templates` dependency to prevent a vulnerability
  that could allow malicious template execution.
  ([PR #7935](https://github.com/forcedotcom/salesforcedx-vscode/pull/7935))

#### salesforcedx-vscode-org

- We fixed a bug where a malformed or unsafe `sfdcLoginUrl` in
  `sfdx-project.json` could be offered as the **Project Default** login URL.
  Malformed URLs are now rejected and a warning is shown.
  ([PR #7945](https://github.com/forcedotcom/salesforcedx-vscode/pull/7945))

#### salesforcedx-vscode-services

- We improved output-channel error messages to include the error type, making
  failures easier to identify.
  ([PR #7920](https://github.com/forcedotcom/salesforcedx-vscode/pull/7920))
