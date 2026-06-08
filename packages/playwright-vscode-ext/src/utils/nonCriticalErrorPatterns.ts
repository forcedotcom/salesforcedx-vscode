/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const NON_CRITICAL_ERROR_PATTERNS = [
  // VS Code Web expected missing resources
  'favicon.ico',
  'sourcemap',
  'webPackagePaths.js',
  'workbench.web.main.nls.js',
  // IndexedDB shutdown noise in web
  'idbtransaction',
  'indexeddb database',
  'Long running operations during shutdown', // VS Code lifecycle noise
  'marketplace.visualstudio.com', // Marketplace/network optional features
  "Activating extension 'vscode.typescript-language-features' failed", // Extensions not supported in web
  'CodeExpectedError', // Generic non-fatal code expectation messages
  'Failed to load resource', // Generic failed to load resources (paired with specific url filtering below)
  'vscode-userdata:/user/caches/cachedconfigurations', // VS Code user data caching in web environment
  'vsliveshare', // vscode liveshare ext
  'MaxListenersExceededWarning', // expected when loading many dev extensions simultaneously
  'punycode', // known jsforce and transitive dep deprecation by node
  'selectedStep', // VS Code internal walkthrough/tutorial state errors
  'onWillSaveTextDocument', // VS Code save event timeout (non-critical)
  'Throttler is disposed', // VS Code internal throttler lifecycle error (non-critical)
  'vscode-log:', // VS Code internal logging infrastructure errors
  'tasks.log', // VS Code tasks log file creation conflicts
  'theme-defaults/themes', // VS Code theme loading failures
  'light_modern.json', // VS Code theme file loading
  'Failed to fetch', // Generic fetch failures (often for optional resources)
  'tsserver.web.js', // TypeScript language features extension (UriError: Scheme contains illegal characters)
  'typescript-language-features', // TS extension console/URI errors in web
  'NO_COLOR', // Node.js color env var warnings
  'Content Security Policy', // CSP violations from VS Code webviews (non-critical UI errors)
  'Applying inline style violates', // CSP inline style errors from VS Code UI
  'Unable to resolve resource walkThrough://', // VS Code walkthrough/getting started page errors (non-critical)
  'SourceMembers timed out after', // sourcemember polling warnings from source-tracking-library
  'Illegal value for lineNumber', // VS Code internal editor error (non-critical),
  "'allow-scripts' permissions is not set", //
  'Blocked script execution', // Webview sandboxing initialization errors (non-critical)
  'vscode-webview://', // Webview internal URLs (paired with blocked script errors)
  'Connection failed, falling back to static endpoint', // o11y unauthnticated connection,
  'Ignoring terminal.integrated.initialHint', // VS Code terminal hint configuration conflicts (non-critical)
  // these are known issue with apex test ext.  They need to be fixed, but might involve the library code.
  // Apex code-lens provider (provideCodeLenses) fires on file open even in headless/no-org tests; VS Code surfaces two console errors for the same underlying cause:
  'No default org is set', // specific message from WorkspaceContextUtil.getConnection
  'No target org configured', // NoTargetOrgConfiguredError from salesforcedx-vscode-services (no-org workspace)
  'An unknown error occurred. Please consult the log for more details.', // VS Code workbench generic wrapper around the same no-org error
  'Failed to write JSON test result file', // Web filesystem limitations when writing test results (non-critical)
  'callback must be a function', // memfs/Volume API compatibility issue on web (non-critical),
  'Unable to resolve nonexistent file', // VS Code trying to access files that don't exist yet (workspace state)
  'testResults', // Test results folder access before it's created (non-critical)
  'workspaceStorage', // Workspace storage access errors during initialization (non-critical)
  'Illegal assignment from String to Integer', // Execute anonymous compile error (intentionally triggered in E2E)
  'Network error occurred', // VS Code Extension Host IPC keep-alive poller warning (non-critical)
  'PerfSampleError', // Electron perf sampling noise (non-critical, unrelated to extension behavior)
  'workbench.contrib.agentHostTerminal', // VS Code agent host terminal error (non-critical)
  'Unable to resolve your shell environment', // VS Code terminal profile / integrated shell init (noisy on desktop E2E)
  'Canceled: Canceled', // VS Code workbench / extension-host dispose during Reload Window or test teardown (non-critical)
  // VS Code 1.116+ desktop: workbench contributions that expect remote agent (not present in @vscode/test-electron)
  'agenthostterminal', // VS Code terminal/Copilot settings interplay — benign when running packaged VS Code in tests
  'initialhint.copilotcli',
  'copilotCli', // GitHub Copilot CLI extension noise (non-critical)
  'remoteAgentHostService', // VS Code remote agent host service noise (non-critical)
  // VS Code 1.116+ core Accounts area silently fetches a session/entitlement on boot;
  // with `vscode.github-authentication` disabled there's no provider, so it surfaces this
  // toast. Benign in E2E — tests don't use VS Code accounts.
  'Sign-in failed',
  'Channel is closed',
  'GenOpAgentConfig', // VS Code 1.119+ registry warning for unreleased agent config type (non-critical)
  'DEP0005', // Node.js Buffer() deprecation warning from transitive dependencies (non-critical)
  'DEP0169', // Node.js url.parse() deprecation warning from transitive dependencies (non-critical)
  // VS Code 1.119+ web: workbench tries to instantiate agentHostSandboxForwarder which requires a
  // remote connection that doesn't exist in @vscode/test-web. Tracked upstream:
  // https://github.com/microsoft/vscode/issues/318222
  'agentHostSandboxForwarder',
  'Remote agent host is not enabled'
] as const;
