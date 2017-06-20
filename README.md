# Salesforce Development Tools for Visual Studio Code

## Pre-requisites

1. This repository uses [Lerna](https://lernajs.io/) to manage it as a
   _monorepo_.  Please install Lerna globally using `npm install
--global lerna`.
1. It is preferred, though not required, that you use the Insiders
   version of VS Code from
[here](https://code.visualstudio.com/insiders).
1. There is a list of recommended extensions for this workspace in
   .vscode/extensions.json. The first time you open VS Code on this
workspace, it will ask you to install them. **Please do so since it
includes the linters and formatters**.

## Structure

### Packages

The packages directory contains the different npm packages. The naming
convention is that anything with 'vscode' is a VS Code extension.
Anything without 'vscode' is a standalone npm package that can be
installed normally through npm.

## Typical workflow

1. Clone this repository from git.
1. `cd` into `salesforcedx-vscode`.
1. Open the project in VS Code.
1. `lerna bootstrap`.
1. `lerna run --parallel watch`.
1. In VS Code, open the debug view (Ctrl+Shift+D or Cmd+Shift+D on Mac)
   and from the launch configuration dropdown, pick "Launch Extensions".

For more information, consult the VS Code
[doc](https://code.visualstudio.com/docs/extensions/debugging-extensions)
on how to run and debug extensions.

Note: There are issues with source maps from running the extensions from
the root-level. Thus, you might need to set the breakpoints in the
generated .js files instead of the .ts files.

## List of Useful commands

### `lerna bootstrap`

This bootstraps the packages by issuing an `npm install` on each package
and also symlinking any package that are part of the packages folder.

You would want do this as the first step after you have made changes in
the modules.

If you change the dependencies in your package.json, you will also need
to run this command.

### `lerna run compile`

This runs `npm run compile` on each of the package in packages.

### `lerna run clean`

This run `npm run clean` on each of the package in packages.

### `learn run --parallel watch`

This runs `npm run watch` on each of the package in packages. The
`--parallel` flag tell it to run each in a separate process so that it
won't block the main thread.

