# Telemetry

Similar to what vscode does, we are reporting on certain events that happen in the extensions in order to provide visibility on its usage.

Patterns and implementations: [docs/Telemetry.md](../docs/Telemetry.md).

## What to track

Your probably want

- extension activation (how many times is your extension used)
- command execution (how many times are commands run)
- any special non-command UI operations (ex: in orgBrowser, retrieving some metadata)

## What not to track

- the telemetry framework will capture information about the environment (ex: os, geo) and package information (vscode version, extension version)
- be careful not to capture identifying information (ex: file paths often contain a user's name, so use only project-relative paths )

## Disabling Telemetry

There are several ways to disable telemetry for all Salesforce extensions.

- Turn off the Core Extension telemetry setting at the workspace level `("salesforcedx-vscode-core.telemetry.enabled": false)`
- Disable SF CLI telemetry
  - `sf config set disable-telemetry=true --global`

_Note_ for developers that are employed by Salesforce telemetry can not be disabled.

## Adding telemetry to an extension

- Add `salesforce-vscode-core` as a extensionDependency in package.json
- Create a telemetry service under src
- Initialize the telemetry service on the extension's `activate` call and initialize it using `salesforce-vscode-core` telemetry service
- Use the telemetry service where needed in the extension

## Live QA

**Dev Mode Protection**: By default, telemetry is blocked when running extensions in Development mode (Extension Host) to prevent polluting production App Insights data. 

To enable telemetry during development:

1. **Option 1 (Recommended)**: Enable the dev mode override setting:
   ```json
   {
     "salesforcedx-vscode-core.telemetry.allowDevMode": true
   }
   ```

2. **Option 2**: Install the extension from a VSIX file (runs in Production mode automatically)

## Debugging Telemetry Export

To observe telemetry export in action:

1. **Application Insights exporter**: Set Effect log level to Debug to see `ApplicationInsightsNodeExporter` debug logs (batch export status, per-span sends, errors). See [Debugging Custom Events Export Flow](../packages/salesforcedx-vscode-services/src/observability/README.md#debugging-custom-events-export-flow) for details.
2. **Full OTEL span tracing**: Enable `salesforcedx-vscode-salesforcedx.enableConsoleTraces` in VS Code settings to see all application spans
3. **Complete setup guide**: See [Local Debugging](../packages/salesforcedx-vscode-services/src/observability/README.md#local-debugging) in the observability docs

## Configuring OTEL Connection String

To route spans to a specific Azure App Insights instance, configure your extension's `package.json`:

```json
{
  "otelConnectionString": "InstrumentationKey=your-key;IngestionEndpoint=https://...",
  "aiKey": "optional-fallback-for-legacy-code"
}
```

Resolution precedence:
1. `otelConnectionString` — dedicated OTEL field (preferred)
2. `aiKey` — legacy field; bare UUIDs auto-normalized
3. Default — built-in instrumentation key

## Logging telemetry to a file

Often it is useful to be able to validate values being sent to telemetry without having to look into where the telemetry is reported.

For both local development and VSIX builds you can enable local telemetry logging

### Dev Mode

When running the extension in dev mode you can enable local logging by setting the following advanced setting

```
"salesforcedx-vscode-apex.advanced": {
"localTelemetryLogging": "true"
},
```

Advanced settings can be access via the advanced settings link found in the settings UI for the Extension.

### VSIX/Production Mode

When running extensions installed through the marketplace or directly from VSIX file you can enable local logging by setting the
following environment variables.

```
"VSCODE_LOG_LEVEL": "trace",
"VSCODE_LOGS": "/path/to/where/you/want/to/write/logs"
```

For local development this can be added to the configuration for launching the extensions in launch.json as a key of the "env" property. From VSIXs
you will need to ensure these environment variable are set prior to launching VSCode. The simplest way is to open a terminal and set the
environment variables there, then open vscode using the command line.

```
% export VSCODE_LOG_LEVEL="trace"
% export VSCODE_LOGS="/path/to/where/you/want/to/write/logs"
% code .
```
