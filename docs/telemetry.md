Similar to what vscode does, we are reporting on certain events that happen in the extensions in order to provide visibility on its usage. All extensions leverage the telemetryService in `salesforce-vscode-core` extension in order to send data. The telemetryService in `salesforce-vscode-core` is in charge of showing the telemetry message to users and properly initializing the service for other extensions in this repository to leverage. In the same line as vscode, we check user settings `telemetry.enableTelemetry` and `salesforcedx-vscode-core.telemetry.enabled` being enabled before initializing the service.

## Adding telemetry to an extension

- Add [vscode-extension-telemetry]() as a devDependency
- Add `salesforce-vscode-core` as a extensionDependency in package.json
- Create a telemetry service under src
- Initialize the telemetry service on the extension's `activate` call and initialize it using `salesforce-vscode-core` telemetry service
- Use the telemetry service where needed in the extension
