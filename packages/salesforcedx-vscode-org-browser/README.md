# Salesforce Org Browser

## Development

### Testing Web Extension

This extension includes comprehensive Playwright tests for web extension functionality with both automated and manual testing approaches.

#### Quick Test Commands

Run from project level (salesforcedx-vscode directory) using `-w` flag:

```bash
# Install dependencies (includes Playwright)
npm install

# Compile the extension
npm run compile -w salesforcedx-vscode-org-browser

# Start VS Code web test server with an example of running a single test
npm run test:web -w salesforcedx-vscode-org-browser -- --grep "should verify org browser"

# Start VS Code web manually for development/debugging.  LLMs can't use this, ever
npm run run:web -w salesforcedx-vscode-org-browser
```

#### Manual Testing for Debugging

For interactive debugging and reproducing issues:

```bash
# Start VS Code web with real Chrome browser + debugging tools LLMs can't use this, ever
npm run run:web

# This opens:
# - Real Chrome browser (not headless)
# - VS Code web at http://localhost:3000
# - Chrome DevTools automatically opened
# - Remote debugging enabled on port 9222
# - Web security disabled for CORS testing
# - Both Org Browser and Services extensions loaded
```

**Manual test workflow:**

1. Click Explorer tab to verify file tree loads
2. Click Org Browser tab to test extension switching
3. Check browser console for any errors (especially `removeAllListeners` errors)
4. Verify authentication and org tree data loading

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

#### File Structure

```text
test/web/
├── orgBrowser.spec.ts       # Main extension functionality tests
├── shared/
│   └── cdpUtils.ts         # Shared CDP utilities
```

#### Test Environment Details

- `vscode-test-web` serves VS Code with extensions loaded
- Real Chromium browser with debugging enabled (`--remote-debugging-port=9222`)
- Web security disabled for CORS testing (`--disable-web-security`)
- Services extension dependency explicitly loaded
- EventEmitter polyfills for Node.js → browser compatibility

#### Common Issues & Solutions

**Port conflicts:** Clean up processes before testing:

```bash
pkill -f "vscode-test-web|chrome.*9222" || true
```

**Extension dependencies:** Org Browser requires Services extension:

- Both extensions bundled with esbuild for browser compatibility
- EventEmitter polyfills applied for jsforce compatibility
- Process and stream polyfills for Node.js APIs

**Console error testing:** Tests specifically check for:

- `removeAllListeners is not a function` errors
- Authentication failures
- Tree loading errors
- Network/CORS issues

#### Troubleshooting Web Tests

**"No tests found" error:**

```bash
# List available tests
npm run test:web -- --list

# Run specific test
npm run test:web -- --grep "should verify org browser"
```

**Extension not activating:**

- Check Services extension activated first (look for workspace creation logs)
- Verify `activationEvents: ["*"]` in Services package.json
- Check for bundle compilation errors

**EventEmitter/polyfill issues:**

- Rebuild extensions after polyfill changes: `npx lerna run bundle:extension`
- Check esbuild alias configuration in `scripts/bundling/web.mjs`
- Verify `events` module properly aliased for jsforce compatibility

**Authentication/CORS errors:**

- Expected in test environment (isolated browser context)
- Use manual testing with `npm run run:web` for real auth testing
- CDP tests connect to real browser for more realistic auth context

Based on the [VS Code web extensions guide](https://code.visualstudio.com/api/extension-guides/web-extensions)

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
