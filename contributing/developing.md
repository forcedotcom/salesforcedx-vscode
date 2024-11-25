# Developing

## Pre-requisites

1.  We are requiring Node 20 and npm v10 at a minimum. If you need to work with multiple versions of Node, you might consider using [nvm](https://github.com/creationix/nvm).
1.  This repository uses [Lerna](https://lerna.js.org) to manage it as a
    _monorepo_. Please install Lerna globally using `npm install --global lerna`.
1.  We use `eslint` so please install it using `npm install --global eslint`.
1.  It is preferred, though not required, that you use the Insiders version of VS
    Code from [here](https://code.visualstudio.com/insiders).
1.  There is a list of recommended extensions for this workspace in
    .vscode/extensions.json. The first time you open VS Code on this workspace,
    it will ask you to install them. **Please do so since this includes the
    linters and formatters**.

## Pre-requisites for Windows Development

These are instructions for _developing_ the extensions on Windows since there
are some quirkiness with the way Windows behaves. This does not affect the
actual extensions that we distribute.

1.  Same as above.
1.  You should use Bash Shell instead of Powershell or the Command Prompt.
1.  If you want to use the integrated terminal in VS Code, you can see that
    following the instructions
    [here](https://code.visualstudio.com/docs/editor/integrated-terminal#_windows);
1.  You should install VS Code Insiders from
    [here](https://code.visualstudio.com/insiders). Without this, you won't be
    able to run the end-to-end tests while VS Code is open. You will see an error
    of the form "Running extension tests from the command line is currently only
    supported if no other instance of Code is running." To circumvent that you
    could close VS Code each time you run the tests. Or, you can install the
    Insiders version so that it can run the tests in Code while you work in the
    Insiders version.

## Structure

### Packages

The packages directory contains the different npm packages. The naming
convention is that anything with 'salesforcedx-vscode' is a VS Code extension.

## Typical workflow

You would only do this once after you cloned the repository.

1.  Clone this repository from git.
1.  `cd` into `salesforcedx-vscode`.
1.  We develop on the `develop` branch and release from the `main` branch. At
    this point, you should do initiate a `git checkout -t origin/develop` unless
    you are working on releasing.
1.  `npm install` to bring in all the top-level dependencies. Because of the
    `postinstall` script, this also runs `npm run bootstrap` for you
    automatically the first time.
1.  Open the project in VS Code.

You would usually do the following each time you close/reopen VS Code:

1.  [Optional] Open the Command Palette > Tasks: Run Task > Bootstrap (this
    essentially runs `npm run bootstrap`). This is required if you change the
    dependencies in any of the package.json.
1.  If you wish to build, you can invoke Command Palette > Build Task
    (Ctrl+Shift+B or Cmd+Shift+B on Mac). The errors will show in the Problems
    panel. There is a known issue with the mapping so clicking on the error won't
    open the file.
1.  In VS Code, you can invoke Command Palette. Then type in "debug " (there is
    space after) and from the launch configuration dropdown, pick "Launch
    Extensions". This launch extension will actually do a build for you as well.
1.  In VS Code, you can invoke Command Palette. Then type in "debug " (there is
    space after) and from the launch configuration dropdown, pick "Launch
    Extensions without compile" if you had already build locally before.
1.  In VS Code, you can invoke Command Palette. Then type in "debug " (there is
    space after) and from the launch configuration dropdown, pick any of "Launch
    - Tests".

For more information, consult the VS Code
[doc](https://code.visualstudio.com/docs/extensions/debugging-extensions) on how
to run and debug extensions.

When you are ready to commit

1.  Run `npm run lint` to run eslint in more thorough mode to identify any
    errors.
1.  Some of the items can be fixed using `eslint . --fix`. Some you
    might need to fix them manually.

This linting steps should be done later as part of the continuous integration
runs but that is how you would check locally first.

## Apex Debugger

Typically, VSCode launches the debug adapter in a separate process and talks to
it through stdin and stdout. In order to debug the adapter, it has to run in
server mode. This is achieved by launching the adapter with a port number. The
launch configuration would be like the following.

```json
{
  "name": "Launch Apex Debug adapter",
  "type": "node",
  "request": "launch",
  "cwd": "${workspaceRoot}",
  "program": "${workspaceRoot}/packages/salesforcedx-vscode-apex-debugger/out/src/adapter/apexDebug.js",
  "args": ["--server=4711"],
  "sourceMaps": true,
  "outFiles": [
    "${workspaceRoot}/packages/salesforcedx-vscode-apex-debugger/out/src/**/*.js"
  ]
}
```

The extension also has to be launched so you can use the Apex Debugger. However,
you will need to configure the Apex Debugger to connect to the debug adapter
server by adding a `debugServer` attribute with the same port number, like the
following.

```json
{
  "name": "Launch Apex Debugger",
  "type": "apex",
  "request": "launch",
  "userIdFilter": "",
  "requestTypeFilter": "",
  "entryPointFilter": "",
  "salesforceProject": "${workspaceRoot}",
  "debugServer": 4711
}
```

For more information, consult the VS Code
[doc](https://code.visualstudio.com/docs/extensions/example-debuggers) on how to
develop debugger extensions.

## List of Useful commands

_These commands assume that they are executed from the top-level directory.
Internally, they delegate to `lerna` to call them on each npm module in the
packages directory._

### `npm run bootstrap`

This bootstraps the packages by issuing an `npm install` on each package and
also symlinking any package that are part of the packages folder.

You would want do this as the first step after you have made changes in the
modules.

If you change the dependencies in your package.json, you will also need to run
this command.

### `npm run compile`

This invokes typescript compiler on the packages in the monorepo using [typescript project references](https://www.typescriptlang.org/docs/handbook/project-references.html).

- `npm run compile:watch` invokes typescript compiler to watch for changes in the background and compile only changed code and its dependencies. This would not invoke the post compile steps such as webpack or copying file artifacts.
- `npm run compile:clean` cleans previously compiled artifacts and invokes compile
- `npm run check:typescript-project-references` validates typescript project references and would error if there are any missing references

### `npm run clean`

This run `npm run clean` on each of the package in packages.

### `npm run watch`

This runs `npm run watch` on each of the package in packages. The `--parallel`
flag tell it to run each in a separate process so that it won't block the main
thread.

### `npm run test`

This runs `npm test` on each of the packages. The `--concurrency 1` is essential
for VS Code extension tests since they require an instance of Code to run in.
And, only one instance of that can be running at a single time.

### `npm run lint`

This runs `npm lint` on each of the packages. If there are no errors/warnings
from eslint, then you get a clean output. But, if they are errors from eslint,
you will see a long error that can be confusing – just focus on the eslint
errors. The results of this is deeper than what the eslint extension in VS Code
does because of [semantic lint
rules](https://typescript-eslint.io/linting/typed-linting/) which requires a
tsconfig.json to be passed to eslint.

### `npm run check:links`

Runs `markdown-link-check` on all markdown files in the repo to check for any broken links.

- Does not check html files.
- Ignores [429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
  - We get 429 mostly from github as there are many URLs pointing to PRs etc in Changelog

### `npm run check:deps`

This runs `depcheck` on each package to check for unused and missing dependencies. Pay particular attention to "Missing dependencies". Unused dependency result might have [false positives](https://github.com/depcheck/depcheck#false-alert). Check code usage to verify.

### `npm run check:peer-deps`

This runs [check-peer-dependencies](https://www.npmjs.com/package/check-peer-dependencies) which

> Checks peer dependencies of the current NodeJS package. Offers solutions for any that are unmet.

Add any missing peer dependencies identified to the package's dev dependency.

### `npm run vsix:install`

This finds VSIX packages built locally (using `npm run vscode:package`) and installs them to Visual Studio Code Insiders.

- The installation would overwrite any installed packages in insiders with same name and version (under `~/.vscode-insiders/extensions`).
- To debug installed extensions you can use Command Palette: `Developer > Show Logs .. > Extension Host`

## Node Configuration

### .npmrc

The npmrc allows for project-level [configuration](https://docs.npmjs.com/cli/v8/using-npm/config) of the npm environment.

### .nvmrc

Our nvmrc specifies the minimum node version required to run the project.

### Development Mode Local Telemetry Logging

During development and quality assurance testing, it can be helpful to validate telemetry events by logging to a local file when running the extension in Development Mode. Enable local dev mode telemetry logging using an advanced setting in your settings.json file:

> "salesforcedx-vscode-core.advanced": {
> "localTelemetryLogging": "true"
> }

With the above configuration, all extensions that use the telemetry module from the salesforcedx-vscode-core extension will log telemetry events to a local file at the project root.

### Production Mode Local Telemetry Logging

When the extension is running in Production mode, telemetry events can also be streamed to a local file. This can be helpful when debugging the built extensions or when debugging on a User's machine.

With the following environment variables present, VS Code will log telemetry events to a local file at a location specified by your configuration:

> VSCODE_LOGS=path/to/local/telemetry/file

> VSCODE_LOG_LEVEL=trace
