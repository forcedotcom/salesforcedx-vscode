# 65.5.0 - November 19, 2025

## Added

#### salesforcedx-utils-vscode

#### salesforcedx-vscode-apex-oas

- OpenAPI (OAS) documents now adjust behavior based on the org’s API version:

**Operations active Flag**

**API < 66.0**: active: true (same as today)

**API ≥ 66.0**: active: false (new GA behavior)

**Beta Info (x-betaInfo)**

**API < 66.0**: Included, indicating the feature is in beta

**API ≥ 66.0**: Removed, reflecting GA status

This ensures OAS documents behave correctly for both pre-GA (earlier versions) and GA (66.0+) orgs. ([PR #6645](https://github.com/forcedotcom/salesforcedx-vscode/pull/6645))


## Fixed

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-apex-replay-debugger

- `skipCodeCoverage` is now passed using your `retrieve-test-code-coverage` setting. If set to `True`, coverage is skipped for faster test runs. ([PR #6650](https://github.com/forcedotcom/salesforcedx-vscode/pull/6650))

