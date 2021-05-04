# Salesforce Apex Library

[![CircleCI](https://circleci.com/gh/forcedotcom/salesforcedx-apex.svg?style=svg&circle-token=5869ea795e44e1b737f2f2a86fd51cdc2ac08629)](https://circleci.com/gh/forcedotcom/salesforcedx-apex)
![npm (scoped)](https://img.shields.io/npm/v/@salesforce/plugin-apex)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

## Introduction
Typescript library to support the Apex plugin and [Salesforce Extensions for VS Code](https://github.com/forcedotcom/salesforcedx-vscode/).

Note: This library is in beta and has been released early so we can collect feedback. It may contain bugs, undergo major changes, or be discontinued. Please report any issues via the [Issues tab](https://github.com/forcedotcom/salesforcedx-apex/issues).

<br/>

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


### Running the Test Suite

Run the test suite locally by building the project first and then running the tests.

```
$ yarn build
$ yarn test
```


