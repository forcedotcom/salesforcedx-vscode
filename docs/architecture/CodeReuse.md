# Code Reuse

## Libraries

If you're not familiar with these libraries, you'll see them widely used in DX tools (cli, mcp, vscode extensions).

<https://github.com/forcedotcom/sfdx-core> (owned by CLI)
<https://github.com/forcedotcom/source-deploy-retrieve> (owned by CLI)
<https://github.com/forcedotcom/source-tracking> (owned by CLI)
<https://github.com/forcedotcom/salesforcedx-apex> (owned by IDE Foundations)
<https://github.com/forcedotcom/salesforcedx-templates> (owned by IDE Foundations)

## CLI Commands

If your extension needs to run CLI or other terminal commands (and isn't going to run as a web extension!) your simplest option is to use `child_process` to execute your command. Prefer the json output for parsability by your extension.

Do not use any of the `*Executor` code or try to replicate it in your repo.

## Sharing Code Between Extensions

Originally, extensions in this monorepo shared some utils packages (utils and utils-vscode). These do not publish npm packages and thus are not useful outside this monorepo. You can declare an `extensionDependencies` in your package.json to ensure other extensions you want to depend on are installed.

### old

There's also an extension called vscode-core which supplies many common features. Extensions "export" the return type of their `activate` method, which can be called by other extensions. This is probably the best way to minimize dependencies.

See the example from [Telemetry.md](../Telemetry.md) for how to get the TelemetryService from the core extension. Using the same technique, you could also get a Salesforce Project, or a Connection to the target-org, etc without having to work with the sfdx-core library directly.

It is also possible to call commands from another extension if they're properly registered. It's somewhat fragile because it's an implicit dependency (you could change the id of a command without the other extension knowing) and should be a last resort.

If you're developing multiple extensions, a shared code package (similar to the utils packages in this repo) can work.

### new

We're moving towards the `vscode-services` as the shared library of choice (get a connection, do a deploy) instead of every extension needing to have all the libraries and utils imported.

To get TS support outside this repo, `import type {SalesforceVSCodeServicesApi} from '@salesforce/vscode-services'`. See the [extensionProvider.ts](../../packages/salesforcedx-vscode-org-browser/src/services/extensionProvider.ts) in the new org-browser extension as a model.

Then, extensions merely need to ensure that the extension whose services they depend on is installed, running, and active, before using its API.

If your work is going to create something you think belongs in `vscode-services` please open a PR.

### versioning

Both of these options are **runtime dependencies** such that your extension is stuck with whatever version of the extension is running in the user's vscode environment (which we don't control on desktop).

If you need to ensure or handle a min/max version of the extension you depend on, the result of `getExtension` has access to the packageJson (and thus the version).

## See Also

- [Extensions - Dependencies](./Extensions.md#dependencies) - how dependencies work across extensions
- [Typescript](./Typescript.md) - recommended TS patterns for shared code
