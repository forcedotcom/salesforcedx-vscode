# 66.14.0 - June 3, 2026

## Added

#### salesforcedx-vscode-core

- We bumped `@salesforce/templates` to 66.9.0 to support the new React and UIBundle multiframework project templates. ([PR #7365](https://github.com/forcedotcom/salesforcedx-vscode/pull/7365))

#### salesforcedx-vscode-services

- We added a new **Enable File Traces** setting (`salesforcedx-vscode-salesforcedx.enableFileTraces`, default `false`). When enabled, spans and log records are written in OTLP JSON format to `~/.sf/vscode-spans/` so you can share traces with support for import into Grafana. ([PR #7305](https://github.com/forcedotcom/salesforcedx-vscode/pull/7305))

## Fixed

#### salesforcedx-vscode-apex-testing

- We fixed a bug where Apex test results were read from the wrong location when multiple orgs were used. ([PR #7360](https://github.com/forcedotcom/salesforcedx-vscode/pull/7360))

#### salesforcedx-vscode-services

- We fixed a bug where the `TemplateService` ignored custom metadata templates. ([PR #7333](https://github.com/forcedotcom/salesforcedx-vscode/pull/7333))

