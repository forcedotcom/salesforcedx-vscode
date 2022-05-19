# Developing

## Getting Started

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

<br/>

## Branches

- We work in `main`
- Our released (_production_) branch is `main`
- Our work happens in _topic_ branches (feature and/or bug fix)
  - These branches are based on `main` and can live in forks for external contributors or within this repository for authors
  - Be sure to prefix branches in this repository with `<developer-name>/`
  - Be sure to keep branches up-to-date using `rebase`

<br/>

## Development

Link the plugin from the top-level project directory and then run your command:

```
$ yarn plugin:link
$ sfdx force:apex:log:list -u myOrg@example.com
```

Install the library locally by adding this information to your project's `package.json`:

```
"@salesforce/apex-node": "file://path/to/salesforcedx-apex/packages/apex-node"
```

Using the library directly requires access to a Salesforce [Connection](https://forcedotcom.github.io/sfdx-core/classes/authinfo.html). Create an instance of the specific Apex service to get access to the required methods. For example, to get a list of logs:

```
$ const authInfo = await AuthInfo.create({ username: myAdminUsername });
$ const connection = await Connection.create({ authInfo });

$ const logService = new LogService(connection);
$ const logList = await logService.getLogRecords();
```

You can use the same pattern for the `Test Service` and `Execute Service` as well.

<br/>

## Testing
### Running the Test Suite

```
$ yarn test
```

> When running tests, code changes don't need to be built with `yarn build` first because the test suite uses ts-node as its runtime environment. Otherwise, run `yarn build` before manually testing changes.

### Running Individual Tests

While developing, you may temporarily edit the `test` command in the package.json of the package you are developing in to limit the command to your individual test file. For instance:

```
$ "test": "cross-env FORCE_COLOR=true mocha --recursive \"./test/**/run.test.ts\" --full-trace",
```

<br />

### Debugging the Plugin

We recommend using the Visual Studio Code (VS Code) IDE for your plugin development. Included in the `.vscode` directory of this plugin is a `launch.json` config file, which allows you to attach a debugger to the node process when running your commands. To debug a command:

1. If you linked your plugin to the Salesforce CLI using `yarn plugin:link`, call your command with the `dev-suspend` switch:

```
$ sfdx force:apex:log:list -u myOrg@example.com --dev-suspend
```

Alternatively, replace `sfdx` with `NODE_OPTIONS=--inspect-brk bin/run` and run your command:

```
$ NODE_OPTIONS=--inspect-brk bin/run force:apex:log:list -u myOrg@example.com
```

The inspect-brk option can also be used for debugging tests:

```
NODE_OPTIONS=--inspect-brk yarn test
```

2. Set some breakpoints in your code.
3. Click on the Debug icon in the Activity Bar to open up the Debugger view.
4. In the upper left hand corner, set the launch configuration to `Attach to Remote`.
5. Click the green play button on the left of the debugger view. The debugger should now by suspended on the first line of the program.
6. Click the green play button in the mini toolbar to continue running the program. 
<br /><br />
<img src="../.images/vscodeScreenshot.png" width="480" height="278">

<br />
Happy debugging!
