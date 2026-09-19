# Tests

## Introduction

There are several kinds of tests for the VS Code Extensions. This document
describes them and gives pointers on how to run/debug them.

The test types from most preferred to least preferred are:

1. Unit Tests - Vitest: Found under the test/jest and test/unit directories.
   - `npm run test`
1. End to End Tests - Playwright: Found in each extension's test/playwright directory.
   - Run spec-by-spec via IDE or via `npm run playwright` in the extension package

To run all unit tests, execute `npm run compile && npm run test` from the root folder.
Instructions for running Playwright E2E tests locally are in [.claude/skills/playwright-e2e/SKILL.md](../.claude/skills/playwright-e2e/SKILL.md).

### Unit Tests

Unit tests priorities are as follows:

1. Unit tests should focus on only the _unit_ of code under test.
   - 1 method/function
1. All dependencies should be mocked.
1. Unit tests should be easy to write and execute
   - If your code is hard to test consider how it could be refactored to make it easier to test.
1. Use only Vitest and do not import mocha/sinon/chai.
1. Code coverage is one measure of how well we are unit testing our code. We should strive to cover all code paths for any touched code in the repository. Generate coverage with `vitest run --coverage`.

#### How to Write Vitest Unit Tests

- Test files use the {fileUnderTestName}.test.ts format and should go under the same directory structure as the source in the test/jest folder.
   - Existing directory names remain unchanged.
  - Example:
    - File under test: `src/commands/auth/authParamsGatherer.ts`
    - Test File location and name: `test/jest/commands/auth/authParamsGatherer.test.ts`
- Tests can be executed from the IDE, command line, or via npm script.
  - IDE: use the Vitest extension's Run & Debug CodeLens in test files.
  - Command line: `npx vitest run` executes all unit tests in a package. Retained Jest integration tests use `npx jest -c jest.integration.config.js`.
  - npm scripts:
    - `npm run test`

#### Vitest Information

- Unit tests share `config/vitest.base.config.mts`; each package has a `vitest.config.mts` for package-specific settings.
- `scripts/setupVitest.ts` provides the shared [mocked vscode module](#virtual-mocked-vscode-module).
- Vitest globals are enabled, so tests do not import `describe`, `it`, `expect`, or `vi`.
- Vitest resets mocks after each test. Tests must not depend on execution order or state from another test.

#### Virtual Mocked vscode Module

Vitest aliases `vscode` to a mock for unit tests. This is required because extensions only have `@types/vscode` installed locally; the runtime module is available only inside VS Code.

The mock is defined in `scripts/setupVitest.ts` and is automatically injected for all tests.

Best Practices around the mocked vscode modules.

- If you find a property that is not currently available in the mock please add it.
- The mocked module should only mock the high level properties. Resolving/returning values should be left to the individual test suite setup so that we can avoid having to adhere to particular behavior across tests.
- Be aware that the mock call is only executed once during test execution and then resolves for all imports executed during the test run. Individual mocked properties on the module are reset after each test.
- Use proper VS Code types when creating mock objects (e.g., `vscode.TaskExecution`, `vscode.TaskProcessEndEvent`). This ensures type safety and prevents `any` types from hiding issues. Cast mock properties using `as` where needed (e.g., `task: {} as vscode.Task`).

#### Singleton Test Isolation

Singletons bypass Vitest's automatic mock reset, causing tests to inherit stale state from prior test runs. If a module exports a singleton accessor (e.g., `getLwcTestController()`), expose a disposal/reset export and call it in `beforeEach` to isolate each test:

```typescript
describe('my singleton tests', () => {
  beforeEach(() => {
    disposeLwcTestController(); // resets instance to undefined
  });
  // ... tests ...
});
```

This ensures each test gets a fresh singleton bound to its own mocks.

**URI Normalization:** Test controllers normalize URIs for platform-specific paths. LWC test controller on macOS (via `normalizeJestFsPath`): strips `/private` prefix (symlink resolution); normalizes `/users/` → `/Users/` case. Matches discovery keying, prevents test runs targeting detached tree items. When testing URI resolution, supply paths matching both symlinks and realpaths.

**Test Results Panel Auto-Reveal:** LWC test controller auto-reveals panel when running tests from command palette, code lenses, or editor-title buttons (via `runByExecutionInfo`). Native Test Explorer run-profile clicks call `runTests` directly, don't trigger reveal. Test by mocking `vscode.commands.executeCommand`, verify it receives `'workbench.panel.testResults.view.focus'`.

**Native Test Controller Assertions:** E2E tests verify native surfaces:
- Test Results panel displays Pass Rate text after runs
- Tree items carry aria-label with "(Passed)" decoration for completed tests
