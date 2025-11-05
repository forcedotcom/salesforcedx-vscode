# Extensions Best Practices

Extensions are a unique development environment. Understanding it is helpful.

start with the official docs: <https://code.visualstudio.com/api/get-started/your-first-extension>.

Extensions should be written in TS. Support for ESM in vscode extension is currently pretty sketchy (Nov 2025) so we recommend using cjs.

## Naming

don't name your extension `@salesforce/foo`. That's for npm packages. VSCode doesn't like that naming style.

## Localization

do it [like the extensions](../../contributing/localization.md)
do it how Microsoft currently suggests

- api <https://code.visualstudio.com/api/references/vscode-api#l10n>
- tools repo <https://github.com/microsoft/vscode-l10n>

## Logging

there's a few ways to do "logging". Also see [Telemetry](../Telemetry.md)

1. `console.*`
   1. will show up in the browser console
   1. will show up in vscode (run `Developer: toggle developer tools`) if you're running from a vsix
   1. will show up in your editor's `Debug Console` if you're running in extension host
1. outputChannel https://code.visualstudio.com/api/references/vscode-api#OutputChannel
   1. will show up, segregated by the channel name, in the `output` part of vscode. Make your channel name the extension name so it's easy to find

## Environment and Version Support

VSCode usually releases once a month. During those, they may update the version of electron that's shipped, which contains a related `node` version.

## Extension Activation

Try to avoid activating your extensions at startup (activationEvents = '\*')
Try to make your activation scope as "tight" as possible. ex:

- does it only activate when a certain file pattern is open?
- does it only activate when the user runs a command? (those are automatic...you don't need **any** activation event if your extension is all commands)

## Special Environment Considerations

### windows

The majority of our users are on Windows. Be aware of file path differences and where os-specific logic might be important.

### VSCode for the web

extensions **can** run on the web. It's not easy, so if you don't have that as a requirement any time soon, it's to be avoided

- alternate testing path
- polyfills for node api and other dependencies
- avoiding node fs-apis and handling virtual filesystem stuff (you **should** be using the vscode fs API and not the local filesystem to keep your code portable!)

If you do need to run on the web, refer to the org-browser extension for guidance and scripts. It represents our most up-to-date thinking

The main environment difference is the lack of a terminal. You can polyfill some node APIs (ex: path, os) but all of `child_process` is not available to you.

### codeBuilder

the product formerly known as codeBuilder is a hosted IDE+CLI in a vm. It's not subject to the same vscode-for-the-web restrictions, so extension development for [desktop + codeBuilder] should be identical.

### dependencies

Every extension will get its own copy of all its dependencies. There's no concept for sharing a node_modules, even between extensions published from the same repo. See [the doc on code reuse](./CodeReuse.md) for the limited mechanism for code reuse across extensions

## See Also

- [Code Reuse](./CodeReuse.md) - sharing code between extensions
- [Telemetry](../Telemetry.md) - telemetry patterns
- [Typescript](./Typescript.md) - recommended TS patterns
- [Build](../Build.md) - bundling and packaging
