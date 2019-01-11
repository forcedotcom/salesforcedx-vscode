---
title: 'FAQ: Telemetry'
---

## Why data is collected?

Salesforce collects usage data and metrics to help us improve the Saleforce Extensions for VS Code.

## What data is collected?

Salesforce collects anonymous information related to the usage of the extensions such as which commands were run as well as performance and error data.

## How to disable telemetry reporting?

If you don't wish to send usage data to Salesforce, you can set the `salesforcedx-vscode-core.telemetry.enabled` setting to `false`.

From File > Preferences > Settings (macOS: Code > Preferences > Settings), add the following option to disable telemetry reporting, this will silence all telemetry events from the VS Code shell.

```
"salesforcedx-vscode-core.telemetry.enabled": false
```

> IMPORTANT: This option requires a restart of VS Code to take effect.

> NOTE: We also respect the global telemetry setting `telemetry.enableTelemetry`, if that is set to `false` Salesforce telemetry will also be disabled. For more information see [Microsoft's documentation](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).
