# Telemetry

## Old

We have code to send telemetry to `o11y` (usage metrics for product use) and appInsights (metrics and raw logs for dev/support use).

## Implementations

There are 3 patterns for using telemetry within this repo

1. ServiceProviderInterface (don't do this)
2. importing TelemetryService from the utils packages (won't work outside this repo, don't do that either)
3. Using telemetryService via the vscode-core extension <-- do that!

Probably the best example of this is the apex extension
[packages/salesforcedx-vscode-apex/src/index.ts](../packages/salesforcedx-vscode-apex/src/index.ts)

Briefly:

```ts
// get the core extension (see that fn for details of how to do this)
const vscodeCoreExtension = await getVscodeCoreExtension();
// Telemetry
const { name } = context.extension.packageJSON;
// get the telemetryService from the core ext.  Pass in any unique identifier you like, it's just keep the instances organized.  We used the extension name from package.json
const telemetryService = vscodeCoreExtension.exports.services.TelemetryService.getInstance(name);
// pass the activate fn's context.  This'll have all the information about your service (version, name, etc) that telemetry instance needs to know
await telemetryService.initializeService(context);
// optionally store this in a module for future access.  Alternatively, any other consumer could get the coreExt, then getInstance using the same key.
setTelemetryService(telemetryService);
```

AppInsights telemetry is not available for web clients, but `o11y` **should** work (not tried yet).

### access to AppInsights

It's a pain. If you need this, plan ahead.

## New

OrgBrowser extension is using open-telemetry via the Effect framework. See the [Observability README](../packages/salesforcedx-vscode-services/src/observability/README.md) for documentation on how to use OpenTelemetry with Effect for observability.

The advantage of otel is the ability to use spans and traces to provide logging and telemetry in a unified way across platforms including web.

## See Also

- [Observability README](../packages/salesforcedx-vscode-services/src/observability/README.md) - OpenTelemetry with Effect documentation
- [Extensions - Logging](./architecture/Extensions.md#logging) - console and outputChannel logging options
- [contributing/telemetry.md](../contributing/telemetry.md) - telemetry implementation details for this repo
