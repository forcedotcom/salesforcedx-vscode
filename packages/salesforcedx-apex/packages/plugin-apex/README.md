# Salesforce Apex Plugin

[![CircleCI](https://circleci.com/gh/forcedotcom/salesforcedx-apex.svg?style=svg&circle-token=5869ea795e44e1b737f2f2a86fd51cdc2ac08629)](https://circleci.com/gh/forcedotcom/salesforcedx-apex)
![npm (scoped)](https://img.shields.io/npm/v/@salesforce/plugin-apex)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

## Introduction
This is an oclif plugin that supports the Salesforce Apex commands. The plugin is bundled with the [salesforcedx plugin](https://www.npmjs.com/package/salesforcedx).

Note: This plugin is in beta and has been released early so we can collect feedback. It may contain bugs, undergo major changes, or be discontinued.

## Getting Started

If you're interested in contributing, take a look at the [CONTRIBUTING](../../CONTRIBUTING.md) guide.

You can find more information about commands that the plugin provides in the [Commands](../../contributing/commands.md) doc.

<br />

### Building the Plugin

Clone the project and `cd` into it:

```
$ git clone git@github.com:forcedotcom/salesforcedx-apex.git
$ cd salesforcedx-apex
```

Ensure you have [Yarn](https://yarnpkg.com/) installed, then run:

```
$ yarn install
$ yarn build
```
<br />

### Linking the Plugin
Link the plugin from the `plugin-apex` package directory and then run your command:

```
$ sfdx plugins:link .
$ sfdx force:apex:log:list -u myOrg@example.com
```

Alternatively, you can also run the command from the `plugin-apex` package directory without linking the plugin:

```
$ NODE_OPTIONS=--inspect-brk bin/run force:apex:log:list -u myOrg@example.com
```

If you're interested in running tests for the Apex plugin or building the associated Typescript library locally, take a look at the [Developing](../../contributing/developing.md) doc.
