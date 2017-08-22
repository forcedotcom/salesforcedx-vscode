# Introduction

There are several kinds of tests for the VS Code Extensions. This document
describes them and give pointers on how to run/debug them.

These tests are describe in the order in which we prefer to write them. Always
prefer unit tests, integration tests, and system tests, in that order.

To run all tests, execute `npm run compile && npm run test` from the top-level
folder.

## Standalone (sans VS Code) Tests

We have several modules that do not have any dependencies on VS Code. For
instance, the salesforce-apex-debugger and salesforce-utils-vscode module. You
would write tests using Mocha and Chai as you would normally for NPM modules.

## VS Code Integration Tests

VS Code provides its own special way to run tests that require access to the
extension development host. Basically, it launches your test in another instance
of itself. You have control over what extensions are launched, the tests that
are run, and also the workspace that it will run in. This gives you quite a bit
of flexibility.

More information can be found at the doc
[site](https://code.visualstudio.com/docs/extensions/testing-extensions).

### Assumptions

While the test runner is highly configurable, there are certain assumptions that
will help make writing the tests easier.

1. Ensure that your tests go into the `test` folder.
1. Ensure that you have an index.ts file in the test folder that follows what is
   in the standard configuration (copy from an existing one if you don't have
   it).
1. Ensure that your test files are named like <something>.test.ts. The .test. in
   the middle is essential
1. Ensure that your .js test files are compiled into the out/test directory.

### Running interactively

There are configurations already created for you at the top level
.vscode/launch.json file. Here's a sample.

```json
    {
        "name": "Launch Salesforce DX VS Code Apex Tests",
        "type": "extensionHost",
        "request": "launch",
        "runtimeExecutable": "${execPath}",
        "args": [
            //<path-to-a-folder>
            "--extensionDevelopmentPath=${workspaceRoot}/packages",
            "--extensionTestsPath=${workspaceRoot}/packages/salesforcedx-vscode-apex/out/test"
        ],
        "stopOnEntry": false,
        "sourceMaps": true,
        "outFiles": [
            "${workspaceRoot}/packages/*/out/test/**/*.js"
        ],
        "preLaunchTask": "Compile"
    }
```

The important args are:
* The first, optional, parameter is a location to a folder that will serve as
  the workspace to run the tests. If you omit this, it just uses a clean
  workspace (which is usually what you want).
* `--extensionDevelopmentPath` - This governs what extensions are loaded
* `--extensionTestsPath` - This governs what tests are actually run. This seems
  to be a specific folder so you cannot add a wildcard.

### Running through the CLI

You should add an entry like `"test": "node ./node_modules/vscode/bin/test"` to
your package.json.

When you run `npm test` it will actually go ahead and fetch an instance of code
into the .vscode-test folder and run your tests with that instance. Thus, the
.vscode-test folder should be put into your .gitignore (and other .ignore files
such as .npmignore and .vscodeignore)

There are some optional environment variables to configure the test runner:

| Name        | Description       |
| ------------|-------------------|
| `CODE_VERSION` | Version of VS Code to run the tests against (e.g. `0.10.10`) |
| `CODE_DOWNLOAD_URL` | Full URL of a VS Code drop to use for running tests against |
| `CODE_TESTS_PATH` | Location of the tests to execute (default is `proces.cwd()/out/test` or `process.cwd()/test`) |
| `CODE_EXTENSIONS_PATH` | Location of the extensions to load (default is `proces.cwd()`) |
| `CODE_TESTS_WORKSPACE` | Location of a workspace to open for the test instance (default is CODE_TESTS_PATH) |

If you are running this from the top-level root folder, you can issue `npm run
test:without-system-tests`. 

See VS Code's doc
[site](https://code.visualstudio.com/docs/extensions/testing-extensions#_running-tests-automatically-on-travis-ci-build-machines)
for more information.

See this
[repository](https://github.com/Microsoft/vscode-extension-vscode/blob/master/bin/test)
for the actual vscode/bin/test source.

# System Tests with Spectron

We have several system (end-to-end) tests written using
[Spectron](https://github.com/electron/spectron). These tests exercise the
end-to-end flow from the perspective of user. These tests borrow heavily from
how the VS Code team does its [smoke
tests](https://github.com/Microsoft/vscode/issues/25291).

### Assumptions

1. Port 7777 is available on your machine. If it is not, you need to change
   `application.ts` to use a different port for webdriver.
1. Ensure that system tests go into `packages/system-tests`.
1. Ensure that tests are in the `packages/system-tests/scenarios` folder.
1. Ensure that your test files are named like .test.ts. The .test. in the middle is essential

### General Flow

The general flow of the system tests are as follows:

1. Pre-populate a folder with one of the sample projects from the
   `packages/system-tests/assets` folder.
1. Open an instance of VS Code on that workspace.
1. Execute a series of commands against that workspace and verify the results.

Because system tests take a _long_ time to execute, it's important to group them
together to minimize the setup time.

## Running System Tests

From the top-level folder, execute `npm run test:system-tests`

## Debugging System Tests

1. `DEBUG_SPECTRON=1 npm run test:system-tests`.
1. Use the "Attach to Process (Inspector Protocol)" debug configuration to
   attach to the process (uses port 9229).