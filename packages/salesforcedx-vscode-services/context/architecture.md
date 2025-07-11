# Architecture

## Contents

vscode-services will be a no-ui extension that provides an API to other extensions. Included in the API will be

It will need to run on the web and the desktop extension.

services from sfdx-core (exports as services/core)

- [ ] get a Connection
- [ ] get a Project

services from vscode (export as services/vscode)

- [ ] fs (helpers for the fs api, basically what's in `fs.ts`)
- [ ] WorkspaceContextUtil
- [ ] Telemetry

## Stack

All ESM
Typescript
Jest
Effect https://effect.website/docs

## Style

do it functional-style, avoid classes except where VSCode APIs force us to

## TBD

do we pass Effect stuff out of the package to the consumer?
