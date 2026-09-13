/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Build the `grep` value from CB_GREP. A malformed regex would otherwise throw at config load and break
 * the whole run, so an invalid pattern falls back to "no filter" (run everything) with a warning.
 */
const parseGrep = (value: string | undefined): RegExp | undefined => {
  if (!value) return undefined;
  try {
    return new RegExp(value);
  } catch {
    console.warn(`[createContainerConfig] ignoring invalid CB_GREP regex: ${value}`);
    return undefined;
  }
};

/**
 * Resolve `maxFailures` from CB_MAX_FAILURES (0 = no cap). A non-numeric value would coerce to NaN
 * (undefined Playwright behavior), so anything unparseable falls back to the CI default.
 */
const parseMaxFailures = (value: string | undefined): number => {
  if (value !== undefined) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return process.env.CI ? 3 : 0;
};

type ContainerConfigOptions = {
  /** Test directory relative to the config file (e.g. './specs/container') */
  testDir: string;
  /** Number of parallel workers (default: 1 — one shared container serves the workbench) */
  workers?: number;
  /** Run tests in parallel (default: false — the container is a single shared editor session) */
  fullyParallel?: boolean;
  /** Per-test timeout in ms (default: 360_000) */
  timeout?: number;
};

/**
 * Playwright config for driving a browser against a running Code Builder container.
 *
 * Code Builder serves a Node-extension-host code-server over a browser UI, so the client is a
 * plain Chromium page navigating to the container URL (like web mode) while the workbench runs the
 * desktop extension build. The container is started, extension-swapped, and health-checked by the
 * orchestrator/CI (scripts/codeBuilderLocalE2E.ts, .github/workflows/codeBuilderE2E.yml) — there is
 * no Playwright `webServer` here. `CODE_BUILDER_URL` overrides the default port (58080 published to
 * 8123 by the orchestrator).
 */
export const createContainerConfig = (options: ContainerConfigOptions) =>
  defineConfig({
    testDir: options.testDir,
    // CB_GREP filters specs by title regex. Passed as an env var (not a `--grep` CLI arg) because the
    // orchestrator forwards it through `npm run … -w <pkg>` → wireit, which does NOT shell-quote
    // forwarded args — a value with spaces or a `|` alternation (e.g. two spec titles) would be split
    // and mis-parsed. An env var travels intact through spawnSync's `env`, so any title regex works.
    grep: parseGrep(process.env.CB_GREP),
    fullyParallel: options.fullyParallel ?? false,
    forbidOnly: !!process.env.CI,
    workers: options.workers ?? 1,
    reporter: process.env.CI
      ? [['html', { open: 'never' }], ['line'], ['junit', { outputFile: 'test-results/junit.xml' }]]
      : [['html', { open: 'never' }], ['list']],
    use: {
      viewport: { width: 1920, height: 1080 },
      baseURL: process.env.CODE_BUILDER_URL ?? 'http://localhost:8123',
      trace: process.env.CI ? 'on' : 'on-first-retry',
      screenshot: process.env.CI ? 'on' : 'only-on-failure',
      video: process.env.CI ? 'on' : 'retain-on-failure',
      actionTimeout: 15_000,
      navigationTimeout: 30_000,
      permissions: ['clipboard-read', 'clipboard-write'],
      launchOptions: {
        args: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-features=IsolateOrigins,site-per-process',
          '--enable-clipboard-read-write'
        ]
      }
    },
    timeout: process.env.DEBUG_MODE ? 0 : (options.timeout ?? 360 * 1000),
    // Cap failures in CI so a broadly-broken run stops fast — EXCEPT when CB_MAX_FAILURES is set
    // (0 = no cap), which the sharded per-package workflow uses to get a true pass/fail count for the
    // whole package instead of aborting at the 3rd failure and marking the rest "did not run".
    maxFailures: parseMaxFailures(process.env.CB_MAX_FAILURES),
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
        retries: process.env.E2E_NO_RETRIES ? 0 : 2,
        snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/chromium/{arg}{ext}'
      }
    ]
  });
