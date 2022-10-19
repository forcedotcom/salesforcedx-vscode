# Tests

## Introduction

There are several kinds of tests for the VS Code Extensions. This document
describes them and gives pointers on how to run/debug them.

The test types from most preferred to least preferred are:

1. Unit Tests - jest: Found under the test/jest directory.
   - `npm run test:unit`
1. End to End Tests - _TDB_

**Deprecated**

1. Unit Tests - mocha: Found under the test/unit directory. Not under active development.
   - `npm run test:unit`
1. vscode-integration - Tests that are somewhere between integration and unit tests. These are being phased out and there should be no new additions and minimual effort to
   - Close all instances of vscode.
   - `npm run test:integration`
1. system-tests - These have been disabled for a long time and should be deleted.

To run all tests, execute `npm run compile && npm run test` from the root
folder. Note the compile is only necessary for the integration tests.

### Unit Tests

Unit tests priorities are as follows:

1. Unit tests should focus on only the _unit_ of code under test.
   - 1 method/function
1. All dependancies should be stubbed/mocked.
1. Unit tests should be easy to write and execute
   - If your code is hard to test consider how it could be refactored to make it easier to test.
1. Use only jest and do not import mochi/sinon/chai.
1. Code coverage is one measure of how well we are unit testing our code. We should strive to code all code paths for any touched code in the repository. Code coverage can be generate by including the `--coverage` flag to jest when executing.

#### How to Write Jest Unit Tests

- Test files use the {fileUnderTestName}.test.ts format and should go under the same directory structure as the source in the test/jest folder.
  - Note this is to separate from the existing mocha unit tests and enable us to track our progress for moving off mocha to jest.
- VSCode extensions are our friend
  - https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner
- Tests can be executed from the IDE, command line, or via npm script.
  - IDE: assuming you are using the above extension, use the Run & Debug CodeLens found in test files.
  - Command line: `npx jest` will execute all unit tests in a package by default. If the integration tests are configured for jest in the package you may execute those using `npx jest -c jest.integration.config`. There are many options for configuring the test run see the [docs](https://jestjs.io/docs/cli) or `npx jest -h` for further guidance.
  - npm scripts:
    - `npm run test:unit`
    - `npm run test:integration`
    - `npm run test`

#### Jest Information

- ts-jest enables us to compile on the fly so no need for compilation while writing unit tests.
- Jest [Docs](https://jestjs.io/docs/getting-started) are very good.
- There is a shared top level jest config file for [unit](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/config/jest.base.config.js) and [integration](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/config/jest.integration.config.js) tests. The unit test configuration is shared between the exisiting tests in the unit directory and the tests in the jest directory.
- There is a top level jest setup script [setup-jest.js](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/scripts/setup-jest.ts) where we are stubbing the vscode module.
  -Jest is automatically injected into the tests so we don’t need to worry about importing jest, expect, etc.
