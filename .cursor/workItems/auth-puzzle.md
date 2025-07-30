# Auth puzzle

for web extensions, we are going to have to read the instanceUrl and accessToken from vscode settings [presume that Johnny's core code gets them in there somehow].

## settings service (done)

we need a new service in vscode-services that reads and manages vscode settings. It can kinda do what salesforceCoreSettings is doing, but can be simpler to start with

it'll go in services/vscode

## connection service (done)

once that's done, it needs to be an Effect Requirement for ConnectionService. Then, using salesforce/core/Global.isWeb,
if web: we'll get token/url from the Settings and return that Connection.
if not web: do the normal ConfigAgg, fs, target-org, etc that we currently have

## web testing

how do I get those values into settings as part of starting up the vscode-test-web?
