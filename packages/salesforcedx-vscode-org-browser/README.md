# Salesforce Org Browser

## Development

### Testing

This extension includes comprehensive Playwright tests for both web and desktop (Electron) environments with shared test logic.

#### Quick Test Commands

Run from project level (salesforcedx-vscode directory) using `-w` flag:

```bash
# Install dependencies (includes Playwright)
npm install

# Compile the extension
npm run compile -w salesforcedx-vscode-org-browser

# Run web tests (headless by default)
npm run test:web -w salesforcedx-vscode-org-browser

# Run desktop tests (Electron UI always visible)
npm run test:desktop -w salesforcedx-vscode-org-browser

# Run all e2e tests (web + desktop)
npm run test:e2e -w salesforcedx-vscode-org-browser

# Run web tests with headed browser for debugging
npm run test:web:ui -w salesforcedx-vscode-org-browser
```

#### Environment Setup

Tests use the `DREAMHOUSE_ORG_ALIAS` environment variable to locate a pre-configured Salesforce org:

```bash
# Set the org alias (defaults to orgBrowserDreamhouseTestOrg)
export DREAMHOUSE_ORG_ALIAS=myTestOrg

# Verify org exists and is authenticated
sf org display -o myTestOrg
```

In CI, the org is created automatically. For local development, reuse an existing org to avoid creating a new scratch org for each test run.

#### Manual Testing for Debugging

```bash
npm run run:web
```

Opens VS Code web in Chrome with DevTools. For org credentials and settings injection, see [docs/QA.md](../../docs/QA.md).

**Manual test workflow:** Explorer tab → Org Browser tab → check console for errors.

#### Automated Testing Architecture

**Playwright Tests with CDP Support:**

- Tests attempt CDP connection to existing Chrome browser first
- Falls back to isolated Playwright if CDP unavailable
- More realistic testing with CDP, predictable testing with fallback
- Captures console errors from browser session

**Test Flow:**

1. Tests attempt CDP connection to existing browser first
2. Falls back to isolated Playwright if CDP unavailable
3. Verifies Explorer loads → switches to Org Browser → checks for errors
4. Captures and reports console errors, especially EventEmitter issues

#### Test Structure

```text
test/playwright/
├── specs/                     # Test specs (shared between web & desktop)
│   ├── orgBrowser.customObject.headless.spec.ts
│   ├── orgBrowser.customTab.headless.spec.ts
│   ├── orgBrowser.folderedReport.headless.spec.ts
│   └── orgBrowser.load.smoke.spec.ts
├── fixtures/                  # Platform-specific test fixtures
│   ├── webFixtures.ts        # Web test setup
│   ├── desktopFixtures.ts    # Desktop/Electron test setup
│   └── desktopWorkspace.ts   # Workspace creation for desktop
├── pages/                     # Page objects (shared)
├── utils/                     # Test utilities (shared)
└── web/                       # Web-only infrastructure
    └── headlessServer.ts     # VS Code web server

playwright.config.web.ts       # Web test configuration
playwright.config.desktop.ts   # Desktop test configuration
```

**Key Design:**

- Same test files run on both web and desktop platforms
- Platform-specific setup via Playwright fixtures
- Desktop uses worker-scoped VS Code download (cached)
- Each test gets fresh Electron instance with isolated workspace

#### Troubleshooting

**"No tests found":** `npm run test:web -- --list` or `--grep "should verify org browser"`

**Extension not activating:** Check Services extension activated first; verify bundle compiled.

**Port conflicts, polyfills, auth:** See [docs/QA.md](../../docs/QA.md), [docs/Build.md](../../docs/Build.md), [contributing/developing.md](../../contributing/developing.md).

Based on the [VS Code web extensions guide](https://code.visualstudio.com/api/extension-guides/web-extensions).

This extension provides org browsing capabilities for Salesforce development in VS Code.

## Features

- Browse Salesforce org metadata
- Retrieve components from org
- Interactive org navigation

## Requirements

- VS Code 1.90.0 or higher
- Salesforce CLI
- Authenticated Salesforce org

## Installation

This extension is part of the Salesforce Extensions for VS Code package.

## Usage

1. Open a Salesforce project
2. Authenticate with your org
3. Use the Org Browser to navigate and retrieve metadata

## Contributing

Please see the [contributing guide](../../CONTRIBUTING.md) for details on how to contribute to this project.

## License

[BSD 3-Clause License](LICENSE.txt)
