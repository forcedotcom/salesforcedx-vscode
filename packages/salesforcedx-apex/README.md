# Salesforce Apex

[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)

Typescript Library and Oclif plugin to support the Salesforce Apex commands.

Note: This library is in beta and has been released early so we can collect feedback. It may contain bugs, undergo major changes, or be discontinued.

## Development

Clone the project and `cd` into it. Ensure you have [Yarn](https://yarnpkg.com/) installed and run the following to build:

```
$ yarn install
$ yarn build
```

## Testing

### Running the test suite

```
$ yarn test
```

> When running tests, code changes don't need to be built with `yarn build` first since the test suite uses ts-node as its runtime environment. Otherwise, you should run `yarn build` before manually testing changes.
