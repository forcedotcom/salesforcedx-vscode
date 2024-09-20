# Telemetry

Similar to what vscode does, we are reporting on certain events that happen in the extensions in order to provide visibility on its usage.

## Disabling Telemetry
There are several ways to disable telemetry for all Salesforce extensions.
- Turn off the Core Extension telemetry setting at the workspace level `("salesforcedx-vscode-core.telemetry.enabled": false)`
- Disable SF CLI telemetry 
  - `sf config set disable-telemetry=true --global`

*Note* for developers that are employed by Salesforce telemetry can not be disabled. 

## Adding telemetry to an extension

- Add [vscode-extension-telemetry](https://github.com/Microsoft/vscode-extension-telemetry#readme) as a devDependency
- Add `salesforce-vscode-core` as a extensionDependency in package.json
- Create a telemetry service under src
- Initialize the telemetry service on the extension's `activate` call and initialize it using `salesforce-vscode-core` telemetry service
- Use the telemetry service where needed in the extension

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
 you will need to ensure these environment variable are set prior to launching VSCode.  The simplest way is to open a terminal and set the 
 environment variables there, then open vscode using the command line. 

```
% export VSCODE_LOG_LEVEL="trace"
% export VSCODE_LOGS="/path/to/where/you/want/to/write/logs"
% code .
```
