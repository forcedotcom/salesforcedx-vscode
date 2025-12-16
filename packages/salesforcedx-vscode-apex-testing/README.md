# Salesforce Apex Testing Extension

This extension provides Apex test execution and management features for VS Code.

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

## Requirements

- `salesforcedx-vscode-core` extension
- `salesforcedx-vscode-apex` extension

## Extension Settings

- `salesforcedx-vscode-apex-testing.discoverySource`: Select the source for Apex test discovery (ls or api)
- `salesforcedx-vscode-apex-testing.test-run-concise`: Display only failed test results
