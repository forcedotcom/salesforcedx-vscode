# Salesforce Development Tools for Visual Studio Code

## Pre-requisites

This repository uses (Lerna)[https://lernajs.io/] to manage it as a
_monorepo_.  Please install Lerna globally using `npm install --global
lerna@^2.0.0-beta.0`.

## Packages

The packages directory contains the different npm packages. The naming
convention is that anything with 'vscode' is a VS Code extension.
Anything without 'vscode' is a standalone npm package that can be
installed normally.

## Useful commands

### `lerna bootstrap`

This bootstraps the packages by issuing an `npm install` on each package
and also symlinking any package that are part of the packages folder.

You would want do this as the first step after you have made changes in
the modules.

### `lerna run compile`

This runs `npm run compile` on each of the package in packages.

### `lerna run clean`

This run `npm run clean` on each of the package in packages.

