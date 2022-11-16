# Developing

## Branches

- Our released (_production_) branch is `main`
- Our work happens in _topic_ branches (feature and/or bug fix)
  - These branches are based on `main` and can live in forks for external contributors or within this repository for authors
  - Be sure to prefix branches in this repository with `<developer-name>/`
  - Be sure to keep branches up-to-date using `rebase`

<br/>

## Development

### Building the Library
Clone the project and `cd` into it:

```
$ git clone git@github.com:forcedotcom/salesforcedx-apex.git
$ cd salesforcedx-apex
```

Ensure that you have [Yarn](https://yarnpkg.com/) installed, then run:

```
$ yarn install
$ yarn build
```
### Using the Library 

Install the library locally by adding this information to your project's `package.json`:

```
"@salesforce/apex-node": "file://path/to/salesforcedx-apex" (Windows)
or 
"@salesforce/apex-node": "/Users/myUser/path/to/salesforcedx-apex" (MacOS)
```

Using the library directly requires access to a Salesforce [Connection](https://forcedotcom.github.io/sfdx-core/modules/org_authInfo.html). Create an instance of the specific Apex service to get access to the required methods. For example, to get a list of logs:

```
$ const authInfo = await AuthInfo.create({ username: myAdminUsername });
$ const connection = await Connection.create({ authInfo });

$ const logService = new LogService(connection);
$ const logList = await logService.getLogRecords();
```

Similarly, to run tests using the Test Service: 

```
$ const authInfo = await AuthInfo.create({ username: myAdminUsername });
$ const connection = await Connection.create({ authInfo });

$ const testService = new TestService(connection);
$ const payload = testService.buildAsyncPayload(testLevel, tests, classnames, suitenames);
$ const testResults = await testService.runTestAsynchronous(payload, codeCoverage);
```

You can use the same pattern for the `Execute Service` as well.

<br/>

## Testing

### Running the Test Suite

```
$ yarn test
```

> When running tests, code changes don't need to be built with `yarn build` first because the test suite uses ts-node as its runtime environment. Otherwise, run `yarn build` before manually testing changes.

### Running Individual Tests

While developing, you may temporarily edit the `test` command in the package.json of the package to limit the command to your individual test file. For instance:

```
$ "test": "npx cross-env FORCE_COLOR=true mocha --recursive \"./test/**/aSpecificTest.test.ts\" --full-trace",
```

<br />
