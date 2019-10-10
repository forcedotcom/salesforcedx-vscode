---
title: 'FAQ: Telemetry'
lang: en
---

## Why do you collect data?

Salesforce collects usage data and metrics to help us improve Salesforce Extensions for VS Code.

## What data is collected?

Salesforce collects anonymous information related to the usage of the extensions, such as which commands were run, as well as performance and error data.

## How do I disable telemetry reporting?

If you don’t wish to send usage data to Salesforce, you can set the `salesforcedx-vscode-core.telemetry.enabled` setting to `false`.

On Windows or Linux, select **File** > **Preferences** > **Settings**. On macOS, select **Code** > **Preferences** > **Settings**. Then, to silence all telemetry events from the VS Code shell and disable telemetry reporting, add the following option.

```json
"salesforcedx-vscode-core.telemetry.enabled": false
```

> IMPORTANT: This option requires a restart of VS Code to take effect.

> NOTE: We also respect the global telemetry setting `telemetry.enableTelemetry`; if that is set to `false`, Salesforce telemetry is disabled. For more information see [Microsoft’s documentation](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).
