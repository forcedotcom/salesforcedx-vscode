# Salesforce Apex Testing Extension

This extension provides Apex test execution and management features for VS Code.

**DO NOT INSTALL THIS EXTENSION DIRECTLY. Install the complete [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) instead.**

## Features

- Run Apex tests (all tests, local tests, specific classes, methods, or test suites)
- Test view sidebar for browsing and running tests
- Test result visualization
- Integration with Apex Language Server for test discovery
- Support for Tooling API test discovery

## Commands

- `sf.apex.test.run` - Run Apex Tests
- `sf.apex.test.class.run` - Run Apex Test Class
- `sf.apex.test.method.run` - Run Apex Test Method
- `sf.apex.test.last.class.run` - Re-Run Last Run Apex Test Class
- `sf.apex.test.last.method.run` - Re-Run Last Run Apex Test Method
- `sf.apex.test.suite.run` - Run Apex Test Suite
- `sf.apex.test.suite.create` - Create Apex Test Suite
- `sf.apex.test.suite.add` - Add Tests to Apex Test Suite
- `sf.apex.generate.unit.test.class` - Generate Apex Unit Test Class

## Requirements

- This extension requires the `salesforcedx-vscode-services` extension. Install the [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) for the full experience.

## Extension Settings

- `salesforcedx-vscode-apex-testing.test-run-concise`: Display only failed test results
- `salesforcedx-vscode-apex-testing.outputFormat`: Output format (markdown | text)
- `salesforcedx-vscode-apex-testing.testSortOrder`: Sort order (runtime | coverage | severity)
- `salesforcedx-vscode-apex-testing.testPerformanceThresholdMs`: Performance threshold
- `salesforcedx-vscode-apex-testing.testCoverageThresholdPercent`: Coverage threshold
- `salesforcedx-vscode-apex-testing.retrieve-test-code-coverage`: Retrieve code coverage
- `salesforcedx-vscode-apex-testing.disable-warnings-for-missing-coverage`: Disable coverage warnings
