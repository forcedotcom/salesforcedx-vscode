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

## PFT/PDP

If you need events to go to a Product Feature Taxonomy Id other than VSCode Extensions, add `productFeatureId` to your extension's package.json. You must also set `enableO11y` and `o11yUploadEndpoint` (o11y init is skipped otherwise; see telemetry.ts lines 146-149). Example (from salesforcedx-vscode-metadata):

```json
"enableO11y": "true",
"o11yUploadEndpoint": "https://794testsite.my.site.com/byolwr/webruntime/log/metrics",
"productFeatureId": "aJCEE0000000mLm4AI"
```

IDs must start with `aJC` (see `salesforcedx-utils-vscode/src/telemetry/schema.ts`).

### Using old telemetry

If using the old TelemetryService stuff from core extension, you'll get events for CommandExecution. From an extension outside this repo (with `extensionDependency` on `salesforce.salesforcedx-vscode-core`):

**Option A: Use SfCommandletExecutor** – telemetry is sent automatically when the command completes. Extend `SfCommandletExecutor`, implement `build()`, run via `SfCommandlet`:

```ts
// In your command handler – get executor class from core API:
const api = await coreExt.activate();
const { SfCommandletExecutor, SfCommandlet, SfWorkspaceChecker } = api;
```

**Option B: Manual sendCommandEvent**

```ts
const telemetryService = api.services.TelemetryService.getInstance(context.extension.packageJSON.name);
await telemetryService.initializeService(context);
// …
telemetryService.sendCommandEvent('my_command_log_name', startTime, properties, measurements);
```

properties must to include (nothing else will got to PDP, but you might want them in splunk)

```ts
{
  commandName: 'foo'; // name it whatever you like.  If it's a real "command" in package.json, this will normally be the commandId
}
```

### new services extension

If using the New services extension, use `registerCommandWithLayer` from the services API.

Commands registered this way get automatic spans, which go to all the configured telemetry destinations (o11y, appInsights, local docker, etc). See [services-extension-consumption skill](../.claude/skills/services-extension-consumption/SKILL.md)

## See Also

- [services-extension-consumption](../.claude/skills/services-extension-consumption/SKILL.md) - Consuming salesforcedx-vscode-services API
- [Observability README](../packages/salesforcedx-vscode-services/src/observability/README.md) - OpenTelemetry with Effect documentation
- [Extensions - Logging](./architecture/Extensions.md#logging) - console and outputChannel logging options
- [contributing/telemetry.md](../contributing/telemetry.md) - telemetry implementation details for this repo
