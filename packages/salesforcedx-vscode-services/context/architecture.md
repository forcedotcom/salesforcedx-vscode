# Architecture

## Contents

vscode-services will be a no-ui extension that provides an API to other extensions. Included in the API will be

It will need to run on the web and the desktop extension.

services from sfdx-core (exports as services/core)

- [x] get a Connection
- [x] get a Project
- [x] retrieve some metadata using SDR
- [x] get Config

services from vscode (export as services/vscode)

- [x] fs (helpers for the fs api, basically what's in `fs.ts`)
- [x] Workspace (getWorkspacePath)
- [x] get the vscode outputChannel for an extension and write to it

## Stack

All ESM
Typescript
Jest
Effect https://effect.website/docs

## Style

do it functional-style, avoid classes except where VSCode APIs force us to

## TBD

do we pass Effect stuff out of the package to the consumer?
