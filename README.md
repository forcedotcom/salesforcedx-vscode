# Salesforce Development Tools for Visual Studio Code 

[![Build Status](https://travis-ci.com/forcedotcom/salesforcedx-vscode.svg?token=CS8GSGJmGgyJRoKddVL6&branch=develop)](https://travis-ci.com/forcedotcom/salesforcedx-vscode)

## Pre-requisites

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

## Structure

### Packages

The packages directory contains the different npm packages. The naming
convention is that anything with 'vscode' is a VS Code extension. Anything
without 'vscode' is a standalone npm package that can be installed normally
through npm.

## Typical workflow

You would only do this once after you cloned the repository.

1. Clone this repository from git.
1. `cd` into `salesforcedx-vscode`.
1. `npm install` to bring in all the top-level dependencies
1. Open the project in VS Code.

You would usually do the following each time you close/reopen VS Code:

1. [Optional] Open the Command Palette > Tasks: Run Task > Bootstrap  (this
   essentially runs `lerna bootstrap`). This is required if you change the
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

1. Run `lerna run lint` to run tslint in more thorough mode to identify any
   errors.
1. Some of the items can be fixed using `tstlint --project . fix`. Some you
   might need to fix them manually.

This linting steps should be done later as part of the continuous integration
runs but that is how you would check locally first.

## List of Useful commands

### `lerna bootstrap`

This bootstraps the packages by issuing an `npm install` on each package and
also symlinking any package that are part of the packages folder.

You would want do this as the first step after you have made changes in the
modules.

If you change the dependencies in your package.json, you will also need to run
this command.

### `lerna run compile`

This runs `npm run compile` on each of the package in packages.

### `lerna run clean`

This run `npm run clean` on each of the package in packages.

### `lerna run --parallel watch`

This runs `npm run watch` on each of the package in packages. The `--parallel`
flag tell it to run each in a separate process so that it won't block the main
thread.

### `lerna run test --concurrency 1`

This runs `npm test` on each of the packages. The `--concurrency 1` is essential
for VS Code extension tests since they require an instance of Code to run in.
And, only one instance of that can be running at a single time.

### `lerna run lint`

This runs `npm lint` on each of the packages. If there are no errors/warnings
from tslint, then you get a clean output. But, if they are errors from tslint,
you will see a long error that can be confusing – just focus on the tslint
errors. The results of this is deeper than what the tslint extension in VS Code
does because of [semantic lint
rules](https://palantir.github.io/tslint/usage/type-checking/) which requires a
tsconfig.json to be passed to tslint.
