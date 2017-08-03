# Introduction

VS Code provides its own special way to run tests that require access to the
extension development host. Basically, it launches your test in another instance
of itself. You have control over what extensions are launched, the tests that
are run, and also the workspace that it will run in. This gives you quite a bit
of flexibility.

More information can be found at the doc
[site](https://code.visualstudio.com/docs/extensions/testing-extensions).

## Assumptions

While the test runner is highly configurable, there are certain assumptions that
will help make writing the tests easier.

1. Ensure that your tests go into the `test` folder.
1. Ensure that you have an index.ts file in the test folder that follows what is
   in the standard configuration (copy from an existing one if you don't have
   it).
1. Ensure that your test files are named like <something>.test.ts. The .test. in
   the middle is essential
1. Ensure that your .js test files are compiled into the out/test directory.

## Running interactively

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

## Running through the CLI

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

If you are running this from the top-level root folder, you can issue `lerna run
test --concurrency 1`. The `--concurrency 1` is vital since, according to the
docs, "Running extension tests from the command line is currently only supported
if no other instance of Code is running."

See VS Code's doc
[site](https://code.visualstudio.com/docs/extensions/testing-extensions#_running-tests-automatically-on-travis-ci-build-machines)
for more information.

See this
[repository](https://github.com/Microsoft/vscode-extension-vscode/blob/master/bin/test)
for the actual vscode/bin/test source.

