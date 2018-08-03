Similar to what vscode does, we are reporting on certain events that happen in the extensions in order to provide visibility on its usage.

## How it works

All extensions leverage the telemetryService in `salesforce-vscode-core` extension in order to send data. The service in `salesforce-vscode-core` is resposible of showing an information message to users and properly initializing the service for other extensions in this repository to leverage. In the same line as vscode, we provide the user an opt out mechanism. We check that user settings `telemetry.enableTelemetry` and `salesforcedx-vscode-core.telemetry.enabled` are enabled before initializing the service.

## Adding telemetry to an extension

- Add [vscode-extension-telemetry](https://github.com/Microsoft/vscode-extension-telemetry#readme) as a devDependency
- Add `salesforce-vscode-core` as a extensionDependency in package.json
- Create a telemetry service under src
- Initialize the telemetry service on the extension's `activate` call and initialize it using `salesforce-vscode-core` telemetry service
- Use the telemetry service where needed in the extension
