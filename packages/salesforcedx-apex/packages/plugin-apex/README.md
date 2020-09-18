salesforcedx-apex
=================

Apex commands

[![Version](https://img.shields.io/npm/v/salesforcedx-apex.svg)](https://npmjs.org/package/salesforcedx-apex)
[![CircleCI](https://circleci.com/gh/lcampos/salesforcedx-apex/tree/master.svg?style=shield)](https://circleci.com/gh/lcampos/salesforcedx-apex/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/lcampos/salesforcedx-apex?branch=master&svg=true)](https://ci.appveyor.com/project/heroku/salesforcedx-apex/branch/master)
[![Codecov](https://codecov.io/gh/lcampos/salesforcedx-apex/branch/master/graph/badge.svg)](https://codecov.io/gh/lcampos/salesforcedx-apex)
[![Greenkeeper](https://badges.greenkeeper.io/lcampos/salesforcedx-apex.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/lcampos/salesforcedx-apex/badge.svg)](https://snyk.io/test/github/lcampos/salesforcedx-apex)
[![Downloads/week](https://img.shields.io/npm/dw/salesforcedx-apex.svg)](https://npmjs.org/package/salesforcedx-apex)
[![License](https://img.shields.io/npm/l/salesforcedx-apex.svg)](https://github.com/lcampos/salesforcedx-apex/blob/master/package.json)

<!-- toc -->
* [Debugging your plugin](#debugging-your-plugin)
<!-- tocstop -->
<!-- install -->
<!-- usage -->
```sh-session
$ npm install -g @salesforce/plugin-apex
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
@salesforce/plugin-apex/0.0.11 darwin-x64 node-v12.4.0
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->
<!-- commands -->
* [`sfdx force:apex:execute [-f <filepath>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-forceapexexecute--f-filepath--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx force:apex:log:get [-i <id>] [-n <number>] [-d <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-forceapexlogget--i-id--n-number--d-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx force:apex:execute [-f <filepath>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

executes anonymous Apex code

```
USAGE
  $ sfdx force:apex:execute [-f <filepath>] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --apexcodefile=apexcodefile                                                   path to a local file that contains
                                                                                    Apex code

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  Executes one or more lines of anonymous Apex code entered on the command line, or executes the code in a local file.
  If you don’t run this command from within a Salesforce DX project, —-targetusername is required.
  To execute your code interactively, run this command with no parameters. At the prompt, enter all your Apex code; 
  press CTRL-D when you're finished. Your code is then executed in a single execute anonymous request.
  For more information, see "Anonymous Blocks" in the Apex Developer Guide.

EXAMPLES
  $ sfdx force:apex:execute -u testusername@salesforce.org -f ~/test.apex
  $ sfdx force:apex:execute -f ~/test.apex
  $ sfdx force:apex:execute 
  Start typing Apex code. Press the Enter key after each line, then press CTRL+D when finished.
```

_See code: [src/commands/force/apex/execute.ts](https://github.com/forcedotcom/salesforcedx-apex/blob/v0.0.11/src/commands/force/apex/execute.ts)_

## `sfdx force:apex:log:get [-i <id>] [-n <number>] [-d <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

fetch debug logs

```
USAGE
  $ sfdx force:apex:log:get [-i <id>] [-n <number>] [-d <string>] [-u <string>] [--apiversion <string>] [--json] 
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --outputdir=outputdir                                                         directory for saving the log files
  -i, --logid=logid                                                                 id of the log to display

  -n, --number=number                                                               number of most recent logs to
                                                                                    display

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as JSON

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  Fetches the specified log or given number of most recent logs from the scratch org. 
  To get the IDs for your debug logs, run "sfdx force:apex:log:list". 
  Use the --logid parameter to return a specific log. 
  Use the --number parameter to return the specified number of recent logs.
  Use the --outputdir parameter to specify the directory to store the logs in.
  Executing this command without parameters returns the most recent log.

EXAMPLES
  $ sfdx force:apex:log:get -i <log id>
  $ sfdx force:apex:log:get -i <log id> -u me@my.org
  $ sfdx force:apex:log:get -n 2 -c
  $ sfdx force:apex:log:get -d Users/Desktop/logs -n 2
```

_See code: [src/commands/force/apex/log/get.ts](https://github.com/forcedotcom/salesforcedx-apex/blob/v0.0.11/src/commands/force/apex/log/get.ts)_
<!-- commandsstop -->
<!-- debugging-your-plugin -->
# Debugging your plugin
We recommend using the Visual Studio Code (VS Code) IDE for your plugin development. Included in the `.vscode` directory of this plugin is a `launch.json` config file, which allows you to attach a debugger to the node process when running your commands.

To debug the `hello:org` command: 
1. Start the inspector
  
If you linked your plugin to the sfdx cli, call your command with the `dev-suspend` switch: 
```sh-session
$ sfdx hello:org -u myOrg@example.com --dev-suspend
```
  
Alternatively, to call your command using the `bin/run` script, set the `NODE_OPTIONS` environment variable to `--inspect-brk` when starting the debugger:
```sh-session
$ NODE_OPTIONS=--inspect-brk bin/run hello:org -u myOrg@example.com
```

2. Set some breakpoints in your command code
3. Click on the Debug icon in the Activity Bar on the side of VS Code to open up the Debug view.
4. In the upper left hand corner of VS Code, verify that the "Attach to Remote" launch configuration has been chosen.
5. Hit the green play button to the left of the "Attach to Remote" launch configuration window. The debugger should now be suspended on the first line of the program. 
6. Hit the green play button at the top middle of VS Code (this play button will be to the right of the play button that you clicked in step #5).
<br><img src=".images/vscodeScreenshot.png" width="480" height="278"><br>
Congrats, you are debugging!
