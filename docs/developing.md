## Pre-requisites

1. We are using Node 7. If you need to work with multiple versions of Node, you
   might consider using [nvm](https://github.com/creationix/nvm).
1. This repository uses [Lerna](https://lernajs.io/) to manage it as a
   _monorepo_.  Please install Lerna globally using `npm install --global
   lerna`.
1. We use `tslint` so please install it using `npm install --global tslint`.
1. It is preferred, though not required, that you use the Insiders version of VS
   Code from [here](https://code.visualstudio.com/insiders).
1. There is a list of recommended extensions for this workspace in
   .vscode/extensions.json. The first time you open VS Code on this workspace,
   it will ask you to install them. **Please do so since this includes the
   linters and formatters**.

## Pre-requisites for Windows Development

These are instructions for _developing_ the extensions on Windows since there
are some quirkiness with the way Windows behaves. This does not affect the
actual extensions that we distribute.

1. Same as above.
1. You should use Bash Shell instead of Powershell or the Command Prompt.
1. If you want to use the integrated terminal in VS Code, you can see that
   following the instructions
   [here](https://code.visualstudio.com/docs/editor/integrated-terminal#_windows);
1. You should install VS Code Insiders from
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

1. Clone this repository from git.
1. `cd` into `salesforcedx-vscode`.
1. We develop on the `develop` branch and release from the `master` branch. At
   this point, you should do initiate a `git checkout -t origin/develop` unless
   you are working on releasing.
1. `npm install` to bring in all the top-level dependencies
1. Open the project in VS Code.

You would usually do the following each time you close/reopen VS Code:

1. [Optional] Open the Command Palette > Tasks: Run Task > Bootstrap  (this
   essentially runs `npm run bootstrap`). This is required if you change the
   dependencies in any of the package.json.
1. If you wish to build, you can invoke Command Palette > Build Task
   (Ctrl+Shift+B or Cmd+Shift+B on Mac). The errors will show in the Problems
   panel. There is a known issue with the mapping so clicking on the error won't
   open the file.
1. In VS Code, open the debug view (Ctrl+Shift+D or Cmd+Shift+D on Mac) and from
   the launch configuration dropdown, pick "Launch Extensions".
1. In VS Code, open the debug view (Ctrl+Shift+D or Cmd+Shift+D on Mac) and from
   the launch configuration dropdown, pick "Launch * Tests".

For more information, consult the VS Code
[doc](https://code.visualstudio.com/docs/extensions/debugging-extensions) on how
to run and debug extensions.

When you are ready to commit

1. Run `npm run lint` to run tslint in more thorough mode to identify any
   errors.
1. Some of the items can be fixed using `tslint --project . fix`. Some you
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
  "sfdxProject": "${workspaceRoot}",
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

This runs `npm run compile` on each of the package in packages.

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
from tslint, then you get a clean output. But, if they are errors from tslint,
you will see a long error that can be confusing – just focus on the tslint
errors. The results of this is deeper than what the tslint extension in VS Code
does because of [semantic lint
rules](https://palantir.github.io/tslint/usage/type-checking/) which requires a
tsconfig.json to be passed to tslint.
